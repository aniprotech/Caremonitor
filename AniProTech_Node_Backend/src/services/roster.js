import { visitEvent } from "../client-feed-schema.js";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { reply, fail } from "../http.js";
import { registerPlanning } from './roster-planning.js';

const dayMs = 86400000;
const dateOnly = (value) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !isNaN(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
const input = z.object({
  clientId: z.uuid(),
  staffId: z.uuid().nullable(),
  date: z.string().refine(dateOnly),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  title: z.string().trim().min(1).max(160),
  notes: z.string().max(4000).default(""),
  status: z.enum(["DRAFT", "SCHEDULED"]),
  // Legacy clients send repeatWeeks. New schedules use an explicit recurrence.
  repeatWeeks: z.number().int().min(1).max(12).default(1),
  frequency: z.enum(["DAILY", "WEEKLY", "CUSTOM"]).optional(),
  selectedDays: z.array(z.enum(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"])).max(7).default([]),
  repeatEvery: z.number().int().min(1).max(12).default(1),
  repeatUnit: z.enum(["DAYS", "WEEKS"]).default("WEEKS"),
  endDate: z.string().refine(dateOnly).nullable().optional(),
  requiredStaff: z.number().int().min(1).max(4).default(1),
  openShift: z.boolean().default(false),
  revision: z.number().int().positive().optional(),
});
export function occursOn(row, day) {
  if (
    row.deletedAt ||
    day < row.startDate ||
    (row.isEnds && row.endDate && day > row.endDate) ||
    row.deletedDate?.includes(day)
  )
    return false;
  const offset = Math.round(
    (Date.parse(day) - Date.parse(row.startDate)) / dayMs,
  );
  const weekday = [
    "SUNDAY",
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
  ][new Date(day).getUTCDay()];
  if (row.frequency === "DAILY") return true;
  if (row.frequency === "WEEKLY") return row.selectedDays?.includes(weekday);
  if (row.frequency === "CUSTOM") {
    const every = Number(row.repeatEvery);
    if (!Number.isInteger(every) || every < 1) return false;
    if (row.repeatUnit === "DAYS") return offset % every === 0;
    // Weekly recurrence is anchored to the Monday of the starting week.
    const startWeekday = (new Date(row.startDate).getUTCDay() + 6) % 7;
    return (
      Math.floor((offset + startWeekday) / 7) % every === 0 &&
      row.selectedDays?.includes(weekday)
    );
  }
  return day === row.startDate;
}
const select = `SELECT v.id,v.client_id AS "clientId",v.staff_id AS "staffId",v.visit_date::text AS date,
  to_char(v.start_time,'HH24:MI') AS "startTime",to_char(v.end_time,'HH24:MI') AS "endTime",
  v.title,v.notes,v.status,v.revision,v.call_group_id AS "callGroupId",v.required_staff AS "requiredStaff",
  v.slot_index AS "slotIndex",v.open_shift AS "openShift",c.first_name || ' ' || c.last_name AS "clientName",
  s.first_name || ' ' || s.last_name AS "staffName",
  concat_ws(', ',a.address_line1,a.city,a.postal_code) AS "clientAddress" FROM node_roster_visits v
  JOIN users c ON c.id=v.client_id LEFT JOIN users s ON s.id=v.staff_id
  LEFT JOIN LATERAL (SELECT address_line1,city,postal_code FROM user_primary_address
    WHERE user_id=v.client_id AND deleted_at IS NULL ORDER BY is_primary DESC,id LIMIT 1) a ON true`;

export function registerRoster(ctx, route) {
  const { db, repo, auth, push } = ctx;
  async function lock(req) {
    if (!req.user.agencyId) fail(403, "An organisation is required");
    await db.query(
      "SELECT id FROM users WHERE agency_id=$1 ORDER BY id FOR UPDATE",
      [req.user.agencyId],
    );
  }
  async function get(req, id) {
    const row = (
      await db.query(select + " WHERE v.id=$1 AND v.agency_id=$2", [
        id,
        req.user.agencyId,
      ])
    ).rows[0];
    if (!row || (req.user.role === "CAREGIVER" && row.staffId !== req.user.id))
      fail(404, "Visit not found");
    return row;
  }
  async function check(req, v, id = null) {
    if (v.endTime <= v.startTime)
      fail(400, "End time must be after start time on the same day");
    const date = new Date(v.date),
      month = date.getUTCMonth();
    const clockChange =
      [2, 9].includes(month) &&
      date.getUTCDay() === 0 &&
      new Date(date.getTime() + 7 * dayMs).getUTCMonth() !== month;
    if (clockChange && v.startTime < "02:00" && v.endTime > "01:00")
      fail(
        400,
        "Visits across the London clock-change hour need to be split outside 01:00–02:00",
      );
    const client = await auth.userAccess(req, v.clientId, { write: req.user.role !== "CAREGIVER" });
    if (client.role !== "USER" || !client.isActive || client.deletedAt)
      fail(400, "Choose an active client");
    const inactivity = await repo.find("ClientInactivityEntity", {
      user: v.clientId,
    });
    if (
      inactivity.some(
        (i) =>
          !i.deletedAt &&
          i.startDate &&
          i.startDate + "T" + (i.startTime || "00:00:00") <
            v.date + "T" + v.endTime + ":00" &&
          (i.type === "PERMANENT" ||
            !i.endDate ||
            i.endDate + "T" + (i.endTime || "23:59:59") >
              v.date + "T" + v.startTime + ":00"),
      )
    )
      fail(409, "The client is inactive during this visit");
    if (v.status === "SCHEDULED" && !v.staffId)
      fail(400, "Assign a staff member before scheduling");
    if (v.staffId) {
      const staff = await auth.userAccess(req, v.staffId, {
        staff: true,
        write: req.user.role !== "CAREGIVER",
      });
      if (!staff.isActive || staff.deletedAt)
        fail(400, "Choose an active staff member");
      const absences = await repo.find("TeamAbsenceEntity", {
        user: v.staffId,
      });
      const start = v.date + "T" + v.startTime + ":00",
        end = v.date + "T" + v.endTime + ":00";
      if (
        absences.some(
          (a) =>
            !a.deletedAt &&
            a.startDate + "T" + (a.startTime || "00:00:00") < end &&
            (a.endDate || a.startDate) + "T" + (a.endTime || "23:59:59") >
              start,
        )
      )
        fail(409, "Staff member is absent during this visit");
      const availability = (
        await repo.find("TeamAvailabilityEntity", { user: v.staffId })
      ).filter((a) => !a.deletedAt);
      if (
        availability.length &&
        !availability.some(
          (a) =>
            occursOn(a, v.date) &&
            a.startTime.slice(0, 5) <= v.startTime &&
            a.endTime.slice(0, 5) >= v.endTime,
        )
      )
        fail(409, "Visit is outside this staff member’s recorded availability");
      const rules=(await db.query("SELECT * FROM node_workforce_rules WHERE agency_id=$1",[req.user.agencyId])).rows[0]||{max_daily_minutes:720,max_weekly_minutes:3600,min_rest_minutes:660,travel_speed_mph:25,travel_buffer_minutes:10};
      const duration=Number(v.endTime.slice(0,2))*60+Number(v.endTime.slice(3,5))-Number(v.startTime.slice(0,2))*60-Number(v.startTime.slice(3,5));
      const totals=(await db.query(`SELECT COALESCE(sum(extract(epoch FROM(end_time-start_time))/60),0)::int daily,
        COALESCE(sum(extract(epoch FROM(end_time-start_time))/60) FILTER(WHERE visit_date BETWEEN date_trunc('week',$2::date)::date AND (date_trunc('week',$2::date)+interval '6 days')::date),0)::int weekly
        FROM node_roster_visits WHERE agency_id=$1 AND staff_id=$3 AND status<>'CANCELLED' AND ($4::uuid IS NULL OR id<>$4)
        AND (visit_date=$2 OR visit_date BETWEEN date_trunc('week',$2::date)::date AND (date_trunc('week',$2::date)+interval '6 days')::date)`,[req.user.agencyId,v.date,v.staffId,id])).rows[0];
      if(Number(totals.daily)+duration>rules.max_daily_minutes)fail(409,"Assignment exceeds the organisation's daily working-time limit");
      if(Number(totals.weekly)+duration>rules.max_weekly_minutes)fail(409,"Assignment exceeds the organisation's weekly working-time limit");
      const adjacent=(await db.query(`SELECT x.client_id AS "clientId",x.visit_date::text date,to_char(x.start_time,'HH24:MI') "startTime",to_char(x.end_time,'HH24:MI') "endTime",
        a.latitude,a.longitude FROM node_roster_visits x LEFT JOIN user_primary_address a ON a.user_id=x.client_id AND a.is_primary=true
        WHERE x.agency_id=$1 AND x.staff_id=$2 AND x.status<>'CANCELLED' AND ($3::uuid IS NULL OR x.id<>$3)
        AND x.visit_date BETWEEN $4::date-1 AND $4::date+1 ORDER BY x.visit_date,x.start_time`,[req.user.agencyId,v.staffId,id,v.date])).rows;
      const rest=(leftDate,leftTime,rightDate,rightTime)=>(Date.parse(`${rightDate}T${rightTime}:00Z`)-Date.parse(`${leftDate}T${leftTime}:00Z`))/60000;
      const previous=adjacent.filter(x=>`${x.date}T${x.endTime}`<=`${v.date}T${v.startTime}`).at(-1),next=adjacent.find(x=>`${x.date}T${x.startTime}`>=`${v.date}T${v.endTime}`);
      if(previous&&previous.date!==v.date&&rest(previous.date,previous.endTime,v.date,v.startTime)<rules.min_rest_minutes)fail(409,"Assignment does not leave the required rest period after the previous shift");
      if(next&&next.date!==v.date&&rest(v.date,v.endTime,next.date,next.startTime)<rules.min_rest_minutes)fail(409,"Assignment does not leave the required rest period before the next shift");
      const targetAddress=(await db.query("SELECT latitude,longitude FROM user_primary_address WHERE user_id=$1 AND is_primary=true LIMIT 1",[v.clientId])).rows[0];
      const distanceMiles=(a,b)=>{if(a?.latitude==null||a?.longitude==null||b?.latitude==null||b?.longitude==null)return null;const rad=n=>n*Math.PI/180,dLat=rad(Number(b.latitude)-Number(a.latitude)),dLon=rad(Number(b.longitude)-Number(a.longitude)),x=Math.sin(dLat/2)**2+Math.cos(rad(Number(a.latitude)))*Math.cos(rad(Number(b.latitude)))*Math.sin(dLon/2)**2;return 3958.8*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));};
      for(const [other,gap] of [[previous,previous&&previous.date===v.date?rest(previous.date,previous.endTime,v.date,v.startTime):null],[next,next&&next.date===v.date?rest(v.date,v.endTime,next.date,next.startTime):null]])if(other&&gap!=null&&other.clientId!==v.clientId){const miles=distanceMiles(other,targetAddress);if(miles!=null){const needed=Math.ceil(miles/Math.max(5,rules.travel_speed_mph)*60)+rules.travel_buffer_minutes;if(gap<needed)fail(409,`Travel gap is ${gap} minutes; at least ${needed} minutes is required from recorded client locations`);}}
    }
    const overlap = await db.query(
      `SELECT id FROM node_roster_visits WHERE agency_id=$1 AND visit_date=$2
      AND status<>'CANCELLED' AND ($3::uuid IS NULL OR id<>$3) AND start_time<$5::time AND end_time>$4::time
      AND ((client_id=$6 AND ($8::uuid IS NULL OR call_group_id IS DISTINCT FROM $8)) OR ($7::uuid IS NOT NULL AND staff_id=$7)) LIMIT 1`,
      [
        req.user.agencyId,
        v.date,
        id,
        v.startTime,
        v.endTime,
        v.clientId,
        v.staffId,
        v.callGroupId||null,
      ],
    );
    if (overlap.rows.length)
      fail(409, "This client or staff member already has an overlapping visit");
  }
  registerPlanning({...ctx,check,lock,get,select,input},route);
  route("GET", "/api/roster/options", async (req, res) => {
    const people = await repo.find("UserEntity", {
      agencyId: req.user.agencyId,
    });
    const active = people.filter((u) => u.isActive && !u.deletedAt);
    const safe = (u) => ({
      id: u.id,
      name: [u.firstName, u.lastName].filter(Boolean).join(" "),
    });
    const caregiver = req.user.role === "CAREGIVER";
    return reply(res, {
      timezone: "Europe/London",
      canManage: !caregiver,
      clients: caregiver
        ? []
        : active.filter((u) => u.role === "USER").map(safe),
      staff: active
        .filter(
          (u) => u.role !== "USER" && (!caregiver || u.id === req.user.id),
        )
        .map(safe),
    });
  });
  route("GET", "/api/roster/workforce-rules",async(req,res)=>{const row=(await db.query("SELECT max_daily_minutes AS \"maxDailyMinutes\",max_weekly_minutes AS \"maxWeeklyMinutes\",min_rest_minutes AS \"minRestMinutes\",travel_speed_mph AS \"travelSpeedMph\",travel_buffer_minutes AS \"travelBufferMinutes\" FROM node_workforce_rules WHERE agency_id=$1",[req.user.agencyId])).rows[0]||{maxDailyMinutes:720,maxWeeklyMinutes:3600,minRestMinutes:660,travelSpeedMph:25,travelBufferMinutes:10};return reply(res,row)});
  route("PUT", "/api/roster/workforce-rules",async(req,res)=>{auth.admin(req);const p=z.object({maxDailyMinutes:z.number().int().min(60).max(1440),maxWeeklyMinutes:z.number().int().min(60).max(10080),minRestMinutes:z.number().int().min(0).max(1440),travelSpeedMph:z.number().int().min(5).max(80),travelBufferMinutes:z.number().int().min(0).max(120)}).safeParse(req.body);if(!p.success)fail(400,"Enter valid workforce limits");const b=p.data;await db.query(`INSERT INTO node_workforce_rules(agency_id,max_daily_minutes,max_weekly_minutes,min_rest_minutes,travel_speed_mph,travel_buffer_minutes,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(agency_id) DO UPDATE SET max_daily_minutes=EXCLUDED.max_daily_minutes,max_weekly_minutes=EXCLUDED.max_weekly_minutes,min_rest_minutes=EXCLUDED.min_rest_minutes,travel_speed_mph=EXCLUDED.travel_speed_mph,travel_buffer_minutes=EXCLUDED.travel_buffer_minutes,updated_by=EXCLUDED.updated_by,updated_at=CURRENT_TIMESTAMP`,[req.user.agencyId,b.maxDailyMinutes,b.maxWeeklyMinutes,b.minRestMinutes,b.travelSpeedMph,b.travelBufferMinutes,req.user.id]);return reply(res,b,"Workforce rules saved")});
  route("GET", "/api/roster/visits", async (req, res) => {
    const { from, to } = req.query;
    if (
      !dateOnly(from) ||
      !dateOnly(to) ||
      to < from ||
      (Date.parse(to) - Date.parse(from)) / dayMs > 62
    )
      fail(400, "Choose a date range of up to 63 days");
    const rows = (
      await db.query(
        select +
          ` WHERE v.agency_id=$1 AND v.visit_date BETWEEN $2 AND $3
      AND ($4::uuid IS NULL OR (v.staff_id=$4 AND v.visit_date<=((CURRENT_TIMESTAMP AT TIME ZONE 'Europe/London')::date+6))) ORDER BY v.visit_date,v.start_time,v.id`,
        [
          req.user.agencyId,
          from,
          to,
          req.user.role === "CAREGIVER" ? req.user.id : null,
        ],
      )
    ).rows;
    return reply(res, { visits: rows, timezone: "Europe/London" });
  });
  route("GET","/api/roster/open-shifts",async(req,res)=>{const {from,to}=req.query;if(!dateOnly(from)||!dateOnly(to)||to<from||(Date.parse(to)-Date.parse(from))/dayMs>62)fail(400,"Choose a date range of up to 63 days");const rows=(await db.query(select+` JOIN client_care_team ct ON ct.client_id=v.client_id AND ct.carer_id=$4 AND ct.deleted_at IS NULL AND COALESCE(ct.decline_carer,false)=false AND COALESCE(ct.revoke_viewaccess,false)=false AND COALESCE(ct.allowed_to_visit,false)=true WHERE v.agency_id=$1 AND v.visit_date BETWEEN $2 AND $3 AND v.visit_date<=((CURRENT_TIMESTAMP AT TIME ZONE 'Europe/London')::date+6) AND v.open_shift=true AND v.staff_id IS NULL AND v.status='DRAFT' ORDER BY v.visit_date,v.start_time,v.id`,[req.user.agencyId,from,to,req.user.id])).rows;return reply(res,{visits:rows,timezone:"Europe/London"})});
  route("POST", "/api/roster/visits", async (req, res) => {
    auth.admin(req);
    const parsed = input.safeParse(req.body);
    if (!parsed.success)
      fail(400, "Enter a valid client, date, times, title and status");
    const v = parsed.data;
    await lock(req);
    const visits = [];
    const weekdays = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
    // "Never" is intentionally bounded: visits are concrete care records, so we create
    // a rolling 12-week horizon rather than an unbounded number of rows.
    const horizon = v.endDate || new Date(Date.parse(v.date) + 83 * dayMs).toISOString().slice(0, 10);
    const dates = [];
    if (!v.frequency) {
      for (let week = 0; week < v.repeatWeeks; week++) dates.push(new Date(Date.parse(v.date) + week * 7 * dayMs).toISOString().slice(0, 10));
    } else {
      for (let time = Date.parse(v.date); time <= Date.parse(horizon); time += dayMs) {
        const date = new Date(time).toISOString().slice(0, 10);
        const offset = Math.round((time - Date.parse(v.date)) / dayMs);
        const weekday = weekdays[new Date(time).getUTCDay()];
        const selected = v.selectedDays.length ? v.selectedDays : [weekdays[new Date(Date.parse(v.date)).getUTCDay()]];
        const matches = v.frequency === "DAILY"
          ? offset % v.repeatEvery === 0
          : v.repeatUnit === "DAYS"
            ? offset % v.repeatEvery === 0
            : Math.floor(offset / 7) % v.repeatEvery === 0 && selected.includes(weekday);
        if (matches) dates.push(date);
      }
    }
    if (!dates.length || dates.length > 90) fail(400, "Choose a schedule that creates between 1 and 90 visits");
    for (const date of dates) {
      const visit = {
        ...v,
        date,
      };
      const callGroupId=v.requiredStaff>1?randomUUID():null;
      await check(req,{...visit,callGroupId});
      for(let slot=1;slot<=v.requiredStaff;slot+=1){const id=randomUUID(),staffId=slot===1?v.staffId:null,status=staffId?v.status:"DRAFT",openShift=!staffId&&(v.openShift||v.requiredStaff>1);await db.query(
        `INSERT INTO node_roster_visits(id,agency_id,client_id,staff_id,visit_date,start_time,end_time,title,notes,status,call_group_id,required_staff,slot_index,open_shift,created_by,updated_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15)`,
        [id,req.user.agencyId,v.clientId,staffId,visit.date,v.startTime,v.endTime,v.title,v.notes,status,callGroupId,v.requiredStaff,slot,openShift,req.user.id]);
        await visitEvent(db,id,req.user.id,v.requiredStaff>1?`Double-up visit slot ${slot} of ${v.requiredStaff} created`:openShift?"Open shift created":"Visit schedule created");visits.push(await get(req,id));}
    }
    const assigned=[...new Set(visits.map((item)=>item.staffId).filter(Boolean))];
    if(assigned.length)req.afterCommit.push(()=>push.sendToUsers(req.user.agencyId,assigned,"Your visits have been updated. Open Caremonitor to view your rota."));
    return reply(res, { visits }, "Visits created", 201);
  });
  route("PUT", "/api/roster/visits/:id", async (req, res) => {
    auth.admin(req);
    await lock(req);
    const old = await get(req, req.params.id);
    const parsed = input.safeParse(req.body);
    if (!parsed.success) fail(400, "Enter valid visit details");
    const v = parsed.data;
    if (v.revision !== old.revision)
      fail(409, "This visit changed. Refresh before saving");
    if (!["DRAFT", "SCHEDULED"].includes(old.status))
      fail(409, "Only draft or scheduled visits can be edited");
    if (v.repeatWeeks !== 1) fail(400, "Edit one visit at a time");
    const siblings=old.callGroupId?(await db.query(select+" WHERE v.call_group_id=$1 AND v.agency_id=$2 ORDER BY v.slot_index",[old.callGroupId,req.user.agencyId])).rows:[old];
    for(const sibling of siblings){const proposed={...v,staffId:sibling.id===old.id?v.staffId:sibling.staffId,status:sibling.id===old.id?v.status:sibling.status,openShift:sibling.id===old.id?v.openShift:sibling.openShift,callGroupId:old.callGroupId};await check(req,proposed,sibling.id);}
    if(old.callGroupId)await db.query(`UPDATE node_roster_visits SET client_id=$2,visit_date=$3,start_time=$4,end_time=$5,title=$6,notes=$7,revision=revision+1,updated_by=$8,updated_at=CURRENT_TIMESTAMP WHERE call_group_id=$1 AND id<>$9`,[old.callGroupId,v.clientId,v.date,v.startTime,v.endTime,v.title,v.notes,req.user.id,old.id]);
    await db.query(
      `UPDATE node_roster_visits SET client_id=$2,staff_id=$3,visit_date=$4,start_time=$5,end_time=$6,title=$7,notes=$8,status=$9,open_shift=$11,
      revision=revision+1,updated_by=$10,updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
      [
        old.id,
        v.clientId,
        v.staffId,
        v.date,
        v.startTime,
        v.endTime,
        v.title,
        v.notes,
        v.status,
        req.user.id,
        v.openShift&&!v.staffId,
      ],
    );
    for(const sibling of siblings)await visitEvent(db,sibling.id,req.user.id,old.callGroupId?"Double-up call schedule updated":"Visit schedule or assigned carer updated");
    if(v.staffId && (v.staffId!==old.staffId||v.date!==old.date||v.startTime!==old.startTime||v.endTime!==old.endTime))
      req.afterCommit.push(()=>push.sendToUsers(req.user.agencyId,[v.staffId],"Your visits have been updated. Open Caremonitor to view your rota."));
    return reply(res, await get(req, old.id), "Visit updated");
  });
  route("POST","/api/roster/visits/:id/claim",async(req,res)=>{await lock(req);const old=(await db.query(select+" WHERE v.id=$1 AND v.agency_id=$2 FOR UPDATE OF v",[req.params.id,req.user.agencyId])).rows[0];if(!old)fail(404,"Visit not found");if(!old.openShift||old.staffId||old.status!=="DRAFT")fail(409,"This open shift is no longer available");const staffId=req.user.role==="CAREGIVER"?req.user.id:req.body.staffId;if(!staffId)fail(400,"Choose a staff member");if(req.user.role==="CAREGIVER"){const link=await repo.one("ClientCareTeamEntity",{client:old.clientId,carer:staffId});if(!link||link.deletedAt||link.declineCarer||link.revokeViewaccess||!link.allowedToVisit)fail(403,"This shift is not available to your care team");}const proposed={...old,staffId,status:"SCHEDULED",repeatWeeks:1,requiredStaff:old.requiredStaff||1,openShift:false,callGroupId:old.callGroupId};await check(req,proposed,old.id);const claimed=await db.query("UPDATE node_roster_visits SET staff_id=$2,status='SCHEDULED',open_shift=false,revision=revision+1,updated_by=$3,updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND staff_id IS NULL AND open_shift=true AND status='DRAFT' RETURNING id",[old.id,staffId,req.user.id]);if(!claimed.rows.length)fail(409,"This open shift is no longer available");await visitEvent(db,old.id,req.user.id,"Open shift claimed");return reply(res,await get(req,old.id),"Open shift assigned")});
  route("POST", "/api/roster/visits/:id/status", async (req, res) => {
    await lock(req);
    const old = await get(req, req.params.id),
      next = req.body.status;
    if (req.body.revision !== old.revision)
      fail(409, "This visit changed. Refresh before updating");
    const transitions = {
      DRAFT: ["CANCELLED"],
      SCHEDULED: ["IN_PROGRESS", "CANCELLED"],
      IN_PROGRESS: ["COMPLETED", "CANCELLED"],
      COMPLETED: [],
      CANCELLED: [],
    };
    if (!transitions[old.status].includes(next))
      fail(400, "This status change is not allowed");
    if (req.user.role === "CAREGIVER" && next === "CANCELLED")
      fail(403, "Only an administrator can cancel visits");
    await db.query(
      "UPDATE node_roster_visits SET status=$2,revision=revision+1,updated_by=$3,updated_at=CURRENT_TIMESTAMP WHERE id=$1",
      [old.id, next, req.user.id],
    );
    if (next === "IN_PROGRESS") await db.query("UPDATE node_roster_visits SET actual_start=COALESCE(actual_start,CURRENT_TIMESTAMP) WHERE id=$1", [old.id]);
    if (next === "COMPLETED") await db.query("UPDATE node_roster_visits SET actual_end=COALESCE(actual_end,CURRENT_TIMESTAMP) WHERE id=$1", [old.id]);
    await visitEvent(db, old.id, req.user.id, `Visit status changed from ${old.status} to ${next}`);
    return reply(res, await get(req, old.id), "Visit status updated");
  });
}
