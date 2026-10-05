import { randomUUID } from "node:crypto";
import { z } from "zod";
import { fail, reply, uuid } from "../http.js";
import { visitEvent } from "../client-feed-schema.js";
import { occursOn } from "./roster.js";
import { carePlans, careType } from "./care-plans.js";
import { entities } from "../db.js";

const entryInput = z.object({
  clientEventId: z.uuid(),
  kind: z.enum(["NOTE", "ALERT", "ACTIVITY", "OBSERVATION"]),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().max(10000).default(""),
  category: z.string().trim().max(100).default(""),
  status: z.enum(["OPEN", "PENDING", "COMPLETED", "NOT_COMPLETED", "RECORDED"]),
  clinical: z.object({type:z.enum(["BLOOD_PRESSURE","BLOOD_GLUCOSE","WEIGHT","TEMPERATURE","PULSE","OXYGEN_SATURATION","OTHER"]),value:z.string().trim().min(1).max(100)}).optional(),
});
const clinicalUnits={BLOOD_PRESSURE:"mmHg",BLOOD_GLUCOSE:"mmol/L",WEIGHT:"kg",TEMPERATURE:"°C",PULSE:"bpm",OXYGEN_SATURATION:"%",OTHER:""};
function clinicalReading(clinical){
  if(clinical.type==="OTHER")return {text:clinical.value};
  if(clinical.type==="BLOOD_PRESSURE"){
    const match=/^(\d{2,3})\s*\/\s*(\d{2,3})$/.exec(clinical.value);
    if(!match)fail(400,"Enter blood pressure as systolic/diastolic");
    return {systolic:Number(match[1]),diastolic:Number(match[2])};
  }
  if(!/^\d{1,4}(?:\.\d{1,2})?$/.test(clinical.value))fail(400,"Enter a valid measured number");
  return {value:Number(clinical.value)};
}

const medicationAdministrationInput = z.object({
  clientEventId: z.uuid(),
  medicationId: z.uuid(),
  outcome: z.enum(["ADMINISTERED", "PRN_ADMINISTERED", "REFUSED", "NOT_AVAILABLE", "OMITTED"]),
  slot: z.string().trim().min(1).max(80),
  doseGiven: z.string().trim().max(160).default(""),
  reason: z.string().trim().max(500).default(""),
  note: z.string().trim().max(2000).default(""),
  prnEffect: z.string().trim().max(1000).default(""),
  witnessedBy: z.uuid().nullable().default(null),
  quantityGiven: z.number().positive().max(100000).nullable().default(null),
  allergyAcknowledged: z.boolean().default(false),
  bodyMapAcknowledged: z.boolean().default(false),
  occurredAt: z.iso.datetime({ offset: true }),
}).superRefine((value, issue) => {
  if (!["ADMINISTERED", "PRN_ADMINISTERED"].includes(value.outcome) && value.reason.length < 3)
    issue.addIssue({ code: "custom", path: ["reason"], message: "A reason is required when medication is not administered" });
  if (value.outcome === "PRN_ADMINISTERED" && value.note.length < 3)
    issue.addIssue({ code: "custom", path: ["note"], message: "Record why PRN medication was required" });
});

