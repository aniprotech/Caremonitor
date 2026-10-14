import { reply } from "../http.js";
import { dateRange } from "./activity.js";
import { registerReportingAudits } from "./reporting-audits.js";
import { registerReportingLibrary } from "./reporting-library.js";
export function registerReporting({ db, auth }, route) {
  registerReportingAudits({ db, auth }, route);
  registerReportingLibrary({ db, auth }, route);
  const periodStats=async(agency,from,to)=>(await db.query(`SELECT count(*) FILTER(WHERE status<>'CANCELLED')::int visits,count(*) FILTER(WHERE status='COMPLETED')::int completed,COALESCE(sum(EXTRACT(EPOCH FROM(actual_end-actual_start))/60) FILTER(WHERE status='COMPLETED' AND actual_start IS NOT NULL AND actual_end IS NOT NULL),0)::int AS "actualMinutes" FROM node_roster_visits WHERE agency_id=$1 AND visit_date BETWEEN $2 AND $3`,[agency,from,to])).rows[0];
  route("GET", "/api/reports/summary", async (req, res) => {
    auth.admin(req);
    const { from, to } = dateRange(req.query);
    const args = [req.user.agencyId, from, to];
    const byStatus = (
      await db.query(
        `SELECT status,count(*)::int AS visits,COALESCE(sum(EXTRACT(EPOCH FROM(end_time-start_time))/60),0)::int AS minutes,
        COALESCE(sum(EXTRACT(EPOCH FROM(actual_end-actual_start))/60) FILTER(WHERE actual_start IS NOT NULL AND actual_end IS NOT NULL),0)::int AS "actualMinutes"
      FROM node_roster_visits WHERE agency_id=$1 AND visit_date BETWEEN $2 AND $3 GROUP BY status ORDER BY status`,
        args,
      )
    ).rows;
    const staff = (
      await db.query(
        `SELECT u.id,u.role,u.first_name||' '||u.last_name AS name,count(*)::int AS visits,
      count(*) FILTER(WHERE v.status='COMPLETED')::int AS completed,
      COALESCE(sum(EXTRACT(EPOCH FROM(v.end_time-v.start_time))/60) FILTER(WHERE v.status='COMPLETED'),0)::int AS "completedMinutes"
      FROM node_roster_visits v JOIN users u ON u.id=v.staff_id WHERE v.agency_id=$1 AND v.visit_date BETWEEN $2 AND $3 AND v.status<>'CANCELLED'
      GROUP BY u.id ORDER BY name`,
        args,
      )
    ).rows;
    const daily = (
      await db.query(
        `SELECT visit_date::text AS date,count(*)::int AS visits,count(*) FILTER(WHERE status='COMPLETED')::int AS completed
      FROM node_roster_visits WHERE agency_id=$1 AND visit_date BETWEEN $2 AND $3 AND status<>'CANCELLED' GROUP BY visit_date ORDER BY visit_date`,
        args,
      )
    ).rows;
    const clients = (
      await db.query(
        `SELECT u.id,u.first_name||' '||u.last_name AS name,count(*)::int visits,
        count(*) FILTER(WHERE v.status='COMPLETED')::int completed,
        count(*) FILTER(WHERE v.status='COMPLETED' AND (v.actual_start IS NULL OR v.actual_end IS NULL))::int AS "missingActuals",
        COALESCE(sum(EXTRACT(EPOCH FROM(v.end_time-v.start_time))/60),0)::int AS "plannedMinutes",
        COALESCE(sum(EXTRACT(EPOCH FROM(v.actual_end-v.actual_start))/60) FILTER(WHERE v.actual_start IS NOT NULL AND v.actual_end IS NOT NULL),0)::int AS "actualMinutes"
        FROM node_roster_visits v JOIN users u ON u.id=v.client_id
        WHERE v.agency_id=$1 AND v.visit_date BETWEEN $2 AND $3 AND v.status<>'CANCELLED'
        GROUP BY u.id ORDER BY name`, args,
      )
    ).rows;
    const quality = (
      await db.query(
        `SELECT count(*) FILTER(WHERE status<>'CLOSED')::int AS "openCases",
        count(*) FILTER(WHERE status<>'CLOSED' AND due_at<CURRENT_TIMESTAMP)::int AS "overdueCases",
        count(*) FILTER(WHERE severity IN ('HIGH','CRITICAL') AND status<>'CLOSED')::int AS "highRiskCases"
        FROM node_quality_cases WHERE agency_id=$1 AND created_at::date BETWEEN $2 AND $3`, args,
      )
    ).rows[0];
    const money = (
      await db.query(
        `SELECT kind,status,count(*)::int AS documents,COALESCE(sum(total_pence),0)::bigint::text AS "totalPence"
      FROM node_finance_documents WHERE agency_id=$1 AND from_date<=$3 AND to_date>=$2 GROUP BY kind,status ORDER BY kind,status`,
        args,
      )
    ).rows;
    const people = (
      await db.query(
        `SELECT count(*) FILTER(WHERE role='USER' AND is_active AND deleted_at IS NULL)::int AS clients,
      count(*) FILTER(WHERE role<>'USER' AND is_active AND deleted_at IS NULL)::int AS staff FROM users WHERE agency_id=$1`,
        [req.user.agencyId],
      )
    ).rows[0];
    return reply(res, {
      from,
      to,
      byStatus,
      staff,
      daily,
      clients,
      quality,
      money,
      people,
      timezone: "Europe/London",
      currency: "GBP",
    });
  });
  route("GET","/api/reports/caregiver-delivery",async(req,res)=>{
    auth.admin(req);
    const {from,to}=dateRange(req.query,366),staffId=String(req.query.staffId||"");
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(staffId))fail(400,"Select a caregiver");
    const caregiver=(await db.query("SELECT id,first_name||' '||last_name AS name FROM users WHERE id=$1 AND agency_id=$2 AND role='CAREGIVER' AND is_active=true AND deleted_at IS NULL",[staffId,req.user.agencyId])).rows[0];
    if(!caregiver)fail(404,"Caregiver not found");
    const rows=(await db.query(`SELECT v.id,v.client_id AS "clientId",v.visit_date::text AS date,v.title,c.first_name||' '||c.last_name AS "clientName",
      v.actual_start AS "actualStart",v.actual_end AS "actualEnd",COALESCE(EXTRACT(EPOCH FROM(v.actual_end-v.actual_start))/60,0)::int AS "workedMinutes",
      leg.id AS "travelLegId",leg.status AS "travelStatus",leg.suggested_miles AS "suggestedMiles",leg.suggested_minutes AS "suggestedMinutes",leg.approved_miles AS "approvedMiles",leg.approved_minutes AS "approvedMinutes",
      COALESCE(rate.mileage_pence,0) AS "mileagePence",COALESCE(rate.hourly_pence,0) AS "travelHourlyPence"
      FROM node_roster_visits v JOIN users c ON c.id=v.client_id
      LEFT JOIN node_travel_legs leg ON leg.to_visit_id=v.id AND leg.agency_id=v.agency_id
      LEFT JOIN LATERAL (SELECT mileage_pence,hourly_pence FROM node_travel_rates r WHERE r.agency_id=v.agency_id AND r.user_id=v.staff_id AND r.effective_from<=v.visit_date AND (r.effective_to IS NULL OR r.effective_to>=v.visit_date) ORDER BY r.effective_from DESC LIMIT 1) rate ON true
      WHERE v.agency_id=$1 AND v.staff_id=$2 AND v.status='COMPLETED' AND v.visit_date BETWEEN $3 AND $4 ORDER BY v.visit_date,v.actual_start,v.start_time`,[req.user.agencyId,staffId,from,to])).rows.map(row=>{
        const miles=row.travelStatus==='APPROVED'?Number(row.approvedMiles||0):0,minutes=row.travelStatus==='APPROVED'?Number(row.approvedMinutes||0):0;
        return {...row,miles,travelMinutes:minutes,travelPayPence:Math.round(miles*Number(row.mileagePence||0)+(minutes/60)*Number(row.travelHourlyPence||0))};
      });
    return reply(res,{from,to,caregiver,rows,totals:{workedMinutes:rows.reduce((n,x)=>n+Number(x.workedMinutes||0),0),miles:rows.reduce((n,x)=>n+Number(x.miles||0),0),travelMinutes:rows.reduce((n,x)=>n+Number(x.travelMinutes||0),0),travelPayPence:rows.reduce((n,x)=>n+Number(x.travelPayPence||0),0)},note:"Only approved travel between client visits is included. No home or base travel is calculated."});
  });
  route("GET","/api/reports/compare",async(req,res)=>{auth.admin(req);const a=dateRange({from:req.query.fromA,to:req.query.toA}),b=dateRange({from:req.query.fromB,to:req.query.toB});const [current,previous]=await Promise.all([periodStats(req.user.agencyId,a.from,a.to),periodStats(req.user.agencyId,b.from,b.to)]);const delta=(x,y)=>Number(x)-Number(y);return reply(res,{current:{...a,...current},comparison:{...b,...previous},change:{visits:delta(current.visits,previous.visits),completed:delta(current.completed,previous.completed),actualMinutes:delta(current.actualMinutes,previous.actualMinutes)},definitions:{visits:"All non-cancelled scheduled visits",completed:"Visits in Completed status",actualMinutes:"Elapsed verified check-in to check-out time for completed visits"},asOf:new Date().toISOString()})});
  route("GET","/api/reports/reconciliation",async(req,res)=>{auth.admin(req);const {from,to}=dateRange(req.query),agency=req.user.agencyId;const rows=(await db.query(`SELECT v.id,v.visit_date::text date,v.title,v.status,v.actual_start AS "actualStart",v.actual_end AS "actualEnd",bool_or(l.kind='INVOICE' AND l.released=false) invoiced,bool_or(l.kind='PAYRUN' AND l.released=false) paid FROM node_roster_visits v LEFT JOIN node_finance_lines l ON l.visit_id=v.id WHERE v.agency_id=$1 AND v.visit_date BETWEEN $2 AND $3 AND v.status='COMPLETED' GROUP BY v.id ORDER BY v.visit_date,v.id`,[agency,from,to])).rows;const issues=rows.flatMap(v=>[...(!v.actualStart||!v.actualEnd?[{visitId:v.id,date:v.date,title:v.title,kind:"MISSING_ACTUALS"}]:[]),...(!v.invoiced?[{visitId:v.id,date:v.date,title:v.title,kind:"NOT_INVOICED"}]:[]),...(!v.paid?[{visitId:v.id,date:v.date,title:v.title,kind:"NOT_IN_PAYRUN"}]:[])]);return reply(res,{from,to,completedVisits:rows.length,balancedVisits:rows.filter(v=>v.actualStart&&v.actualEnd&&v.invoiced&&v.paid).length,issues,asOf:new Date().toISOString(),note:"Reconciliation checks document inclusion and actual times; it does not confirm bank settlement."})});
}
