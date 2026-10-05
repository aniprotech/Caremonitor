import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { openDatabase, initializeSchema } from "../src/db.js";
import { createApp } from "../src/app.js";
import { matchesInvoiceReference } from "../src/services/invoice-reconciliation.js";

test("invoice references require a whole invoice number", () => {
  assert.equal(matchesInvoiceReference("Payment INV-00042 thanks", 42), true);
  assert.equal(matchesInvoiceReference("Payment INV-000420", 42), false);
  assert.equal(matchesInvoiceReference("Payment INV-00042X", 42), false);
  assert.equal(matchesInvoiceReference("Payment 00042", 42), false);
});

test("bank payments are imported once, matched by an admin, and reversible within one organisation", async () => {
  const db = await openDatabase({ driver: "pglite", dataDir: ":memory:" });
  const oldFetch = global.fetch;
  try {
    await initializeSchema(db);
    const sent = [], agencyA = randomUUID(), agencyB = randomUUID();
    for (const id of [agencyA, agencyB]) await db.query(`INSERT INTO node_agencies
      (id,name,business_type,phone,address_line1,city,postcode,country,timezone,terms_accepted_at)
      VALUES($1,'Test care','HOME_CARE','01234567890','1 Road','London','SW1A 1AA','United Kingdom','Europe/London',CURRENT_TIMESTAMP)`, [id]);
    const app = createApp({ db, config: { production: false,
      jwtSecret: "payment-test-secret-at-least-32-characters", frontendUrl: "http://localhost:5173",
      corsOrigins: [], uploadDir: "./test-uploads", saltEdgeAppId: "test-app",
      saltEdgeSecret: "test-secret", saltEdgeCallbackUri: "http://localhost:9000/api/accounting/banking/salt-edge/callback",
    }, mail: { send: async (mail) => sent.push(mail) } });
    const { repo, auth } = app.locals.ctx;
    async function owner(name, agencyId) {
      const user = await repo.save("UserEntity", { firstName: name, lastName: "Owner",
        email: `${name}@test.example`, role: "SUPERADMIN", isActive: true, agencyId });
      await auth.requestLink(user.email);
      const url = sent.at(-1).text.match(/http[^\s]+/)[0];
      const [email, password] = Buffer.from(new URL(url).searchParams.get("token"), "base64url").toString().split(":");
      return { user, token: (await auth.exchange(email, password)).accessToken };
    }
    const a = await owner("financeA", agencyA), b = await owner("financeB", agencyB);
    const client = await repo.save("UserEntity", { firstName: "Client", lastName: "One",
      email: "finance-client@test.example", role: "USER", isActive: true, agencyId: agencyA });
    const invoice1 = randomUUID(), invoice2 = randomUUID(), legacyPaid = randomUUID(), manualInvoice = randomUUID();
    for (const [id, number, total, status] of [[invoice1, 1, 5000, "ISSUED"], [invoice2, 2, 1000, "ISSUED"], [legacyPaid, 3, 1000, "PAID"], [manualInvoice, 4, 1500, "ISSUED"]])
      await db.query(`INSERT INTO node_finance_documents
        (id,agency_id,kind,number,recipient_id,recipient_name,from_date,to_date,total_pence,status,created_by)
        VALUES($1,$2,'INVOICE',$3,$4,'Client One','2026-10-01','2026-10-01',$5,$6,$7)`,
      [id, agencyA, number, client.id, total, status, a.user.id]);
    await db.query("INSERT INTO node_salt_edge_customers(agency_id,customer_id) VALUES($1,'101')", [agencyA]);
    global.fetch = async (url) => {
      const path = new URL(String(url)).pathname;
      if (path === "/api/v6/connections") return Response.json({ data: [{ id: "201", customer_id: "101", status: "active", provider_name: "Test UK Bank", provider_code: "test_uk_bank_gb", country_code: "GB" }], meta: {} });
      if (path === "/api/v6/accounts") return Response.json({ data: [{ id: "301", connection_id: "201", name: "Current", currency_code: "GBP" }], meta: {} });
      if (path === "/api/v6/transactions") return Response.json({ data: [
        { id: "401", account_id: "301", amount: 20, currency_code: "GBP", made_on: "2026-10-02", description: "INV-00001 part", duplicated: false },
        { id: "402", account_id: "301", amount: 30, currency_code: "GBP", made_on: "2026-10-03", description: "INV-00001 balance", duplicated: false },
        { id: "403", account_id: "301", amount: 10, currency_code: "GBP", made_on: "2026-10-03", description: "INV-00002", duplicated: false },
        { id: "404", account_id: "301", amount: -5, currency_code: "GBP", made_on: "2026-10-03", description: "debit", duplicated: false },
        { id: "405", account_id: "301", amount: 10, currency_code: "GBP", made_on: "2026-10-03", description: "INV-00003", duplicated: false },
      ], meta: {} });
      throw new Error(`Unexpected Salt Edge path ${path}`);
    };
    const call = (method, path, token, body) => request(app)[method](path).set("Authorization", `Bearer ${token}`).send(body || {});
    const manualInput = { invoiceId: manualInvoice, amountPence: 1500, receivedOn: "2026-10-03",
      method: "BANK_TRANSFER", reference: "Bank statement 123", note: "Confirmed against statement" };
    assert.equal((await call("post", "/api/accounting/reconciliation/manual-payments", b.token, manualInput)).status, 404);
    assert.equal((await call("post", "/api/accounting/reconciliation/manual-payments", a.token,
      { ...manualInput, amountPence: 1501 })).status, 409);
    const manualRecorded = await call("post", "/api/accounting/reconciliation/manual-payments", a.token, manualInput);
    assert.equal(manualRecorded.status, 201, JSON.stringify(manualRecorded.body));
    assert.equal((await call("get", "/api/accounting/reconciliation", a.token)).body.results.data
      .invoices.find(i => i.id === manualInvoice).paymentStatus, "PAID");
    assert.equal((await call("get", "/api/accounting/reconciliation", a.token)).body.results.data
      .payments.find(p => p.id === manualRecorded.body.results.data.id).source, "MANUAL");
    assert.equal((await call("post", `/api/accounting/reconciliation/manual-payments/${manualRecorded.body.results.data.id}/reverse`, b.token,
      { reason: "Wrong payment" })).status, 404);
    assert.equal((await call("post", `/api/accounting/reconciliation/manual-payments/${manualRecorded.body.results.data.id}/reverse`, a.token,
      { reason: "Wrong payment" })).status, 200);
    assert.equal((await call("get", "/api/accounting/reconciliation", a.token)).body.results.data
      .invoices.find(i => i.id === manualInvoice).paymentStatus, "UNPAID");
    const firstSync = await call("post", "/api/accounting/reconciliation/sync", a.token);
    assert.equal(firstSync.status, 200, JSON.stringify(firstSync.body));
    assert.equal(firstSync.body.results.data.imported, 5);
    assert.equal((await call("post", "/api/accounting/reconciliation/sync", a.token)).body.results.data.imported, 0);
    await db.query(`INSERT INTO node_bank_transactions
      (agency_id,provider_transaction_id,provider_account_id,booked_on,description,amount_pence,is_sandbox)
      VALUES($1,'499','301','2026-10-03','INV-00002 fake payment',1000,true)`, [agencyA]);
    assert.equal((await call("post", "/api/accounting/reconciliation/matches", a.token,
      { invoiceId: invoice2, transactionId: "499" })).status, 409);
    const before = (await call("get", "/api/accounting/reconciliation", a.token)).body.results.data;
    assert.equal(before.transactions.find(t => t.id === "403").suggestedInvoiceId, invoice2);
    assert.equal(before.invoices.find(i => i.id === legacyPaid).paymentStatus, "UNVERIFIED_PAID");
    assert.equal(before.transactions.find(t => t.id === "405").suggestedInvoiceId, legacyPaid);
    assert.equal(before.transactions.find(t => t.id === "401").suggestedInvoiceId, null);
    assert.equal((await call("post", "/api/accounting/reconciliation/matches", b.token,
      { invoiceId: invoice1, transactionId: "401" })).status, 404);
    assert.equal((await call("post", "/api/accounting/reconciliation/matches", a.token,
      { invoiceId: invoice1, transactionId: "404" })).status, 400);
    const partial = await call("post", "/api/accounting/reconciliation/matches", a.token,
      { invoiceId: invoice1, transactionId: "401" });
    assert.equal(partial.status, 201, JSON.stringify(partial.body));
    assert.equal((await call("post", "/api/accounting/reconciliation/matches", a.token,
      { invoiceId: invoice2, transactionId: "401" })).status, 409);
    const middle = (await call("get", "/api/accounting/reconciliation", a.token)).body.results.data;
    assert.equal(middle.invoices.find(i => i.id === invoice1).paymentStatus, "PART_PAID");
    assert.equal(middle.invoices.find(i => i.id === invoice1).outstandingPence, 3000);
    assert.equal((await call("post", "/api/accounting/reconciliation/matches", a.token,
      { invoiceId: invoice1, transactionId: "402" })).status, 201);
    assert.equal((await call("post", "/api/accounting/reconciliation/matches", a.token,
      { invoiceId: legacyPaid, transactionId: "405" })).status, 201);
    const paid = (await call("get", "/api/accounting/reconciliation", a.token)).body.results.data;
    assert.equal(paid.invoices.find(i => i.id === invoice1).paymentStatus, "PAID");
    assert.equal((await call("get", `/api/finance/documents/${invoice1}`, a.token)).body.results.data.status, "PAID");
    const reversal = await call("post", `/api/accounting/reconciliation/matches/${partial.body.results.data.id}/reverse`, a.token,
      { reason: "Matched to wrong bank entry" });
    assert.equal(reversal.status, 200, JSON.stringify(reversal.body));
    const reopened = (await call("get", "/api/accounting/reconciliation", a.token)).body.results.data;
    assert.equal(reopened.invoices.find(i => i.id === invoice1).paymentStatus, "PART_PAID");
    assert.equal((await call("get", `/api/finance/documents/${invoice1}`, a.token)).body.results.data.status, "ISSUED");
    assert.equal((await call("post", `/api/finance/documents/${invoice1}/status`, a.token,
      { expectedStatus: "ISSUED", status: "VOID" })).status, 409);
    const creditId = randomUUID();
    await db.query(`INSERT INTO node_credit_notes
      (id,agency_id,invoice_id,number,reason,total_pence,status,created_by)
      VALUES($1,$2,$3,1,'Service correction',2000,'ISSUED',$4)`,
    [creditId, agencyA, invoice1, a.user.id]);
    assert.equal((await call("post", `/api/finance/credit-notes/${creditId}/status`, a.token,
      { expectedStatus: "ISSUED", status: "APPLIED" })).status, 200);
    const credited = (await call("get", "/api/accounting/reconciliation", a.token)).body.results.data;
    assert.equal(credited.invoices.find(i => i.id === invoice1).paymentStatus, "PAID");
    assert.equal(credited.invoices.find(i => i.id === invoice1).creditedPence, 2000);
    assert.equal((await call("post", `/api/finance/documents/${invoice1}/status`, a.token,
      { expectedStatus: "PAID", status: "VOID" })).status, 400);
    assert.equal((await call("post", `/api/accounting/reconciliation/matches/${partial.body.results.data.id}/reverse`, a.token,
      { reason: "Repeat reversal" })).status, 409);
    assert.equal((await call("post", `/api/finance/documents/${invoice2}/status`, a.token,
      { expectedStatus: "ISSUED", status: "PAID" })).status, 409);
    assert.equal((await call("get", "/api/accounting/reconciliation", b.token)).body.results.data.invoices.length, 0);
  } finally { global.fetch = oldFetch; await db.close(); }
});
