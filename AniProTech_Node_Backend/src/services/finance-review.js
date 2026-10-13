import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {reply,fail} from '../http.js';
import {dateRange} from './activity.js';
export function registerFinanceReview({db,auth},route){
 const history=(req,id,action,value)=>db.query('INSERT INTO node_finance_history(id,agency_id,actor_id,subject_id,action,snapshot) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),req.user.agencyId,req.user.id,id,action,JSON.stringify(value)]);
 route('GET','/api/finance/visits',async(req,res)=>{
  auth.admin(req);const {from,to}=dateRange(req.query,30);
  const rows=(await db.query(`SELECT v.id,v.revision,v.status,v.visit_date::text date,v.client_id AS "clientId",v.staff_id AS "staffId",c.first_name||' '||c.last_name AS client,s.first_name||' '||s.last_name AS carer,
   to_char(v.start_time,'HH24:MI') AS "startTime",to_char(v.end_time,'HH24:MI') AS "endTime",
   round(extract(epoch FROM(v.end_time-v.start_time))/60)::int AS planned,
   CASE WHEN v.actual_start IS NOT NULL AND v.actual_end IS NOT NULL THEN round(extract(epoch FROM(v.actual_end-v.actual_start))/60)::int END AS actual,
   EXISTS(SELECT 1 FROM node_visit_events e WHERE e.visit_id=v.id AND e.description LIKE 'Manual attendance correction:%') AS edited,
   COALESCE((SELECT jsonb_build_object('miles',t.miles,'minutes',t.minutes,'source',t.source,'revision',t.revision) FROM node_visit_travel t WHERE t.visit_id=v.id),'null') travel,
   COALESCE((SELECT jsonb_agg(r) FROM node_finance_reviews r WHERE r.visit_id=v.id),'[]') reviews,
   COALESCE((SELECT jsonb_agg(l.kind) FROM node_finance_lines l WHERE l.visit_id=v.id AND NOT l.released),'[]') locked
   FROM node_roster_visits v JOIN users c ON c.id=v.client_id LEFT JOIN users s ON s.id=v.staff_id
   WHERE v.agency_id=$1 AND v.visit_date BETWEEN $2 AND $3 ORDER BY v.visit_date DESC,v.start_time DESC,v.id LIMIT 2001`,[req.user.agencyId,from,to])).rows;
  if(rows.length>2000)fail(400,'Choose a shorter period (maximum 2,000 visits).');
  const groups=(await db.query(`SELECT g.user_id,g.groups FROM node_team_groups g JOIN users u ON u.id=g.user_id WHERE u.agency_id=$1`,[req.user.agencyId])).rows;
  return reply(res,{visits:rows,groups});
 });
 route('POST','/api/finance/visits/review',async(req,res)=>{
  auth.admin(req);
  const parsed=z.object({items:z.array(z.object({id:z.uuid(),revision:z.number().int().positive(),reviewRevision:z.number().int().nonnegative()})).min(1).max(100),kind:z.enum(['PAY','BILLING']),state:z.enum(['CONFIRMED','DISCARDED']),basis:z.enum(['PLANNED','ACTUAL']),reason:z.string().trim().min(5).max(1000)}).safeParse(req.body);
  if(!parsed.success)fail(400,'Select up to 100 visits and enter a review reason.');const b=parsed.data;
  await db.query('SELECT id FROM users WHERE agency_id=$1 ORDER BY id FOR UPDATE',[req.user.agencyId]);
  for(const item of [...b.items].sort((a,b)=>a.id.localeCompare(b.id))){
   const v=(await db.query('SELECT *,round(extract(epoch FROM(end_time-start_time))/60)::int planned,round(extract(epoch FROM(actual_end-actual_start))/60)::int actual FROM node_roster_visits WHERE id=$1 AND agency_id=$2 FOR UPDATE',[item.id,req.user.agencyId])).rows[0];
   if(!v)fail(404,'Visit not found');if(v.revision!==item.revision)fail(409,'A visit changed. Refresh and review again.');
   const old=(await db.query('SELECT * FROM node_finance_reviews WHERE visit_id=$1 AND kind=$2',[v.id,b.kind])).rows[0];
   if((old?.revision||0)!==item.reviewRevision)fail(409,'A finance decision changed. Refresh and review again.');
   if((await db.query('SELECT id FROM node_finance_lines WHERE visit_id=$1 AND kind=$2 AND NOT released',[v.id,b.kind==='PAY'?'PAYRUN':'INVOICE'])).rows.length)fail(409,'This visit is already included in a finance document.');
   const minutes=b.basis==='ACTUAL'?v.actual:v.planned;
   if(b.state==='CONFIRMED'&&(v.status!=='COMPLETED'||minutes==null||minutes<0||minutes>10080))fail(400,'Only completed visits with valid selected timings can be confirmed.');
   await db.query(`INSERT INTO node_finance_reviews(visit_id,kind,state,basis,minutes,visit_revision) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(visit_id,kind) DO UPDATE SET state=EXCLUDED.state,basis=EXCLUDED.basis,minutes=EXCLUDED.minutes,visit_revision=EXCLUDED.visit_revision,revision=node_finance_reviews.revision+1`,[v.id,b.kind,b.state,b.basis,b.state==='DISCARDED'?0:minutes,v.revision]);
   await history(req,v.id,'VISIT_REVIEW',{before:old||null,...b,items:undefined,visitId:v.id,minutes});
  }return reply(res,{},'Review saved');
 });
 route('GET','/api/finance/history',async(req,res)=>{auth.admin(req);return reply(res,(await db.query(`SELECT h.action,h.snapshot,h.created_at,u.first_name||' '||u.last_name AS actor FROM node_finance_history h LEFT JOIN users u ON u.id=h.actor_id WHERE h.agency_id=$1 ORDER BY h.created_at DESC,h.id LIMIT 100`,[req.user.agencyId])).rows);});
 const serviceTypes=['THIRTY_MINUTES','HOURLY','THREE_HOURS','SIX_HOURS','HALF_DAY','FULL_DAY','DAY','WEEKLY','WAKING_NIGHT','SLEEPING_NIGHT'];
 route('GET','/api/finance/travel-rates',async(req,res)=>{auth.admin(req);const range=req.query.from||req.query.to?dateRange(req.query,366):null;return reply(res,(await db.query(`SELECT r.*,u.first_name||' '||u.last_name AS name FROM node_travel_rates r JOIN users u ON u.id=r.user_id WHERE r.agency_id=$1${range?' AND r.effective_from<=$3 AND (r.effective_to IS NULL OR r.effective_to>=$2)':''} ORDER BY effective_from DESC`,range?[req.user.agencyId,range.from,range.to]:[req.user.agencyId])).rows);});
 route('POST','/api/finance/travel-rates',async(req,res)=>{
  auth.admin(req);const p=z.object({userId:z.uuid(),effectiveFrom:z.string(),effectiveTo:z.string().optional().nullable(),mileagePence:z.number().int().min(0).max(100000),hourlyPence:z.number().int().min(0).max(1000000)}).safeParse(req.body);if(!p.success)fail(400,'Enter valid travel rates.');const b=p.data;dateRange({from:b.effectiveFrom,to:b.effectiveTo||b.effectiveFrom});const u=await auth.userAccess(req,b.userId);if(u.role==='USER'||u.deletedAt)fail(400,'Select a staff member.');
  await db.query(`INSERT INTO node_travel_rates(id,agency_id,user_id,effective_from,effective_to,mileage_pence,hourly_pence) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(user_id,effective_from) DO UPDATE SET effective_to=EXCLUDED.effective_to,mileage_pence=EXCLUDED.mileage_pence,hourly_pence=EXCLUDED.hourly_pence`,[randomUUID(),req.user.agencyId,b.userId,b.effectiveFrom,b.effectiveTo||null,b.mileagePence,b.hourlyPence]);await history(req,b.userId,'TRAVEL_RATE_SAVED',b);return reply(res,{},'Travel rate saved');
 });
 route('GET','/api/finance/service-hours',async(req,res)=>{auth.admin(req);const range=req.query.from||req.query.to?dateRange(req.query,366):null;return reply(res,(await db.query(`SELECT r.id,r.user_id AS "userId",r.effective_from::text AS "effectiveFrom",r.effective_to::text AS "effectiveTo",r.weekly_minutes AS "weeklyMinutes",r.funding_source AS "fundingSource",r.reference,u.first_name||' '||u.last_name AS name FROM node_client_service_hours r JOIN users u ON u.id=r.user_id WHERE r.agency_id=$1${range?' AND r.effective_from<=$3 AND (r.effective_to IS NULL OR r.effective_to>=$2)':''} ORDER BY effective_from DESC,u.first_name`,range?[req.user.agencyId,range.from,range.to]:[req.user.agencyId])).rows);});
 route('POST','/api/finance/service-hours',async(req,res)=>{
  auth.admin(req);const p=z.object({userId:z.uuid(),effectiveFrom:z.string(),effectiveTo:z.string().optional().nullable(),weeklyMinutes:z.number().int().min(0).max(10080),fundingSource:z.string().trim().max(100),reference:z.string().trim().max(100)}).safeParse(req.body);if(!p.success)fail(400,'Enter valid weekly client service hours.');const b=p.data;dateRange({from:b.effectiveFrom,to:b.effectiveTo||b.effectiveFrom});const u=await auth.userAccess(req,b.userId);if(u.role!=='USER'||u.deletedAt)fail(400,'Select an active client.');
  await db.query(`INSERT INTO node_client_service_hours(id,agency_id,user_id,effective_from,effective_to,weekly_minutes,funding_source,reference) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(user_id,effective_from) DO UPDATE SET effective_to=EXCLUDED.effective_to,weekly_minutes=EXCLUDED.weekly_minutes,funding_source=EXCLUDED.funding_source,reference=EXCLUDED.reference`,[randomUUID(),req.user.agencyId,b.userId,b.effectiveFrom,b.effectiveTo||null,b.weeklyMinutes,b.fundingSource,b.reference]);await history(req,b.userId,'SERVICE_HOURS_SAVED',b);return reply(res,{},'Client service hours saved');
 });
 route('GET','/api/finance/client-service-rates/:userId',async(req,res)=>{auth.admin(req);const user=await auth.userAccess(req,req.params.userId);if(user.role!=='USER')fail(400,'Select a client.');return reply(res,(await db.query(`SELECT service_type AS "serviceType",hourly_pence AS "hourlyPence",effective_from::text AS "effectiveFrom",effective_to::text AS "effectiveTo" FROM node_client_funding_service_rates WHERE agency_id=$1 AND user_id=$2 ORDER BY effective_from DESC,service_type`,[req.user.agencyId,user.id])).rows);});
 route('POST','/api/finance/client-service-rates',async(req,res)=>{auth.admin(req);const p=z.object({userId:z.uuid(),effectiveFrom:z.string(),effectiveTo:z.string().optional().nullable(),rates:z.array(z.object({serviceType:z.enum(serviceTypes),hourlyPence:z.number().int().min(0).max(1000000)})).min(1).max(serviceTypes.length)}).safeParse(req.body);if(!p.success)fail(400,'Choose at least one funded service and enter valid hourly rates.');const b=p.data;if(new Set(b.rates.map(x=>x.serviceType)).size!==b.rates.length)fail(400,'Choose each funded service once.');dateRange({from:b.effectiveFrom,to:b.effectiveTo||b.effectiveFrom});const u=await auth.userAccess(req,b.userId);if(u.role!=='USER'||u.deletedAt)fail(400,'Select an active client.');await db.transaction(async()=>{await db.query('DELETE FROM node_client_funding_service_rates WHERE agency_id=$1 AND user_id=$2 AND effective_from=$3',[req.user.agencyId,u.id,b.effectiveFrom]);for(const rate of b.rates)await db.query('INSERT INTO node_client_funding_service_rates(id,agency_id,user_id,service_type,hourly_pence,effective_from,effective_to) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),req.user.agencyId,u.id,rate.serviceType,rate.hourlyPence,b.effectiveFrom,b.effectiveTo||null]);});await history(req,u.id,'CLIENT_FUNDING_SERVICE_RATES_SAVED',b);return reply(res,{},'Client funded service rates saved');
 });
 route('GET','/api/finance/overview',async(req,res)=>{
  auth.admin(req);const {from,to}=dateRange(req.query,366);const days=Math.round((Date.parse(to)-Date.parse(from))/86400000)+1;
  const staff=(await db.query(`SELECT u.id,u.first_name||' '||u.last_name AS name,COALESCE(o.weekly_contracted_hours,0)::numeric AS "weeklyHours",
   COALESCE(sum(r.minutes) FILTER(WHERE r.kind='PAY' AND r.state='CONFIRMED' AND r.visit_revision=v.revision),0)::int AS "confirmedMinutes",
   count(DISTINCT v.id) FILTER(WHERE r.kind='PAY' AND r.state='CONFIRMED' AND r.visit_revision=v.revision)::int visits
   FROM users u LEFT JOIN team_onboarding o ON o.user_id=u.id LEFT JOIN node_roster_visits v ON v.staff_id=u.id AND v.visit_date BETWEEN $2 AND $3 LEFT JOIN node_finance_reviews r ON r.visit_id=v.id
   WHERE u.agency_id=$1 AND u.role='CAREGIVER' AND u.deleted_at IS NULL GROUP BY u.id,o.weekly_contracted_hours ORDER BY name`,[req.user.agencyId,from,to])).rows.map(x=>({...x,contractMinutes:Math.round(Number(x.weeklyHours)*60*days/7)}));
  const clients=(await db.query(`SELECT u.id,u.first_name||' '||u.last_name AS name,
   COALESCE((SELECT weekly_minutes FROM node_client_service_hours sh WHERE sh.user_id=u.id AND sh.effective_from<=$3 ORDER BY effective_from DESC LIMIT 1),0)::int AS "weeklyMinutes",
   COALESCE(sum(r.minutes) FILTER(WHERE r.kind='BILLING' AND r.state='CONFIRMED' AND r.visit_revision=v.revision),0)::int AS "confirmedMinutes",
   count(DISTINCT v.id) FILTER(WHERE r.kind='BILLING' AND r.state='CONFIRMED' AND r.visit_revision=v.revision)::int visits
   FROM users u LEFT JOIN node_roster_visits v ON v.client_id=u.id AND v.visit_date BETWEEN $2 AND $3 LEFT JOIN node_finance_reviews r ON r.visit_id=v.id
   WHERE u.agency_id=$1 AND u.role='USER' AND u.deleted_at IS NULL GROUP BY u.id ORDER BY name`,[req.user.agencyId,from,to])).rows.map(x=>({...x,serviceMinutes:Math.round(x.weeklyMinutes*days/7)}));
  return reply(res,{from,to,days,staff,clients,currency:'GBP'});
 });
}
