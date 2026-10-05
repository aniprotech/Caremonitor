import { paymentExplanation } from "./assistance.js";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { fail, reply } from "../http.js";
import { readSaltEdgeBankingData } from "./salt-edge-banking.js";

export function matchesInvoiceReference(description, number) {
  const n = Number(number);
  if (!Number.isSafeInteger(n) || n < 1) return false;
  return new RegExp(`(?:^|[^A-Z0-9])INV[-\\s]*0*${n}(?![A-Z0-9])`, "i")
    .test(String(description || ""));
}

const invoiceRows = (db, agencyId) => db.query(`
  SELECT d.id,d.number,d.recipient_name AS "recipientName",d.total_pence AS "totalPence",
    d.status,d.created_at AS "createdAt",
    (COALESCE((SELECT sum(p.amount_pence) FROM node_invoice_payments p
      WHERE p.agency_id=d.agency_id AND p.invoice_id=d.id AND p.reversed_at IS NULL),0)
    +COALESCE((SELECT sum(m.amount_pence) FROM node_manual_invoice_payments m
      WHERE m.agency_id=d.agency_id AND m.invoice_id=d.id AND m.reversed_at IS NULL),0))::bigint AS "paidPence",
    COALESCE((SELECT sum(c.total_pence) FROM node_credit_notes c
      WHERE c.agency_id=d.agency_id AND c.invoice_id=d.id AND c.status='APPLIED'),0)::bigint AS "creditedPence"
  FROM node_finance_documents d WHERE d.agency_id=$1 AND d.kind='INVOICE'
  ORDER BY d.number DESC LIMIT 1000`, [agencyId]);

async function invoiceBalance(db, agencyId, invoiceId) {
  const result = await db.query(`SELECT d.id,d.status,d.total_pence AS "totalPence",
    (COALESCE((SELECT sum(p.amount_pence) FROM node_invoice_payments p
      WHERE p.agency_id=d.agency_id AND p.invoice_id=d.id AND p.reversed_at IS NULL),0)
    +COALESCE((SELECT sum(m.amount_pence) FROM node_manual_invoice_payments m
      WHERE m.agency_id=d.agency_id AND m.invoice_id=d.id AND m.reversed_at IS NULL),0))::bigint AS "paidPence",
    COALESCE((SELECT sum(c.total_pence) FROM node_credit_notes c
      WHERE c.agency_id=d.agency_id AND c.invoice_id=d.id AND c.status='APPLIED'),0)::bigint AS "creditedPence"
    FROM node_finance_documents d WHERE d.id=$1 AND d.agency_id=$2 AND d.kind='INVOICE' FOR UPDATE`,
  [invoiceId, agencyId]);
  if (!result.rows[0]) fail(404, "Invoice not found");
  const invoice = result.rows[0];
  return { ...invoice, paidPence: Number(invoice.paidPence), creditedPence: Number(invoice.creditedPence),
    outstandingPence: Math.max(0, Number(invoice.totalPence) - Number(invoice.paidPence) - Number(invoice.creditedPence)) };
}

