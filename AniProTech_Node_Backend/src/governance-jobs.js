import { scheduledReportPdf } from "./report-pdf.js";
const cadenceDays={WEEKLY:7,MONTHLY:30,QUARTERLY:90};
export async function runGovernanceReports({db,mail,frontendUrl}){
  const due=(await db.query(`SELECT id FROM node_report_schedules WHERE active=true AND next_run_at<=CURRENT_TIMESTAMP ORDER BY next_run_at LIMIT 20`)).rows;
  let sent=0;
  for(const item of due){
    const result=await db.transaction(async()=>{
      const schedule=(await db.query(`SELECT * FROM node_report_schedules WHERE id=$1 AND active=true AND next_run_at<=CURRENT_TIMESTAMP FOR UPDATE`,[item.id])).rows[0];
      if(!schedule)return null;
      const [cases,visits,documents]=(await Promise.all([
        db.query(`SELECT count(*)::int total,count(*) FILTER(WHERE status<>'CLOSED')::int open,count(*) FILTER(WHERE due_at<CURRENT_TIMESTAMP AND status<>'CLOSED')::int overdue FROM node_quality_cases WHERE agency_id=$1`,[schedule.agency_id]),
        db.query(`SELECT count(*)::int total,count(*) FILTER(WHERE status='COMPLETED')::int completed FROM node_roster_visits WHERE agency_id=$1 AND visit_date>=CURRENT_DATE-30`,[schedule.agency_id]),
        db.query(`SELECT count(*)::int total,COALESCE(sum(total_pence),0)::bigint::text value FROM node_finance_documents WHERE agency_id=$1 AND created_at>=CURRENT_TIMESTAMP-interval '30 days'`,[schedule.agency_id])
      ])).map(x=>x.rows[0]);
      await db.query(`UPDATE node_report_schedules SET last_run_at=CURRENT_TIMESTAMP,next_run_at=CURRENT_TIMESTAMP+($2::text||' days')::interval WHERE id=$1`,[schedule.id,cadenceDays[schedule.cadence]]);
      return {schedule,cases,visits,documents};
    });
    if(!result)continue;
    const {schedule,cases,visits,documents}=result,additionalRecipients=Array.isArray(schedule.recipient_emails)?schedule.recipient_emails:JSON.parse(schedule.recipient_emails||"[]");
    // Resolve owners and admins at send time so role or email changes take effect
    // immediately, while retaining any explicitly added organisation recipients.
    const organisationRecipients=(await db.query(`SELECT DISTINCT lower(email) AS email FROM users WHERE agency_id=$1 AND role IN ('ADMIN','SUPERADMIN') AND is_active=true AND deleted_at IS NULL AND email IS NOT NULL`,[schedule.agency_id])).rows.map((row)=>row.email);
    const recipients=[...new Set([...organisationRecipients,...additionalRecipients.map((email)=>String(email).toLowerCase())])].filter((email)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
    const text=`Caremonitor ${schedule.name}\n\nLast 30 days\nVisits: ${visits.total} (${visits.completed} completed)\nQuality cases: ${cases.total} (${cases.open} open, ${cases.overdue} overdue)\nFinance documents: ${documents.total}\n\nSign in for protected details and reconciliation. This email contains no client information.`;
    if(!recipients.length){console.error("Scheduled governance report has no active owner or admin recipient",schedule.id);continue;}
    const attachment={filename:`caremonitor-${schedule.name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"") || "scheduled-report"}.pdf`,content:scheduledReportPdf({name:schedule.name,cadence:schedule.cadence,generatedAt:new Date(),visits,cases,documents}),contentType:"application/pdf"};
    const outcomes=await Promise.allSettled(recipients.map(to=>mail.send({to,subject:`Caremonitor scheduled report: ${schedule.name}`,text,actionUrl:`${frontendUrl}/admin/governance`,actionLabel:"Open governance workspace",attachments:[attachment]})));
    if(outcomes.some(x=>x.status==='rejected'))console.error("A scheduled governance report recipient failed");else sent++;
  }
  return {due:due.length,sent};
}
export function startGovernanceJobs(ctx){
  let stopped=false,running=false;
  const tick=async()=>{if(stopped||running)return;running=true;try{await runGovernanceReports({db:ctx.db,mail:ctx.mail,frontendUrl:ctx.config.frontendUrl})}catch(error){console.error("Governance report worker failed",error.code||error.name)}finally{running=false}};
  const timer=setInterval(tick,5*60*1000);timer.unref?.();void tick();
  return async()=>{stopped=true;clearInterval(timer);while(running)await new Promise(resolve=>setTimeout(resolve,25))};
}
