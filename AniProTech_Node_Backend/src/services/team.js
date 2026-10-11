import { reply, fail, uuid, requireValue } from "../http.js";
import {
  singleton,
  ownedRecord,
  parseJson,
  replaceChildren,
  overlap,
} from "./common.js";
import { validateRecurrence } from "./tasks.js";
import { enums } from "../db.js";

export function registerTeam(ctx, route) {
  const { repo, auth, db, files } = ctx;
  for (const [key, name] of [
    ["team-availability", "TeamAvailabilityEntity"],
    ["team-absence", "TeamAbsenceEntity"],
  ]) {
    route("POST", `/api/${key}/create/:userId`, async (req, res) => {
      await auth.userAccess(req, req.params.userId, {
        staff: true,
        write: true,
      });
      validateRecurrence(req.body);
      if (!req.body.startDate || !req.body.startTime || !req.body.endTime)
        fail(400, "Start date and start/end times are required");
      const body = req.body;
      if (
        !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(body.startTime) ||
        !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(body.endTime)
      )
        fail(400, "Enter valid start and end times");
      if (
        (key === "team-availability" ||
          !body.endDate ||
          body.endDate === body.startDate) &&
        body.endTime <= body.startTime
      )
        fail(400, "End time must be after start time");
      if (key === "team-absence") {
        for(const date of [body.startDate,body.endDate||body.startDate]) {
          if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)fail(400,'Enter valid absence dates');
        }
        if((body.endDate||body.startDate)<body.startDate)fail(400,'End date must be on or after the start date');
        if(body.type===undefined)body.type='OTHERS';
        if(!enums.TeamAbsenceType.includes(body.type))fail(400,'Choose a time-off type');
        if(body.reason!=null&&(typeof body.reason!=='string'||body.reason.length>4000))fail(400,'Reason must be no more than 4,000 characters');
        await db.query(
          "SELECT id FROM users WHERE agency_id=$1 ORDER BY id FOR UPDATE",
          [req.user.agencyId],
        );
        const booked = await db.query(
          `SELECT id FROM node_roster_visits WHERE staff_id=$1 AND status IN ('DRAFT','SCHEDULED','IN_PROGRESS')
          AND visit_date + start_time < $3::timestamp AND visit_date + end_time > $2::timestamp LIMIT 1`,
          [
            req.params.userId,
            body.startDate + "T" + body.startTime,
            (body.endDate || body.startDate) + "T" + body.endTime,
          ],
        );
        if (booked.rows.length)
          fail(
            409,
            "Reassign or cancel conflicting roster visits before booking this absence",
          );
        const existing=await repo.find('TeamAbsenceEntity',{user:req.params.userId});
        const start=body.startDate+'T'+body.startTime.padEnd(8,':00'),end=(body.endDate||body.startDate)+'T'+body.endTime.padEnd(8,':00');
        if(existing.some(a=>!a.deletedAt&&a.startDate+'T'+a.startTime<end&&(a.endDate||a.startDate)+'T'+a.endTime>start))fail(409,'Time off already exists during these dates and times');
      }
      const row = await repo.save(name, {
        ...repo.input(name, req.body),
        user: req.params.userId,
        createdBy: req.user.id,
        updatedBy: req.user.id,
      });
      return reply(res, await repo.serialize(name, row));
    });
    route("POST", `/api/${key}/getAll/:userId`, async (req, res) => {
      await auth.userAccess(req, req.params.userId, { staff: true });
      return reply(
        res,
        await Promise.all(
          (await repo.find(name, { user: req.params.userId }))
            .filter(
              (r) => !r.deletedAt && overlap(r.startDate, r.endDate, req.body),
            )
            .map((r) => repo.serialize(name, r)),
        ),
      );
    });
    route("DELETE", `/api/${key}/delete/:id`, async (req, res) => {
      const row = await ownedRecord(ctx, req, name, req.params.id, {
        write: true,
      });
      if (key === "team-availability" && req.body.deletedDate != null) {
        if (!Array.isArray(req.body.deletedDate))
          fail(400, "deletedDate must be an array");
        await repo.save(name, {
          id: row.id,
          deletedDate: req.body.deletedDate,
          updatedBy: req.user.id,
        });
      } else if(key==='team-absence') {
        if(row.deletedAt)fail(409,'This time off is already cancelled');
        await repo.save(name,{id:row.id,deletedAt:new Date().toISOString(),deletedBy:req.user.id});
      } else await repo.remove(name, row.id);
      return reply(res, {}, "Deleted successfully");
    });
  }
  route("GET", "/api/team-operations/get/:userId", async (req, res) => {
    await auth.userAccess(req, req.params.userId, {staff:true});
    const row = await singleton(
      ctx,
      req,
      "TeamOperationsEntity",
      req.params.userId,
    );
    return reply(
      res,
      row ? await repo.serialize("TeamOperationsEntity", row) : {},
    );
  });
  route("PUT", "/api/team-operations/update/:userId", async (req, res) => {
    await auth.userAccess(req, req.params.userId, {staff:true,write:true});
    const values={};
    for(const key of ['address','rateCard','travelRateCard','transportMethod']) {
      if(req.body[key]===undefined)continue;
      const value=req.body[key];
      if(value!==null && (typeof value!=='string'||value.length>(key==='address'?1000:100)))fail(400,'Enter valid operation details');
      values[key]=value?.trim()||null;
    }
    if(values.transportMethod && !['CAR','BICYCLE','WALKING'].includes(values.transportMethod))fail(400,'Choose Car, Bicycle or Walking');
    if(!Object.keys(values).length)fail(400,'No operation changes provided');
    await db.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[req.params.userId]);
    return reply(
      res,
      await repo.serialize(
        "TeamOperationsEntity",
        await singleton(
          ctx,
          req,
          "TeamOperationsEntity",
          req.params.userId,
          values,
        ),
      ),
    );
  });
  route("GET", "/api/team/skills/get/:userId", async (req, res) => {
    await auth.userAccess(req, req.params.userId, { staff: true });
    return reply(
      res,
      await Promise.all(
        (await repo.find("TeamSkillsEntity", { user: req.params.userId })).map(
          (r) => repo.serialize("TeamSkillsEntity", r),
        ),
      ),
    );
  });
  route(
    "POST",
    "/api/team/skills/update/:userId",
    async (req, res) => {
      await auth.userAccess(req, req.params.userId, {
        staff: true,
        write: true,
      });
      const id = req.body.skillId || undefined,
        old = id
          ? await ownedRecord(ctx, req, "TeamSkillsEntity", id, { write: true })
          : null;
      if (old && old.user !== req.params.userId) fail(404, "Skill not found");
      const data = {
        ...repo.input("TeamSkillsEntity", req.body),
        id: old?.id,
        user: req.params.userId,
      };
      if (!String(req.body.name || old?.name || "").trim())
        fail(400, "Skill name is required");
      const file = req.files?.find((f) => f.fieldname === "skillsFile");
      if (file) data.skillsFilePath = (await files.save(file)).url;
      if (
        parseJson(req.body.filesToRemove, []).some((s) =>
          ["skillsFile", "skills_file", "skillsFilePath"].includes(s),
        )
      )
        data.skillsFilePath = null;
      return reply(
        res,
        await repo.serialize(
          "TeamSkillsEntity",
          await repo.save("TeamSkillsEntity", data),
        ),
      );
    },
    { multipart: true },
  );
  route("DELETE", "/api/team/skills/delete/:id", async (req, res) => {
    const row = await ownedRecord(ctx, req, "TeamSkillsEntity", req.params.id, {
      write: true,
    });
    await repo.remove("TeamSkillsEntity", row.id);
    return reply(res, {}, "Skill deleted");
  });
  route("GET", "/api/team-onboarding/:userId", async (req, res) => {
    const row = await singleton(
      ctx,
      req,
      "TeamOnboardingEntity",
      req.params.userId,
    );
    return reply(
      res,
      row
        ? await repo.serialize("TeamOnboardingEntity", row, { children: true })
        : {},
    );
  });
  route("GET", "/api/team/:userId/readiness", async (req, res) => {
    await auth.userAccess(req, req.params.userId, { staff: true });
    const [onboarding] = await repo.find("TeamOnboardingEntity", { user: req.params.userId });
    const required = [
      ["started", "Employment start date"],
      ["contractFilePath", "Employment contract"],
      ["idFilePath", "Identity document"],
      ["referencesFilePath", "References"],
      ["dbsRecordFilePath", "DBS record"],
    ];
    const missing = !onboarding ? required.map(([, label]) => label) : required.filter(([field]) => !onboarding[field]).map(([, label]) => label);
    const credentials = (await db.query(
      `SELECT kind,expires_at::text AS "expiresAt",status FROM node_staff_credentials
       WHERE agency_id=$1 AND staff_id=$2 ORDER BY expires_at NULLS LAST,kind`,
      [req.user.agencyId, req.params.userId],
    )).rows;
    const today = new Date().toISOString().slice(0, 10);
    const inThirtyDays = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const expired = credentials.filter((item) => item.status !== "VALID" || (item.expiresAt && item.expiresAt < today));
    const expiring = credentials.filter((item) => item.status === "VALID" && item.expiresAt && item.expiresAt >= today && item.expiresAt <= inThirtyDays);
    const requirements = (await db.query(`SELECT kind,mandatory,blocks_roster AS "blocksRoster" FROM node_training_requirements WHERE agency_id=$1`,[req.user.agencyId])).rows;
    const normalise = (value) => String(value || "").trim().toLowerCase();
    const training = requirements.filter((item) => item.mandatory).map((item) => {
      const record = credentials.find((credential) => normalise(credential.kind) === normalise(item.kind));
      const valid = record && record.status === "VALID" && (!record.expiresAt || record.expiresAt >= today);
      return { ...item, status: valid ? (record.expiresAt && record.expiresAt <= inThirtyDays ? "EXPIRING" : "APPROVED") : record?.status === "PENDING_REVIEW" ? "PENDING_REVIEW" : record?.expiresAt && record.expiresAt < today ? "EXPIRED" : "MISSING", expiresAt: record?.expiresAt || null };
    });
    const trainingBlocking = training.filter((item) => item.blocksRoster && !["APPROVED","EXPIRING"].includes(item.status));
    const status = missing.length || expired.length || trainingBlocking.length ? "NOT_READY" : expiring.length || training.some((item) => item.status !== "APPROVED") ? "ATTENTION" : "READY";
    return reply(res, {
      status,
      canRoster: !missing.length && !expired.length && !trainingBlocking.length,
      missing,
      expired,
      expiring,
      training,
      trainingBlocking,
      checkedAt: new Date().toISOString(),
    });
  });
  route(
    "POST",
    "/api/team-onboarding/update/:userId",
    async (req, res) =>
      db.transaction(async () => {
        await auth.userAccess(req, req.params.userId, {
          staff: true,
          write: true,
        });
        const body = { ...req.body },
          trustedFiles = {};
        for (const k of Object.keys(body))
          if (body[k] === "null") body[k] = null;
        if (
          body.weeklyContractedHours != null &&
          (Number(body.weeklyContractedHours) < 0 ||
            Number(body.weeklyContractedHours) > 168)
        )
          fail(400, "Weekly contracted hours must be between 0 and 168");
        const mappings = {
          contractFile: "contractFilePath",
          idFile: "idFilePath",
          drivingLicenceFile: "drivingLicenceFilePath",
          bankStatementFile: "bankStatementFilePath",
          utilityBillFile: "utilityBillFilePath",
          referencesFile: "referencesFilePath",
          dbsRecordFile: "dbsRecordFilePath",
        };
        for (const file of req.files || [])
          if (mappings[file.fieldname])
            trustedFiles[mappings[file.fieldname]] = (
              await files.save(file)
            ).url;
        const removals = {
          contract: "contractFilePath",
          id_file: "idFilePath",
          driving_licence: "drivingLicenceFilePath",
          bank_statement: "bankStatementFilePath",
          utility_bill: "utilityBillFilePath",
          references_file: "referencesFilePath",
          dbs_record: "dbsRecordFilePath",
        };
        for (const field of parseJson(body.filesToRemove, []))
          if (removals[field]) trustedFiles[removals[field]] = null;
        const row = await singleton(
          ctx,
          req,
          "TeamOnboardingEntity",
          req.params.userId,
          body,
          trustedFiles,
        );
        if (
          body.additionalDocumentId !== undefined ||
          body.additionalDocumentDescription !== undefined
        ) {
          const arr = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
          const ids = arr(body.additionalDocumentId),
            descriptions = arr(body.additionalDocumentDescription),
            categories = arr(body.additionalDocumentCategory),
            expires = arr(body.additionalDocumentExpires),
            ends = arr(body.additionalDocumentExpiresOn);
          const uploads = (req.files || []).filter(
            (f) => f.fieldname === "additionalDocumentFiles",
          );
          const docs = [];
          for (let i = 0; i < Math.max(ids.length, descriptions.length); i++) {
            const old =
              ids[i] && ids[i] !== "null"
                ? requireValue(
                    await repo.get(
                      "TeamOnboardingAdditionalDocumentEntity",
                      uuid(ids[i]),
                    ),
                    "Additional document not found",
                  )
                : null;
            if (old && old.onboarding !== row.id)
              fail(404, "Additional document not found");
            docs.push({
              id: old?.id,
              additionalDocumentDescription: descriptions[i],
              additionalDocumentCategory: categories[i],
              additionalDocumentExpires: expires[i],
              additionalDocumentExpiresOn: ends[i] === "null" ? null : ends[i],
              additionaDocumentFilePath: uploads[i]
                ? (await files.save(uploads[i])).url
                : old?.additionaDocumentFilePath,
            });
          }
          const oldDocs = await repo.find(
              "TeamOnboardingAdditionalDocumentEntity",
              { onboarding: row.id },
            ),
            keep = new Set();
          for (const doc of docs) {
            const saved = await repo.save(
              "TeamOnboardingAdditionalDocumentEntity",
              {
                ...repo.input("TeamOnboardingAdditionalDocumentEntity", doc),
                id: doc.id,
                user: req.params.userId,
                onboarding: row.id,
                additionaDocumentFilePath: doc.additionaDocumentFilePath,
              },
            );
            keep.add(saved.id);
          }
          for (const old of oldDocs)
            if (!keep.has(old.id))
              await repo.remove(
                "TeamOnboardingAdditionalDocumentEntity",
                old.id,
              );
        }
        return reply(
          res,
          await repo.serialize("TeamOnboardingEntity", row, { children: true }),
        );
      }),
    { multipart: true },
  );
}