export function registerInvoiceReconciliation({ db, auth, config }, route) {
  const requireAgency = (req) => {
    auth.admin(req);
    if (!req.user.agencyId) fail(403, "An organisation is required");
    return req.user.agencyId;
  };

  route("POST", "/api/accounting/reconciliation/sync", async (req, res) => {
    const agencyId = requireAgency(req);
    if (!config.saltEdgeAppId || !config.saltEdgeSecret) fail(503, "Banking is not configured");
    let bank;
    try { bank = await readSaltEdgeBankingData({ db, config }, agencyId); }
    catch (error) {
      console.error("Bank transaction sync failed", error.providerStatus || error.message);
      fail(502, "Bank transactions could not be refreshed. Try again later.");
    }
    let imported = 0;
    await db.transaction(async () => {
      for (const tx of bank.transactions) {
        if (!Number.isSafeInteger(tx.amountPence) || !/^\d{1,30}$/.test(tx.id) ||
          !/^\d{1,30}$/.test(tx.accountId) || tx.currency !== "GBP") continue;
        const result = await db.query(`INSERT INTO node_bank_transactions
          (agency_id,provider_transaction_id,provider_account_id,booked_on,description,amount_pence,currency,is_sandbox)
          VALUES($1,$2,$3,$4,$5,$6,'GBP',$7) ON CONFLICT DO NOTHING RETURNING provider_transaction_id`,
        [agencyId, tx.id, tx.accountId, tx.date, tx.description, tx.amountPence, tx.isSandbox !== false]);
        imported += result.rows.length;
      }
    });
    return reply(res, { imported, available: bank.transactions.length, activeConnections: bank.connections.filter(c => c.status === "active").length },
      "Bank transactions refreshed");
  });

  route("GET", "/api/accounting/reconciliation", async (req, res) => {
    const agencyId = requireAgency(req);
    const [documents, bank, payments, manualPayments] = await Promise.all([
      invoiceRows(db, agencyId),
      db.query(`SELECT t.provider_transaction_id AS id,t.provider_account_id AS "accountId",
        t.booked_on::text AS date,t.description,t.amount_pence AS "amountPence",t.is_sandbox AS "isSandbox",
        p.id AS "paymentId",p.invoice_id AS "invoiceId"
        FROM node_bank_transactions t LEFT JOIN node_invoice_payments p
          ON p.agency_id=t.agency_id AND p.provider_transaction_id=t.provider_transaction_id
          AND p.reversed_at IS NULL
        WHERE t.agency_id=$1 ORDER BY t.booked_on DESC NULLS LAST,t.imported_at DESC LIMIT 1000`, [agencyId]),
      db.query(`SELECT p.id,p.invoice_id AS "invoiceId",p.provider_transaction_id AS "transactionId",
        p.amount_pence AS "amountPence",p.paid_on::text AS "paidOn",p.reference,
        p.created_at AS "createdAt",p.reversed_at AS "reversedAt",p.reversal_reason AS "reversalReason"
        FROM node_invoice_payments p WHERE p.agency_id=$1 ORDER BY p.created_at DESC LIMIT 1000`, [agencyId]),
      db.query(`SELECT m.id,m.invoice_id AS "invoiceId",m.amount_pence AS "amountPence",
        m.received_on::text AS "paidOn",m.method,m.reference,m.note,
        m.created_at AS "createdAt",m.reversed_at AS "reversedAt",m.reversal_reason AS "reversalReason"
        FROM node_manual_invoice_payments m WHERE m.agency_id=$1 ORDER BY m.created_at DESC LIMIT 1000`, [agencyId]),
    ]);
    const invoices = documents.rows.map(row => {
      const paidPence = Number(row.paidPence), creditedPence = Number(row.creditedPence);
      const outstandingPence = Math.max(0, Number(row.totalPence) - paidPence - creditedPence);
      const overpaymentPence = Math.max(0, paidPence + creditedPence - Number(row.totalPence));
      const paymentStatus = row.status === "VOID" ? "VOID" : row.status === "DRAFT" ? "DRAFT" :
        overpaymentPence > 0 ? "OVERPAID" : row.status === "PAID" && paidPence === 0 && outstandingPence > 0
          ? "UNVERIFIED_PAID" : outstandingPence === 0 ? paidPence > 0 ? "PAID" : "CREDITED"
            : paidPence > 0 ? "PART_PAID" : "UNPAID";
      return { ...row, paidPence, creditedPence, outstandingPence, overpaymentPence, paymentStatus };
    });
    const transactions = bank.rows.map(row => {
      const amountPence = Number(row.amountPence);
      const candidates = !row.paymentId && !row.isSandbox && amountPence > 0
        ? invoices.filter(invoice => ["ISSUED", "PAID"].includes(invoice.status) &&
          invoice.outstandingPence === amountPence && matchesInvoiceReference(row.description, invoice.number)) : [];
      return { ...row, amountPence, suggestedInvoiceId: candidates.length === 1 ? candidates[0].id : null, suggestionReason: paymentExplanation({ ...row, amountPence }, candidates) };
    });
    return reply(res, { invoices, transactions,
      payments: [...payments.rows.map(row => ({ ...row, source: "BANK", amountPence: Number(row.amountPence) })),
        ...manualPayments.rows.map(row => ({ ...row, source: "MANUAL", amountPence: Number(row.amountPence) }))]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
  });

  route("POST", "/api/accounting/reconciliation/manual-payments", async (req, res) => {
    const agencyId = requireAgency(req);
    const parsed = z.object({ invoiceId: z.uuid(), amountPence: z.number().int().positive().max(2000000000),
      receivedOn: z.iso.date(), method: z.enum(["BANK_TRANSFER", "CASH", "CHEQUE", "OTHER"]),
      reference: z.string().trim().max(200).default(""), note: z.string().trim().min(5).max(1000) }).safeParse(req.body);
    if (!parsed.success) fail(400, "Enter an invoice, valid payment date, amount, method and note");
    const b = parsed.data;
    const paymentId = await db.transaction(async () => {
      const invoice = await invoiceBalance(db, agencyId, b.invoiceId);
      if (!["ISSUED", "PAID"].includes(invoice.status)) fail(409, "Only issued invoices can receive a payment");
      if (b.amountPence > invoice.outstandingPence) fail(409, "Payment exceeds the invoice's outstanding balance");
      const id = randomUUID();
      await db.query(`INSERT INTO node_manual_invoice_payments
        (id,agency_id,invoice_id,amount_pence,received_on,method,reference,note,created_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, agencyId, b.invoiceId, b.amountPence, b.receivedOn, b.method, b.reference, b.note, req.user.id]);
      if (b.amountPence === invoice.outstandingPence)
        await db.query("UPDATE node_finance_documents SET status='PAID',updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND agency_id=$2", [b.invoiceId, agencyId]);
      await db.query(`INSERT INTO node_finance_history(id,agency_id,actor_id,subject_id,action,snapshot)
        VALUES($1,$2,$3,$4,'MANUAL_PAYMENT_RECORDED',$5)`,
      [randomUUID(), agencyId, req.user.id, b.invoiceId, JSON.stringify({ paymentId: id, ...b })]);
      return id;
    });
    return reply(res, { id: paymentId }, "Payment recorded by administrator; bank verification is not implied", 201);
  });

  route("POST", "/api/accounting/reconciliation/manual-payments/:id/reverse", async (req, res) => {
    const agencyId = requireAgency(req);
    const id = z.uuid().safeParse(req.params.id);
    const input = z.object({ reason: z.string().trim().min(5).max(500) }).safeParse(req.body);
    if (!id.success || !input.success) fail(400, "Choose a payment and explain the reversal");
    await db.transaction(async () => {
      const original = (await db.query("SELECT invoice_id FROM node_manual_invoice_payments WHERE id=$1 AND agency_id=$2", [id.data, agencyId])).rows[0];
      if (!original) fail(404, "Payment not found");
      const invoice = await invoiceBalance(db, agencyId, original.invoice_id);
      if (invoice.status === "VOID") fail(409, "A void invoice cannot be changed");
      const payment = (await db.query("SELECT * FROM node_manual_invoice_payments WHERE id=$1 AND agency_id=$2 FOR UPDATE", [id.data, agencyId])).rows[0];
      if (payment.reversed_at) fail(409, "This payment has already been reversed");
      await db.query(`UPDATE node_manual_invoice_payments SET reversed_at=CURRENT_TIMESTAMP,reversed_by=$2,reversal_reason=$3
        WHERE id=$1 AND agency_id=$4`, [id.data, req.user.id, input.data.reason, agencyId]);
      if (invoice.status === "PAID" && invoice.totalPence - invoice.paidPence + Number(payment.amount_pence) - invoice.creditedPence > 0)
        await db.query("UPDATE node_finance_documents SET status='ISSUED',updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND agency_id=$2", [invoice.id, agencyId]);
      await db.query(`INSERT INTO node_finance_history(id,agency_id,actor_id,subject_id,action,snapshot)
        VALUES($1,$2,$3,$4,'MANUAL_PAYMENT_REVERSED',$5)`,
      [randomUUID(), agencyId, req.user.id, invoice.id, JSON.stringify({ paymentId: id.data, reason: input.data.reason })]);
    });
    return reply(res, {}, "Manual payment reversed");
  });

  route("POST", "/api/accounting/reconciliation/matches", async (req, res) => {
    const agencyId = requireAgency(req);
    const input = z.object({ invoiceId: z.uuid(), transactionId: z.string().regex(/^\d{1,30}$/) }).safeParse(req.body);
    if (!input.success) fail(400, "Choose an invoice and bank transaction");
    const { invoiceId, transactionId } = input.data;
    const paymentId = await db.transaction(async () => {
      const tx = (await db.query(`SELECT * FROM node_bank_transactions
        WHERE agency_id=$1 AND provider_transaction_id=$2 FOR UPDATE`, [agencyId, transactionId])).rows[0];
      if (!tx) fail(404, "Bank transaction not found. Refresh bank data.");
      if (tx.is_sandbox) fail(409, "Test-bank transactions cannot settle live invoices");
      if (tx.currency !== "GBP" || Number(tx.amount_pence) <= 0) fail(400, "Choose an incoming GBP payment");
      const alreadyMatched = (await db.query(`SELECT id FROM node_invoice_payments
        WHERE agency_id=$1 AND provider_transaction_id=$2 AND reversed_at IS NULL`, [agencyId, transactionId])).rows[0];
      if (alreadyMatched) fail(409, "This bank transaction has already been matched");
      const invoice = await invoiceBalance(db, agencyId, invoiceId);
      if (!["ISSUED", "PAID"].includes(invoice.status)) fail(409, "Only issued invoices can receive a bank payment");
      if (Number(tx.amount_pence) > invoice.outstandingPence)
        fail(409, "The bank payment exceeds this invoice's outstanding balance. Review the payment before matching.");
      const id = randomUUID();
      await db.query(`INSERT INTO node_invoice_payments
        (id,agency_id,invoice_id,provider_transaction_id,amount_pence,paid_on,reference,created_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, agencyId, invoiceId, transactionId, tx.amount_pence, tx.booked_on, tx.description, req.user.id]);
      if (Number(tx.amount_pence) === invoice.outstandingPence)
        await db.query("UPDATE node_finance_documents SET status='PAID',updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND agency_id=$2", [invoiceId, agencyId]);
      await db.query(`INSERT INTO node_finance_history
        (id,agency_id,actor_id,subject_id,action,snapshot)
        VALUES($1,$2,$3,$4,'BANK_PAYMENT_MATCHED',$5)`,
      [randomUUID(), agencyId, req.user.id, invoiceId,
        JSON.stringify({ paymentId: id, transactionId, amountPence: Number(tx.amount_pence) })]);
      return id;
    });
    return reply(res, { id: paymentId }, "Bank payment matched to invoice", 201);
  });

  route("POST", "/api/accounting/reconciliation/matches/:id/reverse", async (req, res) => {
    const agencyId = requireAgency(req);
    const parsed = z.object({ reason: z.string().trim().min(5).max(500) }).safeParse(req.body);
    if (!parsed.success) fail(400, "Explain why this match is being reversed");
    const matchId = z.uuid().safeParse(req.params.id);
    if (!matchId.success) fail(400, "Invalid payment match");
    await db.transaction(async () => {
      const original = (await db.query(`SELECT provider_transaction_id,invoice_id FROM node_invoice_payments
        WHERE id=$1 AND agency_id=$2`, [matchId.data, agencyId])).rows[0];
      if (!original) fail(404, "Payment match not found");
      await db.query(`SELECT provider_transaction_id FROM node_bank_transactions
        WHERE agency_id=$1 AND provider_transaction_id=$2 FOR UPDATE`, [agencyId, original.provider_transaction_id]);
      const payment = (await db.query(`SELECT * FROM node_invoice_payments
        WHERE id=$1 AND agency_id=$2 FOR UPDATE`, [matchId.data, agencyId])).rows[0];
      if (payment.reversed_at) fail(409, "This match has already been reversed");
      const invoice = await invoiceBalance(db, agencyId, payment.invoice_id);
      if (invoice.status === "VOID") fail(409, "A void invoice cannot be changed");
      await db.query(`UPDATE node_invoice_payments SET reversed_at=CURRENT_TIMESTAMP,
        reversed_by=$2,reversal_reason=$3 WHERE id=$1`, [payment.id, req.user.id, parsed.data.reason]);
      if (invoice.status === "PAID" && Number(invoice.totalPence) -
        (invoice.paidPence - Number(payment.amount_pence)) - invoice.creditedPence > 0)
        await db.query("UPDATE node_finance_documents SET status='ISSUED',updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND agency_id=$2", [invoice.id, agencyId]);
      await db.query(`INSERT INTO node_finance_history
        (id,agency_id,actor_id,subject_id,action,snapshot)
        VALUES($1,$2,$3,$4,'BANK_PAYMENT_REVERSED',$5)`,
      [randomUUID(), agencyId, req.user.id, invoice.id,
        JSON.stringify({ paymentId: payment.id, transactionId: payment.provider_transaction_id, reason: parsed.data.reason })]);
    });
    return reply(res, {}, "Bank payment match reversed");
  });
}