const minutes = (value) => {
  const match = String(value || "").match(/^(\d{2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};
const periods = { Morning: [300, 720], Lunch: [660, 840], Afternoon: [780, 1080], Evening: [1020, 1440] };
function prnDuration(value, unit) {
  const amount=Number(value), multiplier={minutes:60000,hours:3600000,days:86400000,weeks:604800000}[String(unit||"").toLowerCase()];
  return Number.isSafeInteger(amount)&&amount>0&&multiplier&&amount*multiplier<=365*86400000?amount*multiplier:null;
}
async function enforcePrnLimits(db, medication, clientId, occurredAt) {
  const spacing=prnDuration(medication.timeBetweenDoses,medication.timeBetweenUnit);
  const period=prnDuration(medication.maxDosePeriod,medication.maxDoseUnit);
  const maximum=Number(medication.maxDoseCount);
  if(!spacing||!period||!Number.isSafeInteger(maximum)||maximum<1)
    fail(409,"An administrator must configure the PRN minimum interval and maximum number of doses before administration can be recorded");
  const at=new Date(occurredAt).valueOf();
  const administrations=(await db.query(`SELECT a.occurred_at AS "occurredAt" FROM node_medication_administrations a
    WHERE a.client_id=$1 AND a.medication_id=$2 AND a.outcome='PRN_ADMINISTERED'
    AND a.occurred_at BETWEEN $3 AND $4 ORDER BY a.occurred_at`,
    [clientId,medication.id,new Date(at-Math.max(spacing,period)).toISOString(),new Date(at+Math.max(spacing,period)).toISOString()])).rows
    .map((row)=>new Date(row.occurredAt).valueOf());
  if(administrations.some((prior)=>Math.abs(at-prior)<spacing))
    fail(409,"This PRN dose is too close to another recorded administration");
  for(const end of [at,...administrations.filter((time)=>time>at&&time<at+period)]) {
    const count=administrations.filter((time)=>time>end-period&&time<=end).length+(at<=end&&at>end-period?1:0);
    if(count>maximum)fail(409,"This PRN dose would exceed the prescribed maximum for its time period");
  }
}
function proximity(latitude, longitude, address) {
  if (address?.latitude == null || address?.longitude == null) return { distanceMetres:null, withinRadius:null };
  const rad=(value)=>value*Math.PI/180,dLat=rad(latitude-address.latitude),dLon=rad(longitude-address.longitude);
  const value=Math.sin(dLat/2)**2+Math.cos(rad(address.latitude))*Math.cos(rad(latitude))*Math.sin(dLon/2)**2;
  const distanceMetres=Math.round(6371000*2*Math.atan2(Math.sqrt(value),Math.sqrt(1-value)));
  return { distanceMetres, withinRadius:distanceMetres<=Math.max(25,address.checkinRadius||150) };
}
function medicationDueSlots(medication, visit) {
  if (String(medication.type || "").toUpperCase() === "PRN" || medication.frequencyType !== "DAILY") return [];
  if (medication.firstDoseDate && visit.date < medication.firstDoseDate) return [];
  if (medication.lastDoseDate && visit.date > medication.lastDoseDate) return [];
  const start = minutes(visit.startTime), end = minutes(visit.endTime);
  if (start == null || end == null) return [];
  if (medication.timingPreference === "EXACT_TIME")
    return Object.values(medication.exactTimes || {}).map(String).filter((slot) => { const value = minutes(slot); return value != null && value >= start && value <= end; });
  if (medication.timingPreference === "TIME_PERIOD")
    return (medication.selectedTimeSlots || []).filter((slot) => { const range = periods[slot]; return range && start < range[1] && end > range[0]; });
  return [];
}

export function registerMobileCare({ db, repo, auth, files, mail, push }, route) {
  const formatAssessment = (value) => {
    if(Array.isArray(value))return value.map(formatAssessment).filter(Boolean).join(", ");
    if(value && typeof value==="object")return Object.entries(value).map(([key,item])=>`${key.replaceAll("_"," ")}: ${formatAssessment(item)}`).join("; ");
    return String(value ?? "").trim();
  };
  const assessmentWorkflowFields=new Set(["id","createdAt","updatedAt","deletedAt","submittedAt","submittedBy","reviewedAt","reviewedBy","reviewDetails","reviewOutcome","assessmentInprogress","reviewInprogress"]);
  const assessmentLabel=(name)=>name.replaceAll("_"," ").replace(/([a-z])([A-Z])/g,"$1 $2").replace(/\s+/g," ");
  async function clientSafety(clientId) {
    const profile = await repo.one("ClientInformationEntity", { user: clientId });
    const values = profile ? await repo.serialize("ClientInformationEntity", profile, { children: true }) : null;
    return values ? Object.fromEntries([
      "routinesAndPreferences", "allergiesIntolerances", "communicationOrInformationNeeds",
      "carerPreferences", "otherPreferences", "overallRiskLevel", "riskLevelDetails",
      "dislikes", "medicalSupport", "staffingCrisisPlan", "hospitalName", "medicalHistory",
      "gpPracticeName", "gpPracticeIdentifier", "gpName", "gpPhoneNumber", "pharmacyName", "pharmacyPhoneNumber",
      "pharmacyAddress", "pharmacyPostCode", "pharmacyPhoneCode",
    ].map((key) => [key, Array.isArray(values[key]) || typeof values[key] === "boolean" ? values[key] : typeof values[key] === "string" ? values[key].trim() : ""])) : {};
  }
  async function careOverview(clientId) {
    const sections = await Promise.all(Object.entries(carePlans).map(async ([key, name]) => {
      const plan = await repo.one(name, { user: clientId });
      if (!plan) return null;
      const risks = (await repo.find("CarePlanRisksMitigationsEntity", {
        entityId: plan.id, entityType: careType(key), deletedAt: null,
      })).map(({ id, risk, mitigation, riskLevel }) => ({ id, risk, mitigation, riskLevel }));
      const summary = typeof plan.assessmentSummaryOutcomes === "string"
        ? plan.assessmentSummaryOutcomes.trim() : "";
      const association = entities[name].fields.find((field) => field.name === "assessments");
      let assessment = [];
      if (association?.target && association.mappedBy) {
        const records = await repo.find(association.target, { [association.mappedBy]: plan.id });
        const latest = records.filter((record) => record.reviewedAt || record.submittedAt)
          .sort((a, b) => String(b.reviewedAt || b.submittedAt || "").localeCompare(String(a.reviewedAt || a.submittedAt || "")))[0];
        assessment = latest ? entities[association.target].fields
          .filter((field)=>!field.hidden&&!field.audit&&!field.target&&!assessmentWorkflowFields.has(field.name))
          .flatMap((field) => {
          const value = latest[field.name];
          if (value == null || value === "" || value === false) return [];
          const formatted = formatAssessment(value);
          return formatted ? [{ label: assessmentLabel(field.name), value: formatted }] : [];
        }) : [];
      }
      return summary || risks.length || assessment.length ? { key, title: key.replaceAll("-", " "), summary, risks, assessment } : null;
    }));
    return sections.filter(Boolean);
  }
  route("GET", "/api/mobile/announcement", async (req, res) => {
    const row=(await db.query("SELECT carer_app_message AS message,updated_at AS \"updatedAt\" FROM node_agencies WHERE id=$1",[req.user.agencyId])).rows[0];
    return reply(res,{message:row?.message||"",updatedAt:row?.updatedAt||null});
  });
  route("PUT", "/api/mobile/me/profile", async(req,res)=>{
    const parsed=z.object({firstName:z.string().trim().min(2).max(80),lastName:z.string().trim().min(2).max(80),primaryPhone:z.string().trim().max(30).default("")}).safeParse(req.body);
    if(!parsed.success)fail(400,"Enter your name and an optional phone number");
    const b=parsed.data;
    const person=(await db.query(`UPDATE users SET first_name=$3,last_name=$4,primary_phone=$5,
      updated_by=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND agency_id=$2 AND deleted_at IS NULL
      RETURNING id,first_name AS "firstName",last_name AS "lastName",primary_phone AS "primaryPhone",email,role`,
      [req.user.id,req.user.agencyId,b.firstName,b.lastName,b.primaryPhone||null])).rows[0];
    if(!person)fail(404,"Account not found");
    return reply(res,person,"Profile updated");
  });
  route("PUT", "/api/mobile/announcement", async (req, res) => {
    auth.admin(req);
    const parsed=z.object({message:z.string().trim().max(1000)}).safeParse(req.body);
    if(!parsed.success)fail(400,"Enter an announcement of up to 1,000 characters");
    const row=(await db.query("UPDATE node_agencies SET carer_app_message=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING carer_app_message AS message,updated_at AS \"updatedAt\"",[req.user.agencyId,parsed.data.message])).rows[0];
    if(!row)fail(404,"Organisation not found");
    return reply(res,row,"Announcement updated");
  });
  route("GET", "/api/mobile/me/timesheet", async (req, res) => {
    if (req.user.role !== "CAREGIVER") fail(403, "Caregiver access required");
    const from = String(req.query.from || ""), to = String(req.query.to || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) ||
      Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to)) ||
      from > to || (Date.parse(to) - Date.parse(from)) > 35 * 86400000)
      fail(400, "Select a valid date range of up to 35 days");
    const visits = (await db.query(`SELECT v.id,v.visit_date::text AS date,v.title,v.status,
      to_char(start_time,'HH24:MI') AS "startTime",to_char(end_time,'HH24:MI') AS "endTime",
      actual_start AS "actualStart",actual_end AS "actualEnd",
      v.client_id AS "clientId",c.first_name||' '||c.last_name AS "clientName",
      COALESCE(t.miles,0) AS miles,COALESCE(t.minutes,0) AS "travelMinutes",
      claim.status AS "travelClaimStatus",claim.miles AS "claimedMiles",claim.minutes AS "claimedMinutes",
      claim.decision_note AS "travelDecisionNote"
      FROM node_roster_visits v JOIN users c ON c.id=v.client_id
      LEFT JOIN node_visit_travel t ON t.visit_id=v.id AND t.agency_id=v.agency_id AND t.staff_id=v.staff_id
      LEFT JOIN node_travel_claims claim ON claim.visit_id=v.id AND claim.agency_id=v.agency_id AND claim.staff_id=v.staff_id
      WHERE v.agency_id=$1 AND v.staff_id=$2 AND v.visit_date BETWEEN $3 AND $4
      ORDER BY v.visit_date,v.start_time,v.id`, [req.user.agencyId, req.user.id, from, to])).rows
      .map((visit) => ({ ...visit, workedMinutes: visit.actualStart && visit.actualEnd
        ? Math.max(0, Math.round((new Date(visit.actualEnd) - new Date(visit.actualStart)) / 60000)) : 0 }));
    return reply(res, { visits, workedMinutes: visits.reduce((sum, visit) => sum + visit.workedMinutes, 0),
      travelMinutes:visits.reduce((sum,visit)=>sum+Number(visit.travelMinutes||0),0),
      miles:visits.reduce((sum,visit)=>sum+Number(visit.miles||0),0) });
  });
  route("POST", "/api/mobile/me/travel-claims", async (req,res) => {
    if(req.user.role!=="CAREGIVER")fail(403,"Caregiver access required");
    const parsed=z.object({visitId:z.uuid(),miles:z.number().min(0).max(10000),minutes:z.number().int().min(0).max(1440),note:z.string().trim().max(1000).default("")}).safeParse(req.body);
    if(!parsed.success)fail(400,"Enter a completed visit and valid travel time or mileage");
    const b=parsed.data;
    const claim=await db.transaction(async()=>{
      const visit=(await db.query("SELECT id,status FROM node_roster_visits WHERE id=$1 AND agency_id=$2 AND staff_id=$3 FOR UPDATE",[b.visitId,req.user.agencyId,req.user.id])).rows[0];
      if(!visit||visit.status!=="COMPLETED")fail(404,"Completed assigned visit not found");
      const previous=(await db.query("SELECT status FROM node_travel_claims WHERE visit_id=$1 FOR UPDATE",[b.visitId])).rows[0];
      if(previous&&previous.status!=="DECLINED")fail(409,"Travel has already been submitted for this visit");
      if((await db.query("SELECT id FROM node_finance_lines WHERE visit_id=$1 AND kind='PAYRUN' AND released=false",[b.visitId])).rows.length)
        fail(409,"Travel is locked in a staff pay document");
      return (await db.query(`INSERT INTO node_travel_claims(id,agency_id,visit_id,staff_id,miles,minutes,note,status)
        VALUES($1,$2,$3,$4,$5,$6,$7,'PENDING') ON CONFLICT(visit_id) DO UPDATE SET miles=EXCLUDED.miles,
        minutes=EXCLUDED.minutes,note=EXCLUDED.note,status='PENDING',submitted_at=CURRENT_TIMESTAMP,
        reviewed_by=NULL,reviewed_at=NULL,decision_note='' RETURNING id,status,miles,minutes`,
        [randomUUID(),req.user.agencyId,b.visitId,req.user.id,b.miles,b.minutes,b.note])).rows[0];
    });
    return reply(res,claim,"Travel claim sent for approval",201);
  });
  route("GET", "/api/mobile/admin/travel-claims", async(req,res)=>{
    auth.admin(req);
    return reply(res,(await db.query(`SELECT claim.id,claim.visit_id AS "visitId",claim.staff_id AS "staffId",
      staff.first_name||' '||staff.last_name AS "staffName",client.first_name||' '||client.last_name AS "clientName",
      visit.visit_date::text AS date,claim.miles,claim.minutes,claim.note,claim.status,
      claim.submitted_at AS "submittedAt",claim.decision_note AS "decisionNote"
      FROM node_travel_claims claim JOIN node_roster_visits visit ON visit.id=claim.visit_id
      JOIN users staff ON staff.id=claim.staff_id JOIN users client ON client.id=visit.client_id
      WHERE claim.agency_id=$1 ORDER BY claim.submitted_at DESC LIMIT 100`,[req.user.agencyId])).rows);
  });
  route("POST", "/api/mobile/admin/travel-claims/:id/decision", async(req,res)=>{
    auth.admin(req);
    const parsed=z.object({decision:z.enum(["APPROVED","DECLINED"]),note:z.string().trim().max(1000).default("")}).safeParse(req.body);
    if(!parsed.success)fail(400,"Choose an approval decision");
    const result=await db.transaction(async()=>{
      const claim=(await db.query("SELECT * FROM node_travel_claims WHERE id=$1 AND agency_id=$2 FOR UPDATE",[req.params.id,req.user.agencyId])).rows[0];
      if(!claim)fail(404,"Travel claim not found");
      if(claim.status!=="PENDING")fail(409,"Travel claim has already been reviewed");
      const visit=(await db.query("SELECT status,staff_id FROM node_roster_visits WHERE id=$1 AND agency_id=$2 FOR UPDATE",[claim.visit_id,req.user.agencyId])).rows[0];
      if(!visit||visit.status!=="COMPLETED"||visit.staff_id!==claim.staff_id)fail(409,"Visit assignment changed; review the claim manually");
      if(parsed.data.decision==="APPROVED"){
        if((await db.query("SELECT id FROM node_finance_lines WHERE visit_id=$1 AND kind='PAYRUN' AND released=false",[claim.visit_id])).rows.length)
          fail(409,"Travel is locked in a staff pay document");
        await db.query(`INSERT INTO node_visit_travel(visit_id,agency_id,staff_id,miles,minutes,source,recorded_by)
          VALUES($1,$2,$3,$4,$5,'ACTUAL',$6) ON CONFLICT(visit_id) DO UPDATE SET
          miles=EXCLUDED.miles,minutes=EXCLUDED.minutes,source='ACTUAL',revision=node_visit_travel.revision+1,
          recorded_by=EXCLUDED.recorded_by,updated_at=CURRENT_TIMESTAMP`,
          [claim.visit_id,req.user.agencyId,claim.staff_id,claim.miles,claim.minutes,req.user.id]);
      }
      const reviewed=(await db.query(`UPDATE node_travel_claims SET status=$2,reviewed_by=$3,reviewed_at=CURRENT_TIMESTAMP,
        decision_note=$4 WHERE id=$1 RETURNING id,status`,[claim.id,parsed.data.decision,req.user.id,parsed.data.note])).rows[0];
      await db.query("INSERT INTO node_finance_history(id,agency_id,actor_id,subject_id,action,snapshot) VALUES($1,$2,$3,$4,'TRAVEL_CLAIM_REVIEWED',$5)",
        [randomUUID(),req.user.agencyId,req.user.id,claim.visit_id,JSON.stringify({claimId:claim.id,status:parsed.data.decision,miles:claim.miles,minutes:claim.minutes,note:parsed.data.note})]);
      return reviewed;
    });
    return reply(res,result,"Travel claim reviewed");
  });
  route("GET", "/api/mobile/clients/:id/care-overview", async (req, res) => {
    await auth.userAccess(req, req.params.id);
    return reply(res, { sections: await careOverview(req.params.id), clientInformation: await clientSafety(req.params.id) });
  });
  route("GET", "/api/mobile/clients/:id/handover", async (req, res) => {
    const client = await auth.userAccess(req, req.params.id);
    if (client.role !== "USER" || client.deletedAt) fail(404,"Client not found");
    const page=Number(req.query.page||1);
    if(!Number.isInteger(page)||page<1||page>1000)fail(400,"Invalid history page");
    const rows=(await db.query(`SELECT e.id,e.title,e.body,e.kind,e.created_at AS "createdAt",
      n.visit_date::text AS date,author.first_name||' '||author.last_name AS "recordedBy"
      FROM node_client_entries e JOIN node_roster_visits n ON n.id=e.visit_id
      JOIN users author ON author.id=e.created_by AND author.agency_id=e.agency_id
      WHERE e.agency_id=$1 AND e.client_id=$2 AND n.agency_id=$1 AND n.client_id=$2
      AND n.status='COMPLETED' AND e.kind IN ('NOTE','OBSERVATION') AND e.status='RECORDED'
      ORDER BY e.created_at DESC,e.id DESC LIMIT 31 OFFSET $3`,
      [req.user.agencyId,client.id,(page-1)*30])).rows;
    return reply(res,{items:rows.slice(0,30),page,hasMore:rows.length>30});
  });
  route("PUT", "/api/mobile/admin/medication/:id/prn-limits", async(req,res)=>{
    auth.admin(req);
    const parsed=z.object({timeBetweenDoses:z.number().int().positive().max(365),timeBetweenUnit:z.enum(["minutes","hours","days"]),maxDoseCount:z.number().int().positive().max(100),maxDosePeriod:z.number().int().positive().max(365),maxDoseUnit:z.enum(["hours","days","weeks"])}).safeParse(req.body);
    if(!parsed.success)fail(400,"Enter a valid PRN minimum interval and maximum number of doses");
    const b=parsed.data;
    if(!prnDuration(b.timeBetweenDoses,b.timeBetweenUnit)||!prnDuration(b.maxDosePeriod,b.maxDoseUnit))fail(400,"PRN periods must be no longer than one year");
    const medication=await repo.get("ClientMedicationSchedulingEntity",uuid(req.params.id));
    if(!medication||medication.deletedAt||medication.isStopped||String(medication.type||"").toUpperCase()!=="PRN")fail(404,"Active PRN medication not found");
    await auth.userAccess(req,medication.user,{write:true});
    const saved=await repo.save("ClientMedicationSchedulingEntity",{id:medication.id,timeBetweenDoses:String(b.timeBetweenDoses),timeBetweenUnit:b.timeBetweenUnit,maxDoseCount:String(b.maxDoseCount),maxDosePeriod:String(b.maxDosePeriod),maxDoseUnit:b.maxDoseUnit,updatedBy:req.user.id});
    return reply(res,{id:saved.id,timeBetweenDoses:saved.timeBetweenDoses,timeBetweenUnit:saved.timeBetweenUnit,maxDoseCount:saved.maxDoseCount,maxDosePeriod:saved.maxDosePeriod,maxDoseUnit:saved.maxDoseUnit},"PRN safety limits saved");
  });
  async function notifyAdmins(req, visit, event, distanceMetres = null, details = "") {
    // An agency's active admins handle its visits. Its registered owner is the
    // fallback for an agency (including the platform owner's own agency) that
    // has no admins; platform-wide access never grants cross-agency mail.
    const admins = (await db.query(`SELECT DISTINCT id,email FROM users
      WHERE agency_id=$1 AND is_active=true AND deleted_at IS NULL AND email IS NOT NULL
      AND (role='ADMIN' OR (role='SUPERADMIN' AND NOT EXISTS (
        SELECT 1 FROM users managers WHERE managers.agency_id=$1 AND managers.role='ADMIN'
        AND managers.is_active=true AND managers.deleted_at IS NULL AND managers.email IS NOT NULL
      ) AND id=(SELECT owner.id FROM users owner WHERE owner.agency_id=$1
        AND owner.role='SUPERADMIN' AND owner.is_active=true AND owner.deleted_at IS NULL
        ORDER BY owner.created_at,owner.id LIMIT 1)))`, [req.user.agencyId])).rows;
    const recipients=admins.map((row)=>row.email).filter((email)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
    if (!recipients.length) return;
    const caregiver = (await db.query("SELECT first_name||' '||last_name AS name FROM users WHERE id=$1 AND agency_id=$2", [req.user.id,req.user.agencyId])).rows[0]?.name || "Caregiver";
    const when = new Date().toLocaleString("en-GB", { timeZone:"Europe/London" });
    const text = [`${event} for ${visit.clientName}.`, `Caregiver: ${caregiver}`, `Scheduled visit: ${visit.date}, ${visit.startTime}–${visit.endTime} (UK time)`, `Event time: ${when} (UK time)`, distanceMetres == null ? null : `Approximate distance from the client's configured address: ${distanceMetres} metres.`, details || null].filter(Boolean).join("\n");
    req.afterCommit?.push(() => mail.send({ to:recipients, subject:`${event}: ${visit.clientName}`, text }));
    req.afterCommit?.push(() => push.sendToUsers(req.user.agencyId,admins.filter((row)=>recipients.includes(row.email)).map((row)=>row.id),"A care event needs your attention. Open Caremonitor to review it."));
  }
  async function visit(req, locking = false) {
    const row = (await db.query(`SELECT v.*,v.visit_date::text AS date,to_char(v.start_time,'HH24:MI') AS "startTime",
      to_char(v.end_time,'HH24:MI') AS "endTime",c.first_name||' '||c.last_name AS "clientName",
      c.primary_phone AS "clientPhone",c.email AS "clientEmail",c.profile_image_path AS "clientPhoto",
      s.first_name||' '||s.last_name AS "staffName" FROM node_roster_visits v JOIN users c ON c.id=v.client_id
      LEFT JOIN users s ON s.id=v.staff_id AND s.agency_id=v.agency_id
      WHERE v.id=$1 AND v.agency_id=$2${locking ? " FOR UPDATE OF v" : ""}`, [req.params.id, req.user.agencyId])).rows[0];
    if (!row || (req.user.role === "CAREGIVER" && row.staff_id !== req.user.id)) fail(404, "Visit not found");
    if (req.user.role === "CAREGIVER") {
      const ukToday = new Intl.DateTimeFormat("en-CA", { timeZone:"Europe/London", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date());
      const lastVisibleDate = new Date(Date.parse(ukToday) + 6 * 86400000).toISOString().slice(0, 10);
      if (row.date > lastVisibleDate) fail(404, "Visit not found");
    }
    return row;
  }

  route("GET", "/api/mobile/visits/:id", async (req, res) => {
    const v = await visit(req);
    const [entries, attendance, locations, attachments, administrations, addresses, witnesses, nextVisit, tomorrowVisits, upcomingVisits, previousNotes] = await Promise.all([
      db.query("SELECT id,kind,title,body,category,status,revision,created_at FROM node_client_entries WHERE visit_id=$1 ORDER BY created_at,id", [v.id]),
      db.query("SELECT id,event,latitude,longitude,accuracy,distance_metres AS \"distanceMetres\",within_radius AS \"withinRadius\",source,created_at FROM node_visit_attendance WHERE visit_id=$1 ORDER BY created_at,id", [v.id]),
      db.query("SELECT id,latitude,longitude,accuracy,distance_metres AS \"distanceMetres\",within_radius AS \"withinRadius\",recorded_at AS \"recordedAt\" FROM node_visit_locations WHERE visit_id=$1 ORDER BY recorded_at,id", [v.id]),
      db.query("SELECT id,file_url AS url,file_name AS name,mime_type AS mime,caption,latitude,longitude,accuracy,captured_at AS \"capturedAt\",created_at FROM node_visit_attachments WHERE visit_id=$1 ORDER BY created_at,id", [v.id]),
      db.query(`SELECT a.id,a.client_event_id AS "clientEventId",a.medication_id AS "medicationId",a.outcome,a.slot,
        a.dose_given AS "doseGiven",a.reason,a.note,a.prn_effect AS "prnEffect",a.witnessed_by AS "witnessedBy",
        a.quantity_given AS "quantityGiven",a.stock_before AS "stockBefore",a.stock_after AS "stockAfter",
        a.body_map_acknowledged AS "bodyMapAcknowledged",
        a.occurred_at AS "occurredAt",a.created_at AS "createdAt",u.first_name||' '||u.last_name AS "recordedBy",
        COALESCE((SELECT jsonb_agg(jsonb_build_object('id',c.id,'reason',c.reason,'replacement',c.replacement,'createdAt',c.created_at,'actorId',c.actor_id) ORDER BY c.created_at,c.id) FROM node_medication_administration_corrections c WHERE c.administration_id=a.id),'[]') AS corrections
        FROM node_medication_administrations a JOIN users u ON u.id=a.actor_id
        WHERE a.visit_id=$1 ORDER BY a.occurred_at,a.id`, [v.id]),
      repo.find("UserPrimaryAddressEntity", { user: v.client_id }),
      db.query("SELECT id,first_name||' '||last_name AS name FROM users WHERE agency_id=$1 AND role IN ('ADMIN','SUPERADMIN','CAREGIVER') AND is_active=true AND deleted_at IS NULL AND id<>$2 ORDER BY first_name,last_name", [req.user.agencyId,req.user.id]),
      db.query(`SELECT n.visit_date::text AS date,to_char(n.start_time,'HH24:MI') AS "startTime",
        to_char(n.end_time,'HH24:MI') AS "endTime",s.first_name||' '||s.last_name AS "caregiverName"
        FROM node_roster_visits n JOIN users s ON s.id=n.staff_id AND s.agency_id=n.agency_id
        WHERE n.agency_id=$1 AND n.client_id=$2 AND n.id<>$3 AND n.staff_id IS NOT NULL
        AND n.status IN ('SCHEDULED','IN_PROGRESS') AND (n.visit_date> $4::date OR
        (n.visit_date=$4::date AND n.start_time>$5::time))
        ORDER BY n.visit_date,n.start_time,n.id LIMIT 1`, [req.user.agencyId,v.client_id,v.id,v.date,v.startTime]),
      db.query(`SELECT n.visit_date::text AS date,to_char(n.start_time,'HH24:MI') AS "startTime",
        to_char(n.end_time,'HH24:MI') AS "endTime",s.first_name||' '||s.last_name AS "caregiverName"
        FROM node_roster_visits n JOIN users s ON s.id=n.staff_id AND s.agency_id=n.agency_id
        WHERE n.agency_id=$1 AND n.client_id=$2 AND n.visit_date=$3::date+1
        AND n.status IN ('SCHEDULED','IN_PROGRESS') ORDER BY n.start_time,n.id`,[req.user.agencyId,v.client_id,v.date]),
      db.query(`SELECT n.visit_date::text AS date,to_char(n.start_time,'HH24:MI') AS "startTime",
        to_char(n.end_time,'HH24:MI') AS "endTime",n.title,
        COALESCE(s.first_name||' '||s.last_name,'Not yet allocated') AS "caregiverName"
        FROM node_roster_visits n LEFT JOIN users s ON s.id=n.staff_id AND s.agency_id=n.agency_id
        WHERE n.agency_id=$1 AND n.client_id=$2 AND n.id<>$3
        AND n.visit_date BETWEEN $4::date AND ($4::date + 6)
        AND (n.visit_date>$4::date OR n.start_time>$5::time)
        AND n.status IN ('DRAFT','SCHEDULED','IN_PROGRESS')
        ORDER BY n.visit_date,n.start_time,n.id LIMIT 50`,[req.user.agencyId,v.client_id,v.id,v.date,v.startTime]),
      db.query(`SELECT e.id,e.title,e.body,e.kind,e.created_at AS "createdAt",
        n.visit_date::text AS date
        FROM node_client_entries e JOIN node_roster_visits n ON n.id=e.visit_id
        WHERE n.agency_id=$1 AND n.client_id=$2 AND e.agency_id=$1 AND e.client_id=$2 AND n.id<>$3
        AND n.status='COMPLETED' AND (n.visit_date<$4::date OR
          (n.visit_date=$4::date AND n.start_time<$5::time))
        AND e.kind IN ('NOTE','OBSERVATION') AND e.status='RECORDED'
        ORDER BY e.created_at DESC,e.id DESC LIMIT 10`,[req.user.agencyId,v.client_id,v.id,v.date,v.startTime]),
    ]);
    const plans = await repo.find("ClientTaskPlanEntity", { user: v.client_id });
    const tasks = [];
    for (const p of plans) if (!p.deletedAt && occursOn({ ...p, isEnds: !!p.endDate }, v.date)) {
      const task = await repo.get("ClientTaskEntity", p.task);
      const name = p.taskNameSnapshot || task?.name || "Care task";
      const recorded = entries.rows.find((e) => e.kind === "ACTIVITY" && e.category === p.id);
      tasks.push({ id: p.id, name, details: p.details || "", essential: !!p.isEssential, sessions: p.isAnyTime ? ["ANYTIME"] : p.sessions || [], status: recorded?.status || "PENDING", recordId: recorded?.id || null });
    }
    const medication = await repo.find("ClientMedicationSchedulingEntity", { user: v.client_id });
    const medicationProfile=(await repo.find("ClientMedicationEntity",{user:v.client_id}))[0];
    const contactRows = await repo.find("UserKeyContactEntity", { user: v.client_id });
    const appSettings = (await db.query("SELECT carer_app_settings FROM node_agencies WHERE id=$1", [req.user.agencyId])).rows[0]?.carer_app_settings || {};
    const clientInformation = await clientSafety(v.client_id);
    const clientSettings = await repo.one("ClientSettingsEntity", { user: v.client_id });
    const keyContacts = contactRows.filter((contact) => !contact.deletedAt).map((contact) => ({
      name: [contact.firstName, contact.lastName].filter(Boolean).join(" "),
      relationship: contact.relationShip || "", phone: contact.phoneNumber || "",
      type: contact.typeOfContact || "",
    }));
    return reply(res, { visit: v, nextVisit:nextVisit.rows[0] || null, tomorrowVisits:tomorrowVisits.rows, upcomingVisits:upcomingVisits.rows, previousNotes:previousNotes.rows, address: addresses.find((a) => a.isPrimary) || addresses[0] || null, clientInformation, keyContacts, qrCheckInRequired:!!clientSettings?.qrCodeCheckIn, photoUploadsAllowed:appSettings.allowPhotoUploads!==false, careOverview:await careOverview(v.client_id), tasks, allergyInformation:String(medicationProfile?.allergies||"").trim(), medication: medication.filter((m) => !m.isStopped && !m.deletedAt).map((m) => ({ id:m.id, name:m.medicationName, type:m.type || "REGULAR", instructions:m.additionalInstructions || m.medicationDescription || m.dose || "", bodyMapData:typeof m.bodyMapData==="string"?m.bodyMapData:"", dose:m.dose || "", route:m.route || "", slots:m.selectedTimeSlots || [], exactTimes:m.exactTimes || {}, dueSlots:medicationDueSlots(m,v), isControlledDrug:!!m.isControlledDrug, requiresWitness:!!m.requiresWitness, stockTrackingEnabled:!!m.stockTrackingEnabled, stockQuantity:Number(m.stockQuantity||0), stockUnit:m.stockUnit||"", lowStockThreshold:Number(m.lowStockThreshold||0), timeBetweenDoses:m.timeBetweenDoses || "", timeBetweenUnit:m.timeBetweenUnit || "", maxDoseCount:m.maxDoseCount || "", maxDosePeriod:m.maxDosePeriod || "", maxDoseUnit:m.maxDoseUnit || "", medicalCondition:m.medicalCondition||"", circumstances:m.circumstances||"", clientExpression:m.clientExpression||"" })), medicationAdministrations: administrations.rows, witnesses:witnesses.rows, entries: entries.rows, attendance: attendance.rows, locationTrail: locations.rows, attachments: attachments.rows });
  });

  route("POST", "/api/mobile/visits/:id/medication-administrations", async (req, res) => {
    const parsed = medicationAdministrationInput.safeParse(req.body);
    if (!parsed.success) fail(400, parsed.error.issues[0]?.message || "Medication administration details are invalid");
    const body = parsed.data;
    const result = await db.transaction(async () => {
      const v = await visit(req, true);
      const duplicate = (await db.query("SELECT * FROM node_medication_administrations WHERE agency_id=$1 AND client_event_id=$2", [req.user.agencyId, body.clientEventId])).rows[0];
      if (duplicate) {
        if (duplicate.visit_id !== v.id || duplicate.medication_id !== body.medicationId) fail(409, "This offline event identifier was already used");
        return { row: duplicate, created: false };
      }
      if (v.status !== "IN_PROGRESS") fail(409, "Check in before recording medication");
      await db.query("SELECT id FROM client_medications_scheduling WHERE id=$1 FOR UPDATE", [body.medicationId]);
      const medication = await repo.get("ClientMedicationSchedulingEntity", body.medicationId);
      if (!medication || medication.user !== v.client_id || medication.deletedAt || medication.isStopped)
        fail(404, "Active medication schedule not found for this client");
      if (body.outcome === "PRN_ADMINISTERED" && String(medication.type || "").toUpperCase() !== "PRN")
        fail(400, "PRN administration can only be recorded for a PRN medication");
      if ((medication.isControlledDrug || medication.requiresWitness) && !body.witnessedBy)
        fail(400, "A second active team member must witness this administration");
      if (body.witnessedBy) {
        const witness = await repo.get("UserEntity", body.witnessedBy, { collections: false });
        if (!witness || witness.agencyId !== req.user.agencyId || witness.role === "USER" || !witness.isActive || witness.deletedAt || witness.id === req.user.id)
          fail(400, "Choose another active team member as witness");
      }
      const occurred = new Date(body.occurredAt);
      if (Math.abs(Date.now() - occurred.valueOf()) > 36 * 60 * 60 * 1000)
        fail(400, "Administration time must be within 36 hours of submission");
      if(occurred.valueOf()>Date.now()+5*60000)fail(400,"Administration time cannot be in the future");
      if(body.outcome === "PRN_ADMINISTERED") await enforcePrnLimits(db,medication,v.client_id,body.occurredAt);
      const id = randomUUID();
      const administered = ["ADMINISTERED", "PRN_ADMINISTERED"].includes(body.outcome);
      const allergyInformation=String((await repo.find("ClientMedicationEntity",{user:v.client_id}))[0]?.allergies||"").trim();
      if(administered&&allergyInformation&&!body.allergyAcknowledged)fail(400,"Review and acknowledge the client's recorded allergy information before administration");
      if(administered&&String(medication.bodyMapData||"").trim()&&!(["{}","[]","null"].includes(String(medication.bodyMapData).trim()))&&!body.bodyMapAcknowledged)
        fail(400,"Review and acknowledge the medication application body map before administration");
      if (administered && medication.stockTrackingEnabled && body.quantityGiven == null)
        fail(400, "Quantity given is required for stock-tracked medication");
      const stockBefore = medication.stockTrackingEnabled ? Number(medication.stockQuantity || 0) : null;
      const stockAfter = medication.stockTrackingEnabled && administered ? stockBefore - Number(body.quantityGiven) : stockBefore;
      if (stockAfter != null && stockAfter < 0) fail(409, "Recorded stock is insufficient for this administration");
      let inserted;
      try {
        inserted = (await db.query(`INSERT INTO node_medication_administrations
          (id,agency_id,client_event_id,visit_id,client_id,medication_id,actor_id,outcome,slot,dose_given,reason,note,prn_effect,witnessed_by,quantity_given,stock_before,stock_after,occurred_at,allergy_acknowledged,body_map_acknowledged)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING *`,
          [id,req.user.agencyId,body.clientEventId,v.id,v.client_id,body.medicationId,req.user.id,body.outcome,body.slot,body.doseGiven,body.reason,body.note,body.prnEffect,body.witnessedBy,body.quantityGiven,stockBefore,stockAfter,body.occurredAt,body.allergyAcknowledged,body.bodyMapAcknowledged])).rows[0];
      } catch (error) {
        if (error?.code === "23505") fail(409, "This medication and time slot have already been recorded for the visit");
        throw error;
      }
      if (medication.stockTrackingEnabled && administered) {
        await repo.save("ClientMedicationSchedulingEntity", { id: medication.id, stockQuantity: stockAfter });
        if (stockAfter <= Number(medication.lowStockThreshold || 0)) {
          const title = `Medication stock low: ${medication.medicationName}`;
          const existing = (await db.query("SELECT id FROM node_client_entries WHERE agency_id=$1 AND client_id=$2 AND category='MEDICATION_STOCK' AND title=$3 AND status='OPEN' LIMIT 1", [req.user.agencyId,v.client_id,title])).rows[0];
          if (!existing) await db.query(`INSERT INTO node_client_entries(id,agency_id,client_id,visit_id,kind,title,body,category,status,revision,created_by,updated_by)
            VALUES($1,$2,$3,$4,'ALERT',$5,$6,'MEDICATION_STOCK','OPEN',1,$7,$7)`,
            [randomUUID(),req.user.agencyId,v.client_id,v.id,title,`${stockAfter} ${medication.stockUnit || "units"} remaining`,req.user.id]);
        }
      }
      const exception = !["ADMINISTERED", "PRN_ADMINISTERED"].includes(body.outcome);
      if (exception) {
        const title = `Medication ${body.outcome.toLowerCase().replaceAll("_", " ")}: ${medication.medicationName}`;
        await db.query(`INSERT INTO node_client_entries(id,agency_id,client_id,visit_id,kind,title,body,category,status,revision,created_by,updated_by)
          VALUES($1,$2,$3,$4,'ALERT',$5,$6,'MEDICATION','OPEN',1,$7,$7)`,
          [randomUUID(),req.user.agencyId,v.client_id,v.id,title,[body.reason,body.note].filter(Boolean).join(" - "),req.user.id]);
      }
      await visitEvent(db, v.id, req.user.id, `Medication ${body.outcome.toLowerCase().replaceAll("_", " ")}: ${medication.medicationName} (${body.slot})`);
      return { row: inserted, created: true };
    });
    return reply(res, result.row, result.created ? "Medication administration recorded" : "Medication administration already recorded", result.created ? 201 : 200);
  });

  route("POST", "/api/medication-administrations/:id/corrections", async (req, res) => {
    auth.admin(req);
    const parsed = z.object({ reason:z.string().trim().min(5).max(1000), replacement:z.object({ outcome:z.enum(["ADMINISTERED","PRN_ADMINISTERED","REFUSED","NOT_AVAILABLE","OMITTED"]).optional(), reason:z.string().trim().max(500).optional(), note:z.string().trim().max(2000).optional(), doseGiven:z.string().trim().max(160).optional() }).strict().refine((value)=>Object.keys(value).length>0,"Enter at least one corrected value") }).safeParse(req.body);
    if (!parsed.success) fail(400, parsed.error.issues[0]?.message || "Correction details are invalid");
    const administration = (await db.query("SELECT * FROM node_medication_administrations WHERE id=$1 AND agency_id=$2", [req.params.id,req.user.agencyId])).rows[0];
    if (!administration) fail(404,"Medication administration not found");
    const correction = (await db.query(`INSERT INTO node_medication_administration_corrections(id,administration_id,agency_id,actor_id,reason,replacement) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
      [randomUUID(),administration.id,req.user.agencyId,req.user.id,parsed.data.reason,JSON.stringify(parsed.data.replacement)])).rows[0];
    await visitEvent(db,administration.visit_id,req.user.id,`Medication record correction added: ${parsed.data.reason}`);
    return reply(res,correction,"Correction appended",201);
  });

  route("POST", "/api/mobile/visits/:id/attendance", async (req, res) => {
    const v = await visit(req, true);
    const parsed = z.object({ clientEventId:z.uuid(), event:z.enum(["CHECK_IN","CHECK_OUT"]), latitude:z.number().min(-90).max(90).nullable().default(null), longitude:z.number().min(-180).max(180).nullable().default(null), accuracy:z.number().nonnegative().max(10000).nullable().default(null), qrCode:z.uuid().optional(), qrUnavailableReason:z.string().trim().max(500).default(""), completionOverrideReason:z.string().trim().max(1000).default(""), locationExceptionReason:z.string().trim().max(500).default("") }).safeParse(req.body);
    if (!parsed.success) fail(400, "Provide a valid attendance event and location");
    const b = parsed.data;
    const duplicate=(await db.query("SELECT event,distance_metres AS \"distanceMetres\",within_radius AS \"withinRadius\" FROM node_visit_attendance WHERE client_event_id=$1 AND actor_id=$2",[b.clientEventId,req.user.id])).rows[0];
    if(duplicate){if(duplicate.event!==b.event)fail(409,"This offline event identifier was already used");return reply(res,{status:duplicate.event==="CHECK_IN"?"IN_PROGRESS":"COMPLETED",distanceMetres:duplicate.distanceMetres,withinRadius:duplicate.withinRadius,locationStatus:duplicate.event!=="CHECK_IN"?"NOT_REQUIRED":duplicate.withinRadius===true?"VERIFIED":duplicate.withinRadius===false?"OUTSIDE_RADIUS":"CLIENT_LOCATION_NOT_CONFIGURED"},"Attendance already recorded");}
    if (b.event === "CHECK_IN" && v.status !== "SCHEDULED") fail(409, "Only a scheduled visit can be checked in");
    if (b.event === "CHECK_OUT" && v.status !== "IN_PROGRESS") fail(409, "Check in before checking out");
    let qrVerified = false, qrException = false;
    if (b.event === "CHECK_IN") {
      const settings = await repo.one("ClientSettingsEntity", { user: v.client_id });
      if (settings?.qrCodeCheckIn) {
        if (b.qrCode) {
          if (!settings.qrCodeId || b.qrCode !== settings.qrCodeId) fail(403, "This QR code does not match the client's current code. Ask the office for help.");
          qrVerified = true;
        } else {
          if (b.qrUnavailableReason.length < 10) fail(400, "Explain why the client's QR code is unavailable (at least 10 characters)");
          qrException = true;
        }
      } else if (b.qrUnavailableReason) {
        fail(400, "A QR exception is not needed for this client");
      }
    }
    if (b.event === "CHECK_OUT") {
      const scheduled = (await repo.find("ClientMedicationSchedulingEntity", { user: v.client_id })).filter((m) => !m.deletedAt && !m.isStopped);
      const recorded = (await db.query("SELECT medication_id,slot FROM node_medication_administrations WHERE visit_id=$1", [v.id])).rows;
      const missingMedication = scheduled.flatMap((m) => medicationDueSlots(m, v).filter((slot) => !recorded.some((r) => r.medication_id === m.id && r.slot === slot)).map((slot) => `${m.medicationName} (${slot})`));
      const plans=(await repo.find("ClientTaskPlanEntity",{user:v.client_id})).filter((plan)=>!plan.deletedAt&&plan.isEssential&&occursOn({...plan,isEnds:!!plan.endDate},v.date));
      const completedTasks=(await db.query("SELECT category FROM node_client_entries WHERE visit_id=$1 AND kind='ACTIVITY' AND status IN ('COMPLETED','NOT_COMPLETED')",[v.id])).rows.map((row)=>row.category);
      const missingTasks=plans.filter((plan)=>!completedTasks.includes(plan.id)).map((plan)=>plan.taskNameSnapshot||"Essential care task");
      const missing=[...missingMedication.map((item)=>`medication: ${item}`),...missingTasks.map((item)=>`task: ${item}`)];
      if(missing.length){
        if(!["ADMIN","SUPERADMIN"].includes(req.user.role)||b.completionOverrideReason.length<10)fail(409,`Record an outcome before checkout: ${missing.join(", ")}`);
        const id=randomUUID();
        await db.query("INSERT INTO node_client_entries(id,agency_id,client_id,visit_id,kind,title,body,category,status,created_by,updated_by) VALUES($1,$2,$3,$4,'ALERT','Visit completion override',$5,'COMPLIANCE','OPEN',$6,$6)",[id,req.user.agencyId,v.client_id,v.id,`${b.completionOverrideReason} | Missing: ${missing.join(", ")}`,req.user.id]);
        await visitEvent(db,v.id,req.user.id,`Administrator overrode incomplete visit records: ${b.completionOverrideReason}`);
      }
    }
    const address=(await repo.find("UserPrimaryAddressEntity",{user:v.client_id})).find((a)=>a.isPrimary);
    if(address?.latitude!=null&&address?.longitude!=null&&(b.latitude==null||b.longitude==null)) fail(400,"Location is required for this client's attendance record");
    let distance=null,within=null;
    if(address?.latitude!=null&&address?.longitude!=null&&b.latitude!=null&&b.longitude!=null){const rad=(x)=>x*Math.PI/180,dLat=rad(b.latitude-address.latitude),dLon=rad(b.longitude-address.longitude),a=Math.sin(dLat/2)**2+Math.cos(rad(address.latitude))*Math.cos(rad(b.latitude))*Math.sin(dLon/2)**2;distance=Math.round(6371000*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)));within=distance<=Math.max(25,address.checkinRadius||150);}
    await db.query("INSERT INTO node_visit_attendance(id,visit_id,actor_id,event,latitude,longitude,accuracy,distance_metres,within_radius,client_event_id,source) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)", [randomUUID(),v.id,req.user.id,b.event,b.latitude,b.longitude,b.accuracy,distance,within,b.clientEventId,qrException?"QR_EXCEPTION":qrVerified?"QR":"MOBILE"]);
    if (b.event === "CHECK_IN") await db.query("UPDATE node_roster_visits SET status='IN_PROGRESS',actual_start=COALESCE(actual_start,CURRENT_TIMESTAMP),revision=revision+1,updated_by=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1",[v.id,req.user.id]);
    else await db.query("UPDATE node_roster_visits SET status='COMPLETED',actual_end=COALESCE(actual_end,CURRENT_TIMESTAMP),revision=revision+1,updated_by=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1",[v.id,req.user.id]);
    await visitEvent(db,v.id,req.user.id,b.event === "CHECK_IN" ? qrException?"Checked in with QR exception requiring office review":qrVerified?"Checked in with client QR verification":"Checked in using the mobile app" : "Checked out using the mobile app");
    let locationStatus="NOT_REQUIRED";
    if(b.event==="CHECK_IN"){
      locationStatus=within===true?"VERIFIED":within===false?"OUTSIDE_RADIUS":"CLIENT_LOCATION_NOT_CONFIGURED";
      const id=randomUUID(),title=within===true?"Caregiver arrived":within===false?"Caregiver arrived outside check-in radius":"Client location setup required",body=within===true?`Location verified${distance!=null?` (${distance} m)`:""}`:within===false?`Attendance was captured ${distance} m from the configured client location.${b.locationExceptionReason?` Caregiver explanation: ${b.locationExceptionReason}`:" Caregiver explanation was not provided."}`:"Attendance was captured, but this client's primary address does not have map coordinates. Add latitude, longitude and a check-in radius in the client address.";
      await db.query("INSERT INTO node_client_entries(id,agency_id,client_id,visit_id,kind,title,body,category,status,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,'ATTENDANCE',$8,$9,$9)",[id,req.user.agencyId,v.client_id,v.id,within===true?'NOTE':'ALERT',title,body,within===true?'RECORDED':'OPEN',req.user.id]);
      if(qrException){
        await db.query("INSERT INTO node_client_entries(id,agency_id,client_id,visit_id,kind,title,body,category,status,created_by,updated_by) VALUES($1,$2,$3,$4,'ALERT','QR code unavailable at check-in',$5,'QR_EXCEPTION','OPEN',$6,$6)",[randomUUID(),req.user.agencyId,v.client_id,v.id,b.qrUnavailableReason,req.user.id]);
        await notifyAdmins(req,v,"QR check-in exception requires review",distance,`Caregiver explanation: ${b.qrUnavailableReason}`);
      }
    }
    await notifyAdmins(req,v,b.event === "CHECK_IN" ? "Caregiver checked in" : "Caregiver checked out",distance);
    return reply(res,{ status:b.event === "CHECK_IN" ? "IN_PROGRESS" : "COMPLETED",distanceMetres:distance,withinRadius:within,locationStatus,qrVerified,qrException },b.event === "CHECK_IN" ? "Checked in" : "Checked out");
  });

  route("POST", "/api/mobile/visits/:id/proximity", async (req,res) => {
    const v=await visit(req);
    if(req.user.role!=="CAREGIVER"||v.staff_id!==req.user.id)fail(403,"Only the assigned caregiver can report arrival");
    if(v.status!=="SCHEDULED")return reply(res,{notified:false},"Visit is not awaiting arrival");
    const input=z.object({latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180),accuracy:z.number().nonnegative().max(10000)}).safeParse(req.body);
    if(!input.success)fail(400,"Provide a valid current location");
    const date=(await db.query("SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/London')::date::text AS today")).rows[0].today;
    if(v.date!==date)return reply(res,{notified:false},"Arrival alerts apply on the visit date");
    const address=(await repo.find("UserPrimaryAddressEntity",{user:v.client_id})).find((item)=>item.isPrimary);
    const nearby=proximity(input.data.latitude,input.data.longitude,address);
    if(nearby.distanceMetres==null||nearby.distanceMetres>100||input.data.accuracy>100)
      return reply(res,{notified:false,distanceMetres:nearby.distanceMetres},"Not within the verified arrival range");
    // Serialize reports for this visit so a poor network cannot send duplicate arrival emails.
    await db.query("SELECT pg_advisory_xact_lock(hashtext('caremonitor-proximity'),hashtext($1))",[v.id]);
    const existing=(await db.query("SELECT id FROM node_client_entries WHERE agency_id=$1 AND visit_id=$2 AND category='PROXIMITY' LIMIT 1",[req.user.agencyId,v.id])).rows[0];
    if(existing)return reply(res,{notified:false,distanceMetres:nearby.distanceMetres},"Arrival already reported");
    await db.query("INSERT INTO node_client_entries(id,agency_id,client_id,visit_id,kind,title,body,category,status,created_by,updated_by) VALUES($1,$2,$3,$4,'NOTE','Caregiver near client address',$5,'PROXIMITY','RECORDED',$6,$6)",[randomUUID(),req.user.agencyId,v.client_id,v.id,`Caregiver arrived within ${nearby.distanceMetres} metres of the configured address before check-in.`,req.user.id]);
    await visitEvent(db,v.id,req.user.id,"Caregiver reached the 100-metre arrival range");
    await notifyAdmins(req,v,"Caregiver within 100 metres",nearby.distanceMetres);
    return reply(res,{notified:true,distanceMetres:nearby.distanceMetres},"Arrival recorded",201);
  });

  route("POST", "/api/mobile/visits/:id/locations", async (req,res) => {
    const v=await visit(req);
    const parsed=z.object({clientEventId:z.uuid(),latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180),accuracy:z.number().nonnegative().max(10000).nullable().default(null),recordedAt:z.iso.datetime({offset:true})}).safeParse(req.body);
    if(!parsed.success)fail(400,"Provide a valid active-visit location sample");
    const b=parsed.data,recordedAt=new Date(b.recordedAt);
    if(Math.abs(Date.now()-recordedAt.valueOf())>36*60*60*1000)fail(400,"Location sample time is outside the allowed visit window");
    if(!["IN_PROGRESS","COMPLETED"].includes(v.status))fail(409,"Check in before sharing active-visit location");
    if(v.actual_start&&recordedAt<new Date(v.actual_start))fail(409,"Location sample predates check-in");
    if(v.actual_end&&recordedAt>new Date(new Date(v.actual_end).valueOf()+15*60*1000))fail(409,"Location tracking ended at checkout");
    const existing=(await db.query("SELECT id,distance_metres AS \"distanceMetres\",within_radius AS \"withinRadius\" FROM node_visit_locations WHERE agency_id=$1 AND client_event_id=$2",[req.user.agencyId,b.clientEventId])).rows[0];
    if(existing)return reply(res,existing,"Location sample already recorded");
    const address=(await repo.find("UserPrimaryAddressEntity",{user:v.client_id})).find((item)=>item.isPrimary);
    const nearby=proximity(b.latitude,b.longitude,address);
    const row=(await db.query(`INSERT INTO node_visit_locations(id,agency_id,visit_id,actor_id,client_event_id,latitude,longitude,accuracy,distance_metres,within_radius,recorded_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id,distance_metres AS "distanceMetres",within_radius AS "withinRadius"`,
      [randomUUID(),req.user.agencyId,v.id,req.user.id,b.clientEventId,b.latitude,b.longitude,b.accuracy,nearby.distanceMetres,nearby.withinRadius,b.recordedAt])).rows[0];
    return reply(res,row,"Active-visit location recorded",201);
  });

  route("POST", "/api/mobile/visits/:id/entries", async (req,res) => {
    const v=await visit(req);
    const parsed=entryInput.safeParse(req.body); if(!parsed.success) fail(400,"Enter valid care record details");
    const b=parsed.data;
    const duplicate=(await db.query("SELECT id,visit_id FROM node_client_entries WHERE agency_id=$1 AND client_event_id=$2",[req.user.agencyId,b.clientEventId])).rows[0];
    if(duplicate){if(duplicate.visit_id!==v.id)fail(409,"This offline event identifier was already used");return reply(res,{id:duplicate.id},"Care record already saved");}
    if(v.status!=="IN_PROGRESS")fail(409,"Check in before recording or changing care information");
    const allowed={NOTE:["RECORDED"],OBSERVATION:["RECORDED"],ALERT:["OPEN"],ACTIVITY:["COMPLETED","NOT_COMPLETED"]};
    if(!allowed[b.kind].includes(b.status)) fail(400,"Invalid record status");
    if(b.clinical&&b.kind!=="OBSERVATION")fail(400,"Clinical measurements must be observations");
    const reading=b.clinical?clinicalReading(b.clinical):null;
    const clinicalLabel=b.clinical?.type.toLowerCase().replaceAll("_"," ");
    const title=b.clinical?`Clinical: ${clinicalLabel}`:b.title;
    const body=b.clinical?`${b.clinical.value}${clinicalUnits[b.clinical.type]?` ${clinicalUnits[b.clinical.type]}`:""}`:b.body;
    const category=b.clinical?`CLINICAL_${b.clinical.type}`:b.category;
    const id=randomUUID();
    await db.transaction(async()=>{
      await db.query("INSERT INTO node_client_entries(id,agency_id,client_id,visit_id,kind,title,body,category,status,created_by,updated_by,client_event_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,$11)",[id,req.user.agencyId,v.client_id,v.id,b.kind,title,body,category,b.status,req.user.id,b.clientEventId]);
      if(b.clinical)await db.query("INSERT INTO node_clinical_observations(id,agency_id,client_id,visit_id,entry_id,actor_id,measurement_type,reading,unit) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",[randomUUID(),req.user.agencyId,v.client_id,v.id,id,req.user.id,b.clinical.type,JSON.stringify(reading),clinicalUnits[b.clinical.type]]);
      await visitEvent(db,v.id,req.user.id,`${b.kind.toLowerCase()} recorded in the mobile app`);
    });
    if(b.kind==="ALERT")await notifyAdmins(req,v,`Care concern: ${b.title}`);
    return reply(res,{id},"Care record saved",201);
  });

  route("POST", "/api/mobile/visits/:id/photos", async (req,res) => {
    const v=await visit(req);
    const parsedEventId=req.body.clientEventId?z.uuid().safeParse(req.body.clientEventId):null;
    if(parsedEventId&&!parsedEventId.success)fail(400,"Invalid photo event identifier");
    const clientEventId=parsedEventId?.data||null;
    if(clientEventId){
      const duplicate=(await db.query("SELECT id,visit_id,file_url AS url,file_name AS name,caption FROM node_visit_attachments WHERE agency_id=$1 AND client_event_id=$2",[req.user.agencyId,clientEventId])).rows[0];
      if(duplicate){if(duplicate.visit_id!==v.id)fail(409,"This photo identifier was already used");return reply(res,duplicate,"Photo already uploaded");}
    }
    if(v.status!=="IN_PROGRESS")fail(409,"Check in before adding visit evidence");
    const settings=(await db.query("SELECT carer_app_settings FROM node_agencies WHERE id=$1",[req.user.agencyId])).rows[0]?.carer_app_settings||{};
    if(settings.allowPhotoUploads===false)fail(403,"Photo evidence is disabled by your organisation");
    const file=req.files?.[0]; if(!file) fail(400,"Choose a photo");
    const saved=await files.save(file); if(!saved.mime.startsWith("image/")) fail(400,"Only PNG and JPEG photos are allowed");
    const caption=String(req.body.caption||"").trim(); if(caption.length>500) fail(400,"Caption is too long");
    const metadata=z.object({latitude:z.coerce.number().min(-90).max(90).nullable().default(null),longitude:z.coerce.number().min(-180).max(180).nullable().default(null),accuracy:z.coerce.number().nonnegative().max(10000).nullable().default(null),capturedAt:z.iso.datetime({offset:true}).nullable().default(null)}).safeParse({latitude:req.body.latitude||null,longitude:req.body.longitude||null,accuracy:req.body.accuracy||null,capturedAt:req.body.capturedAt||null});
    if(!metadata.success)fail(400,"Photo location metadata is invalid");
    const id=randomUUID();
    await db.query("INSERT INTO node_visit_attachments(id,agency_id,visit_id,client_id,file_url,file_name,mime_type,caption,created_by,latitude,longitude,accuracy,captured_at,client_event_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)",[id,req.user.agencyId,v.id,v.client_id,saved.url,saved.filename,saved.mime,caption,req.user.id,metadata.data.latitude,metadata.data.longitude,metadata.data.accuracy,metadata.data.capturedAt,clientEventId]);
    await visitEvent(db,v.id,req.user.id,"Photo added from the mobile app");
    return reply(res,{id,url:saved.url,name:saved.filename,caption,...metadata.data},"Photo uploaded",201);
  },{multipart:true});

  route("POST", "/api/mobile/note-assist", async (req,res) => {
    const text=String(req.body.text||"").trim(); if(text.length<10||text.length>10000) fail(400,"Enter 10 to 10,000 characters");
    const sentences=text.split(/(?<=[.!?])\s+/).filter(Boolean);
    const attention=/fall|injur|bleed|missed|refus|pain|breath|confus|unwell|emergency|medication/i;
    return reply(res,{ summary:sentences.slice(0,3).join(" "), attention:sentences.filter((s)=>attention.test(s)).slice(0,5), requiresReview:true, method:"rules" });
  });
}
