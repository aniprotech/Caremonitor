import { randomUUID } from "node:crypto";
import { z } from "zod";
import { reply, fail, uuid } from "../http.js";
import { dateRange } from "./activity.js";
export const roundCharge = (minutes, pence) =>
  Math.floor((minutes * pence + 30) / 60);
export function registerFinance({ db, repo, auth }, route) {
  async function lock(req) {
    await db.query(
      "SELECT id FROM users WHERE agency_id=$1 ORDER BY id FOR UPDATE",
      [req.user.agencyId],
    );
  }
  async function recipient(req, id, kind) {
    const u = await auth.userAccess(req, uuid(id));
    if ((kind === "INVOICE") !== (u.role === "USER"))
      fail(400, "Select a matching client or staff member");
    return u;
  }
  async function preview(req, query) {
    const { from, to } = dateRange(query),
      kind = query.kind;
    if (!["INVOICE", "PAYRUN"].includes(kind))
      fail(400, "Choose invoices or staff pay");
    const user = await recipient(req, query.recipientId, kind),
      rateKind = kind === "INVOICE" ? "BILLING" : "PAY";
    const { rows } = await db.query(
      `SELECT v.id AS "visitId",v.visit_date::text AS date,v.title,
      review.minutes AS minutes,v.revision AS "visitRevision",review.revision AS "reviewRevision",
      (SELECT hourly_pence FROM node_rates r WHERE r.user_id=$2 AND r.agency_id=$1 AND r.kind=$5 AND r.effective_from<=v.visit_date ORDER BY effective_from DESC LIMIT 1) AS "hourlyPence"
      FROM node_roster_visits v JOIN node_finance_reviews review ON review.visit_id=v.id AND review.kind=$5 AND review.state='CONFIRMED' AND review.visit_revision=v.revision WHERE v.agency_id=$1 AND ${kind === "INVOICE" ? "v.client_id" : "v.staff_id"}=$2 AND v.status='COMPLETED'
      AND v.visit_date BETWEEN $3 AND $4 AND NOT EXISTS(SELECT 1 FROM node_finance_lines l WHERE l.visit_id=v.id AND l.kind=$6 AND l.released=false)
      ORDER BY v.visit_date,v.start_time,v.id`,
      [req.user.agencyId, user.id, from, to, rateKind, kind],
    );
    const lines = rows.map((r) => ({
      ...r,
      component:"CARE",
      amountPence:
        r.hourlyPence === null ? null : roundCharge(r.minutes, r.hourlyPence),
    }));
    if(kind==="PAYRUN"&&rows.length){const travel=(await db.query(`SELECT t.visit_id AS "visitId",t.miles,t.minutes,t.revision AS "travelRevision",v.visit_date::text AS date,v.title,v.revision AS "visitRevision",review.revision AS "reviewRevision",
      (SELECT mileage_pence FROM node_travel_rates r WHERE r.user_id=$2 AND r.agency_id=$1 AND r.effective_from<=v.visit_date ORDER BY effective_from DESC LIMIT 1) AS "mileagePence",
      (SELECT hourly_pence FROM node_travel_rates r WHERE r.user_id=$2 AND r.agency_id=$1 AND r.effective_from<=v.visit_date ORDER BY effective_from DESC LIMIT 1) AS "travelHourlyPence"
      FROM node_visit_travel t JOIN node_roster_visits v ON v.id=t.visit_id JOIN node_finance_reviews review ON review.visit_id=v.id AND review.kind='PAY' AND review.state='CONFIRMED' AND review.visit_revision=v.revision
      WHERE t.agency_id=$1 AND t.staff_id=$2 AND v.visit_date BETWEEN $3 AND $4 AND v.status='COMPLETED'
      AND NOT EXISTS(SELECT 1 FROM node_finance_lines l WHERE l.visit_id=v.id AND l.kind='PAYRUN' AND l.component IN ('MILEAGE','TRAVEL_TIME') AND l.released=false)`,[req.user.agencyId,user.id,from,to])).rows;
      for(const t of travel){if(Number(t.miles)>0)lines.push({...t,component:"MILEAGE",title:`Mileage - ${t.title}`,minutes:0,hourlyPence:t.mileagePence,amountPence:t.mileagePence==null?null:Math.round(Number(t.miles)*Number(t.mileagePence))});if(Number(t.minutes)>0)lines.push({...t,component:"TRAVEL_TIME",title:`Travel time - ${t.title}`,hourlyPence:t.travelHourlyPence,amountPence:t.travelHourlyPence==null?null:roundCharge(Number(t.minutes),Number(t.travelHourlyPence))});}
    }
    return {
      kind,
      recipientId: user.id,
      recipientName: user.firstName + " " + user.lastName,
      from,
      to,
      lines,
      missingRates: lines.filter((l) => l.hourlyPence === null).length,
      totalPence: lines.reduce((sum, l) => sum + (l.amountPence || 0), 0),
      currency: "GBP",
    };
  }
  const docSelect = `SELECT id,kind,number,recipient_id AS "recipientId",recipient_name AS "recipientName",from_date::text AS "from",to_date::text AS "to",total_pence AS "totalPence",status,created_at AS "createdAt",
    (COALESCE((SELECT sum(p.amount_pence) FROM node_invoice_payments p
      WHERE p.invoice_id=node_finance_documents.id AND p.agency_id=node_finance_documents.agency_id
      AND p.reversed_at IS NULL),0)+COALESCE((SELECT sum(m.amount_pence) FROM node_manual_invoice_payments m
      WHERE m.invoice_id=node_finance_documents.id AND m.agency_id=node_finance_documents.agency_id
      AND m.reversed_at IS NULL),0))::bigint AS "paidPence",
    COALESCE((SELECT sum(c.total_pence) FROM node_credit_notes c
      WHERE c.invoice_id=node_finance_documents.id AND c.agency_id=node_finance_documents.agency_id
      AND c.status='APPLIED'),0)::bigint AS "creditedPence"
    FROM node_finance_documents`;
  async function reconciliation(req,id){const d=(await db.query("SELECT * FROM node_finance_documents WHERE id=$1 AND agency_id=$2",[id,req.user.agencyId])).rows[0];if(!d)fail(404,"Document not found");const lines=(await db.query(`SELECT l.id,l.amount_pence,l.component,l.visit_revision,l.review_revision,l.travel_revision,v.revision current_visit_revision,r.revision current_review_revision,t.revision current_travel_revision
    FROM node_finance_lines l JOIN node_roster_visits v ON v.id=l.visit_id LEFT JOIN node_finance_reviews r ON r.visit_id=v.id AND r.kind=CASE WHEN l.kind='INVOICE' THEN 'BILLING' ELSE 'PAY' END LEFT JOIN node_visit_travel t ON t.visit_id=v.id WHERE l.document_id=$1`,[id])).rows;const lineTotal=lines.reduce((sum,l)=>sum+Number(l.amount_pence),0),sourcesMatch=lines.every(l=>Number(l.visit_revision)===Number(l.current_visit_revision)&&Number(l.review_revision)===Number(l.current_review_revision)&&(!['MILEAGE','TRAVEL_TIME'].includes(l.component)||Number(l.travel_revision)===Number(l.current_travel_revision)));return {documentId:id,documentTotalPence:Number(d.total_pence),lineTotalPence:lineTotal,totalMatches:Number(d.total_pence)===lineTotal,sourcesMatch,balanced:Number(d.total_pence)===lineTotal&&sourcesMatch,lineCount:lines.length};}
  route("GET", "/api/finance/options", async (req, res) => {
    auth.admin(req);
    const people = await repo.find(
      "UserEntity",
      { agencyId: req.user.agencyId },
      { collections: false },
    );
    return reply(res, {
      people: people
        .filter((p) => !p.deletedAt)
        .map((p) => ({
          id: p.id,
          name: p.firstName + " " + p.lastName,
          isClient: p.role === "USER",
        })),
      currency: "GBP",
    });
  });
  route("GET", "/api/finance/rates", async (req, res) => {
    auth.admin(req);
    return reply(
      res,
      (
        await db.query(
          `SELECT r.id,r.user_id AS "userId",r.kind,r.effective_from::text AS "effectiveFrom",r.hourly_pence AS "hourlyPence",u.first_name||' '||u.last_name AS name
      FROM node_rates r JOIN users u ON u.id=r.user_id WHERE r.agency_id=$1 ORDER BY r.effective_from DESC,u.first_name`,
          [req.user.agencyId],
        )
      ).rows,
    );
  });
  route("POST", "/api/finance/rates", async (req, res) => {
    auth.admin(req);
    const p = z
      .object({
        userId: z.uuid(),
        kind: z.enum(["BILLING", "PAY"]),
        effectiveFrom: z.string(),
        hourlyPence: z.number().int().min(0).max(1000000),
      })
      .safeParse(req.body);
    if (!p.success)
      fail(400, "Enter a person, effective date and valid hourly rate");
    const b = p.data;
    dateRange({ from: b.effectiveFrom, to: b.effectiveFrom });
    await recipient(req, b.userId, b.kind === "BILLING" ? "INVOICE" : "PAYRUN");
    await lock(req);
    await db.query(
      `INSERT INTO node_rates(id,agency_id,user_id,kind,effective_from,hourly_pence) VALUES($1,$2,$3,$4,$5,$6)
      ON CONFLICT(user_id,kind,effective_from) DO UPDATE SET hourly_pence=EXCLUDED.hourly_pence`,
      [
        randomUUID(),
        req.user.agencyId,
        b.userId,
        b.kind,
        b.effectiveFrom,
        b.hourlyPence,
      ],
    );
    await db.query("INSERT INTO node_finance_history(id,agency_id,actor_id,subject_id,action,snapshot) VALUES($1,$2,$3,$4,'RATE_SAVED',$5)",[randomUUID(),req.user.agencyId,req.user.id,b.userId,JSON.stringify(b)]);
    return reply(res, {}, "Rate saved");
  });
  route("GET", "/api/finance/preview", async (req, res) => {
    auth.admin(req);
    return reply(res, await preview(req, req.query));
  });
  route("POST", "/api/finance/documents", async (req, res) => {
    auth.admin(req);
    await lock(req);
    const p = await preview(req, req.body);
    if (!p.lines.length)
      fail(400, "Confirm completed visits for this period before creating a document");
    if (p.missingRates)
      fail(
        400,
        "Set effective hourly rates for every visit before creating this document",
      );
    if (p.totalPence > 2000000000) fail(400, "Choose a smaller billing period");
    const number = (
        await db.query(
          "SELECT COALESCE(max(number),0)+1 AS next FROM node_finance_documents WHERE agency_id=$1 AND kind=$2",
          [req.user.agencyId, p.kind],
        )
      ).rows[0].next,
      id = randomUUID();
    await db.query(
      `INSERT INTO node_finance_documents(id,agency_id,kind,number,recipient_id,recipient_name,from_date,to_date,total_pence,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        id,
        req.user.agencyId,
        p.kind,
        number,
        p.recipientId,
        p.recipientName,
        p.from,
        p.to,
        p.totalPence,
        req.user.id,
      ],
    );
    for (const l of p.lines)
      await db.query(
        "INSERT INTO node_finance_lines(id,document_id,visit_id,kind,visit_date,title,minutes,hourly_pence,amount_pence,component,visit_revision,review_revision,travel_revision) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
        [
          randomUUID(),
          id,
          l.visitId,
          p.kind,
          l.date,
          l.title,
          l.minutes,
          l.hourlyPence,
          l.amountPence,
          l.component,
          l.visitRevision,
          l.reviewRevision,
          l.travelRevision||null,
        ],
      );
    return reply(res, { id }, "Draft created", 201);
  });
  route("GET", "/api/finance/documents", async (req, res) => {
    auth.admin(req);
    const { from, to } = dateRange(req.query);
    const kind = req.query.kind || "INVOICE";
    if (!["INVOICE", "PAYRUN"].includes(kind))
      fail(400, "Invalid document type");
    return reply(
      res,
      (
        await db.query(
          docSelect +
            " WHERE agency_id=$1 AND kind=$2 AND from_date<=$4 AND to_date>=$3 ORDER BY number DESC",
          [req.user.agencyId, kind, from, to],
        )
      ).rows,
    );
  });
  route("GET", "/api/finance/documents/:id", async (req, res) => {
    auth.admin(req);
    const d = (
      await db.query(docSelect + " WHERE id=$1 AND agency_id=$2", [
        req.params.id,
        req.user.agencyId,
      ])
    ).rows[0];
    if (!d) fail(404, "Document not found");
    d.lines = (
      await db.query(
        'SELECT id,visit_id AS "visitId",visit_date::text AS date,title,component,minutes,hourly_pence AS "hourlyPence",amount_pence AS "amountPence" FROM node_finance_lines WHERE document_id=$1 ORDER BY visit_date,component,id',
        [d.id],
      )
    ).rows;
    return reply(res, d);
  });
  route("POST", "/api/finance/documents/:id/status", async (req, res) => {
    auth.admin(req);
    await lock(req);
    const d = (
      await db.query(
        "SELECT * FROM node_finance_documents WHERE id=$1 AND agency_id=$2 FOR UPDATE",
        [req.params.id, req.user.agencyId],
      )
    ).rows[0];
    if (!d) fail(404, "Document not found");
    const next = req.body.status;
    if (req.body.expectedStatus !== d.status)
      fail(409, "This document changed. Refresh before updating");
    const approved = d.kind === "INVOICE" ? "ISSUED" : "APPROVED";
    const allowed = {
      DRAFT: [approved, "VOID"],
      [approved]: ["PAID", "VOID"],
      PAID: [],
      VOID: [],
    };
    if (!allowed[d.status]?.includes(next))
      fail(400, "This status change is not allowed");
    if (d.kind === "INVOICE" && next === "PAID")
      fail(409, "Confirm a bank match or record an evidenced manual payment in Accounting before marking an invoice paid");
    if (d.kind === "INVOICE" && next === "VOID") {
      const matched = (await db.query(`SELECT id FROM node_invoice_payments
        WHERE agency_id=$1 AND invoice_id=$2 AND reversed_at IS NULL
        UNION ALL SELECT id FROM node_manual_invoice_payments
        WHERE agency_id=$1 AND invoice_id=$2 AND reversed_at IS NULL LIMIT 1`,
      [req.user.agencyId, d.id])).rows[0];
      if (matched) fail(409, "Reverse recorded payments before voiding this invoice");
    }
    if(next===approved){const check=await reconciliation(req,d.id);if(!check.balanced)fail(409,"Document no longer reconciles to its confirmed visit revisions. Void it and create a new draft.");}
    await db.query(
      "UPDATE node_finance_documents SET status=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1",
      [d.id, next],
    );
    if (next === "VOID")
      await db.query(
        "UPDATE node_finance_lines SET released=true WHERE document_id=$1",
        [d.id],
      );
    await db.query("INSERT INTO node_finance_history(id,agency_id,actor_id,subject_id,action,snapshot) VALUES($1,$2,$3,$4,'DOCUMENT_STATUS_CHANGED',$5)",[randomUUID(),req.user.agencyId,req.user.id,d.id,JSON.stringify({before:d.status,after:next})]);
    return reply(res, {}, "Document updated");
  });
  route("GET","/api/finance/documents/:id/reconcile",async(req,res)=>{auth.admin(req);return reply(res,await reconciliation(req,req.params.id))});
  route("POST","/api/finance/documents/:id/export",async(req,res)=>{auth.admin(req);const check=await reconciliation(req,req.params.id),d=(await db.query(docSelect+" WHERE id=$1 AND agency_id=$2",[req.params.id,req.user.agencyId])).rows[0];if(!d)fail(404,"Document not found");const lines=(await db.query('SELECT visit_date::text AS date,title,component,minutes,hourly_pence AS "hourlyPence",amount_pence AS "amountPence" FROM node_finance_lines WHERE document_id=$1 ORDER BY visit_date,component,id',[d.id])).rows;await db.query("INSERT INTO node_finance_history(id,agency_id,actor_id,subject_id,action,snapshot) VALUES($1,$2,$3,$4,'DOCUMENT_EXPORTED',$5)",[randomUUID(),req.user.agencyId,req.user.id,d.id,JSON.stringify({format:req.body?.format||"CSV",status:d.status,reconciliation:check})]);return reply(res,{document:d,lines,reconciliation:check},"Export recorded")});
  route("POST","/api/finance/travel",async(req,res)=>{auth.admin(req);const p=z.object({visitId:z.uuid(),miles:z.number().min(0).max(10000),minutes:z.number().int().min(0).max(1440),source:z.enum(["ACTUAL","ESTIMATE"]).default("ACTUAL"),expectedRevision:z.number().int().min(0).default(0)}).safeParse(req.body);if(!p.success)fail(400,"Enter valid visit mileage and travel time");const b=p.data;const v=(await db.query("SELECT * FROM node_roster_visits WHERE id=$1 AND agency_id=$2",[b.visitId,req.user.agencyId])).rows[0];if(!v||v.status!=="COMPLETED"||!v.staff_id)fail(400,"Choose a completed assigned visit");const old=(await db.query("SELECT * FROM node_visit_travel WHERE visit_id=$1",[v.id])).rows[0];if((old?.revision||0)!==b.expectedRevision)fail(409,"Travel changed. Refresh before saving.");if((await db.query("SELECT id FROM node_finance_lines WHERE visit_id=$1 AND kind='PAYRUN' AND released=false",[v.id])).rows.length)fail(409,"Travel is locked in a staff pay document");await db.query(`INSERT INTO node_visit_travel(visit_id,agency_id,staff_id,miles,minutes,source,recorded_by) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(visit_id) DO UPDATE SET miles=EXCLUDED.miles,minutes=EXCLUDED.minutes,source=EXCLUDED.source,revision=node_visit_travel.revision+1,recorded_by=EXCLUDED.recorded_by,updated_at=CURRENT_TIMESTAMP`,[v.id,req.user.agencyId,v.staff_id,b.miles,b.minutes,b.source,req.user.id]);await db.query("INSERT INTO node_finance_history(id,agency_id,actor_id,subject_id,action,snapshot) VALUES($1,$2,$3,$4,'TRAVEL_RECORDED',$5)",[randomUUID(),req.user.agencyId,req.user.id,v.id,JSON.stringify(b)]);return reply(res,{},"Travel saved")});
  route("GET","/api/finance/travel",async(req,res)=>{auth.admin(req);const {from,to}=dateRange(req.query);return reply(res,(await db.query(`SELECT t.visit_id AS "visitId",t.staff_id AS "staffId",t.miles,t.minutes,t.source,t.revision,v.visit_date::text date,v.title,u.first_name||' '||u.last_name name FROM node_visit_travel t JOIN node_roster_visits v ON v.id=t.visit_id JOIN users u ON u.id=t.staff_id WHERE t.agency_id=$1 AND v.visit_date BETWEEN $2 AND $3 ORDER BY v.visit_date,v.start_time`,[req.user.agencyId,from,to])).rows)});
  route("POST","/api/finance/credit-notes",async(req,res)=>{auth.admin(req);const p=z.object({invoiceId:z.uuid(),reason:z.string().trim().min(5).max(1000),lines:z.array(z.object({financeLineId:z.uuid(),amountPence:z.number().int().positive()})).min(1).max(500)}).safeParse(req.body);if(!p.success)fail(400,"Enter an invoice, reason and valid credit lines");const b=p.data;const result=await db.transaction(async()=>{await lock(req);const invoice=(await db.query("SELECT * FROM node_finance_documents WHERE id=$1 AND agency_id=$2 AND kind='INVOICE' FOR UPDATE",[b.invoiceId,req.user.agencyId])).rows[0];if(!invoice||!['ISSUED','PAID'].includes(invoice.status))fail(400,"Choose an issued or paid invoice");const ids=b.lines.map(x=>x.financeLineId);if(new Set(ids).size!==ids.length)fail(400,"Choose each invoice line once");const source=(await db.query("SELECT * FROM node_finance_lines WHERE document_id=$1 AND id=ANY($2::uuid[])",[invoice.id,ids])).rows;if(source.length!==ids.length)fail(400,"A credit line does not belong to this invoice");const already=(await db.query("SELECT COALESCE(sum(total_pence),0)::int total FROM node_credit_notes WHERE invoice_id=$1 AND status<>'VOID'",[invoice.id])).rows[0].total,creditedByLine=(await db.query(`SELECT l.finance_line_id,sum(l.amount_pence)::int total FROM node_credit_note_lines l JOIN node_credit_notes c ON c.id=l.credit_note_id WHERE c.invoice_id=$1 AND c.status<>'VOID' GROUP BY l.finance_line_id`,[invoice.id])).rows;let total=0;for(const line of b.lines){const original=source.find(x=>x.id===line.financeLineId),lineAlready=Number(creditedByLine.find(x=>x.finance_line_id===line.financeLineId)?.total||0);if(lineAlready+line.amountPence>Number(original.amount_pence))fail(409,"Credits cannot exceed an original invoice line");total+=line.amountPence;}if(Number(already)+total>Number(invoice.total_pence))fail(409,"Credits cannot exceed the invoice total");const number=(await db.query("SELECT COALESCE(max(number),0)+1 next FROM node_credit_notes WHERE agency_id=$1",[req.user.agencyId])).rows[0].next,id=randomUUID();await db.query("INSERT INTO node_credit_notes(id,agency_id,invoice_id,number,reason,total_pence,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)",[id,req.user.agencyId,invoice.id,number,b.reason,total,req.user.id]);for(const line of b.lines){const original=source.find(x=>x.id===line.financeLineId);await db.query("INSERT INTO node_credit_note_lines(id,credit_note_id,finance_line_id,description,amount_pence) VALUES($1,$2,$3,$4,$5)",[randomUUID(),id,original.id,original.title,line.amountPence]);}await db.query("INSERT INTO node_finance_history(id,agency_id,actor_id,subject_id,action,snapshot) VALUES($1,$2,$3,$4,'CREDIT_NOTE_CREATED',$5)",[randomUUID(),req.user.agencyId,req.user.id,id,JSON.stringify({invoiceId:invoice.id,totalPence:total,reason:b.reason})]);return id});return reply(res,{id:result},"Credit note draft created",201)});
  route("GET","/api/finance/credit-notes",async(req,res)=>{auth.admin(req);return reply(res,(await db.query(`SELECT c.id,c.number,c.invoice_id AS "invoiceId",d.number AS "invoiceNumber",c.reason,c.total_pence AS "totalPence",c.status,c.created_at AS "createdAt" FROM node_credit_notes c JOIN node_finance_documents d ON d.id=c.invoice_id WHERE c.agency_id=$1 ORDER BY c.number DESC`,[req.user.agencyId])).rows)});
  route("GET","/api/finance/credit-notes/:id",async(req,res)=>{auth.admin(req);const c=(await db.query(`SELECT c.id,c.number,c.invoice_id AS "invoiceId",d.number AS "invoiceNumber",c.reason,c.total_pence AS "totalPence",c.status,c.created_at AS "createdAt" FROM node_credit_notes c JOIN node_finance_documents d ON d.id=c.invoice_id WHERE c.id=$1 AND c.agency_id=$2`,[req.params.id,req.user.agencyId])).rows[0];if(!c)fail(404,"Credit note not found");c.lines=(await db.query('SELECT finance_line_id AS "financeLineId",description,amount_pence AS "amountPence" FROM node_credit_note_lines WHERE credit_note_id=$1 ORDER BY id',[c.id])).rows;return reply(res,c)});
  route("POST", "/api/finance/credit-notes/:id/status", async (req, res) => {
    auth.admin(req);
    await db.transaction(async () => {
      const note = (await db.query("SELECT invoice_id FROM node_credit_notes WHERE id=$1 AND agency_id=$2",
        [req.params.id, req.user.agencyId])).rows[0];
      if (!note) fail(404, "Credit note not found");
      const invoice = (await db.query("SELECT id,total_pence,status FROM node_finance_documents WHERE id=$1 AND agency_id=$2 FOR UPDATE",
        [note.invoice_id, req.user.agencyId])).rows[0];
      if (!invoice || invoice.status === "VOID") fail(409, "Invoice is unavailable");
      const c = (await db.query("SELECT * FROM node_credit_notes WHERE id=$1 AND agency_id=$2 FOR UPDATE",
        [req.params.id, req.user.agencyId])).rows[0];
      if (req.body.expectedStatus !== c.status) fail(409, "This credit note changed. Refresh before updating");
      const allowed = { DRAFT: ["ISSUED", "VOID"], ISSUED: ["APPLIED", "VOID"], APPLIED: [], VOID: [] };
      if (!allowed[c.status]?.includes(req.body.status)) fail(400, "This status change is not allowed");
      await db.query("UPDATE node_credit_notes SET status=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1",
        [c.id, req.body.status]);
      if (req.body.status === "APPLIED" && invoice.status === "ISSUED") {
        const balance = (await db.query(`SELECT
          (COALESCE((SELECT sum(amount_pence) FROM node_invoice_payments WHERE agency_id=$1
            AND invoice_id=$2 AND reversed_at IS NULL),0)+
          COALESCE((SELECT sum(amount_pence) FROM node_manual_invoice_payments WHERE agency_id=$1
            AND invoice_id=$2 AND reversed_at IS NULL),0))::bigint AS paid,
          COALESCE((SELECT sum(total_pence) FROM node_credit_notes WHERE agency_id=$1
            AND invoice_id=$2 AND status='APPLIED'),0)::bigint AS credited`,
        [req.user.agencyId, invoice.id])).rows[0];
        if (Number(balance.paid) > 0 && Number(balance.paid) + Number(balance.credited) >= Number(invoice.total_pence))
          await db.query("UPDATE node_finance_documents SET status='PAID',updated_at=CURRENT_TIMESTAMP WHERE id=$1", [invoice.id]);
      }
      await db.query(`INSERT INTO node_finance_history(id,agency_id,actor_id,subject_id,action,snapshot)
        VALUES($1,$2,$3,$4,'CREDIT_NOTE_STATUS_CHANGED',$5)`,
      [randomUUID(), req.user.agencyId, req.user.id, c.id, JSON.stringify({ before: c.status, after: req.body.status })]);
    });
    return reply(res, {}, "Credit note updated");
  });
}
