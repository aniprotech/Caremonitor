import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { openDatabase, initializeSchema } from "../src/db.js";
import { createApp } from "../src/app.js";

test("Reviewed roster planning", async (t) => {
  const db = await openDatabase({ driver: "pglite", dataDir: ":memory:" });
  await initializeSchema(db);
  const sent = [],
    config = {
      production: false,
      jwtSecret: "test-only-secret-at-least-32-characters",
      frontendUrl: "http://localhost:5173",
      corsOrigins: [],
      uploadDir: "./test-uploads",
    };
  const app = createApp({
      db,
      config,
      mail: { send: async (m) => sent.push(m) },
    }),
    { repo, auth } = app.locals.ctx,
    agency = randomUUID();
  const person = (role, n, agencyId = agency) =>
    repo.save("UserEntity", {
      firstName: n,
      lastName: "Fixture",
      email: n + "@planning.test",
      role,
      agencyId,
      isActive: true,
    });
  const admin = await person("ADMIN", "admin"),
    staff = await person("CAREGIVER", "staff"),
    client = await person("USER", "client"),
    client2 = await person("USER", "client2"),
    other = await person("ADMIN", "other", randomUUID());
  async function token(u) {
    await auth.requestLink(u.email);
    const link = sent.at(-1).text.match(/http[^\s]+/)[0];
    const [e, p] = Buffer.from(
      new URL(link).searchParams.get("token"),
      "base64url",
    )
      .toString()
      .split(":");
    return (await auth.exchange(e, p)).accessToken;
  }
  const adminToken = await token(admin),
    staffToken = await token(staff),
    otherToken = await token(other);
  const call = (method, path, body, access = adminToken) =>
    request(app)
      [method](path)
      .set("Authorization", "Bearer " + access)
      .send(body);
  const data = (r) => r.body.results.data;
  async function create(
    date,
    startTime = "09:00",
    endTime = "10:00",
    clientId = client.id,
    staffId = null,
  ) {
    const r = await call("post", "/api/roster/visits", {
      date,
      startTime,
      endTime,
      clientId,
      staffId,
      title: "Fixture visit",
      status: staffId ? "SCHEDULED" : "DRAFT",
    });
    assert.equal(r.status, 201, r.body.message);
    return data(r).visits[0];
  }
  const preview = (from, extra = {}) =>
    call("post", "/api/roster/planning/preview", {
      from,
      mode: "AUTO",
      buffer: 15,
      ...extra,
    });
  const apply = (id) =>
    call("post", "/api/roster/planning/apply", { previewId: id });
  let visit, template;
  try {
    await t.test(
      "Preview is read-only; eligible care team required; apply and replay protected",
      async () => {
        visit = await create("2026-11-02");
        let p = await preview("2026-11-02");
        assert.equal(p.status, 200, p.body.message);
        assert.equal(data(p).proposed.length, 0);
        await repo.save("ClientCareTeamEntity", {
          client: client.id,
          carer: staff.id,
          allowedToVisit: true,
        });
        p = await preview("2026-11-02");
        assert.equal(p.status, 200, p.body.message);
        assert.equal(data(p).proposed[0].staffId, staff.id);
        assert.equal(
          (
            await db.query(
              "SELECT staff_id FROM node_roster_visits WHERE id=$1",
              [visit.id],
            )
          ).rows[0].staff_id,
          null,
        );
        const result = await apply(data(p).id);
        assert.equal(result.status, 200, result.body.message);
        assert.equal(data(result).count, 1);
        assert.equal((await apply(data(p).id)).status, 409);
      },
    );
    await t.test(
      "Travel buffer and absences skip unsafe suggestions",
      async () => {
        await repo.save("ClientCareTeamEntity", {
          client: client2.id,
          carer: staff.id,
          allowedToVisit: true,
        });
        await create("2026-11-02", "10:05", "10:30", client2.id);
        let p = await preview("2026-11-02");
        assert.equal(data(p).proposed.length, 0);
        assert.equal(data(p).skipped.length, 1);
        await repo.save("TeamAbsenceEntity", {
          user: staff.id,
          startDate: "2026-11-03",
          endDate: "2026-11-03",
          startTime: "00:00",
          endTime: "23:59",
        });
        await create("2026-11-03");
        p = await preview("2026-11-02", { buffer: 0 });
        assert.equal(data(p).proposed.length, 1);
        assert.equal(data(p).skipped.length, 1);
      },
    );
    await t.test(
      "Changed visit makes whole application roll back",
      async () => {
        await create("2026-11-09");
        const second = await create("2026-11-10");
        const p = await preview("2026-11-09");
        assert.equal(data(p).proposed.length, 2);
        await db.query(
          "UPDATE node_roster_visits SET revision=revision+1 WHERE id=$1",
          [second.id],
        );
        assert.equal((await apply(data(p).id)).status, 409);
        assert.equal(
          (
            await db.query(
              "SELECT count(*)::int n FROM node_roster_visits WHERE visit_date BETWEEN '2026-11-09' AND '2026-11-15' AND staff_id IS NOT NULL",
            )
          ).rows[0].n,
          0,
        );
      },
    );
    await t.test(
      "Templates create reviewed drafts and skip duplicates; runs retain visits",
      async () => {
        let r = await call("post", "/api/roster/assets", {
          kind: "TEMPLATE",
          name: "Weekly fixture",
          from: "2026-11-02",
        });
        assert.equal(r.status, 201, r.body.message);
        template = data(r).id;
        let p = await preview("2026-11-16", {
          mode: "TEMPLATE",
          assetId: template,
        });
        assert.equal(p.status, 200, p.body.message);
        assert.equal(data(p).proposed.length, 3);
        r = await apply(data(p).id);
        assert.equal(r.status, 200, r.body.message);
        assert.equal(data(r).count, 3);
        p = await preview("2026-11-16", {
          mode: "TEMPLATE",
          assetId: template,
        });
        assert.equal(data(p).proposed.length, 0);
        assert.equal(data(p).skipped.length, 3);
        r = await call("post", "/api/roster/assets", {
          kind: "RUN",
          name: "Fixture run",
          from: "2026-11-02",
          visitIds: [visit.id],
        });
        assert.equal(r.status, 201, r.body.message);
        assert.equal(
          (await call("delete", "/api/roster/assets/" + data(r).id)).status,
          200,
        );
        assert.equal(
          (
            await db.query(
              "SELECT count(*)::int n FROM node_roster_visits WHERE id=$1",
              [visit.id],
            )
          ).rows[0].n,
          1,
        );
      },
    );
    await t.test("Working hours board and tenant/role boundaries", async () => {
      await repo.save("TeamAvailabilityEntity", {
        user: staff.id,
        startDate: "2026-11-02",
        frequency: "DAILY",
        startTime: "08:00",
        endTime: "18:00",
        isEnds: false,
      });
      const r = await call("get", "/api/roster/board?from=2026-11-02");
      assert.equal(r.status, 200, r.body.message);
      const person = data(r).staff.find((x) => x.id === staff.id);
      assert.equal(person.days[0].available[0].start, "08:00");
      assert.equal(person.days[1].absent.length, 1);
      assert.equal("reason" in person.days[1].absent[0], false);
      assert.equal(
        (
          await call(
            "post",
            "/api/roster/planning/preview",
            { mode: "AUTO", from: "2026-11-02" },
            staffToken,
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await call(
            "post",
            "/api/roster/planning/preview",
            { mode: "TEMPLATE", from: "2026-11-02", assetId: template },
            otherToken,
          )
        ).status,
        404,
      );
      const b = await call(
        "get",
        "/api/roster/board?from=2026-11-02",
        undefined,
        staffToken,
      );
      assert.equal(data(b).staff.length, 1);
      assert.equal(data(b).assets.length, 0);
    });
    await t.test(
      "Applying rechecks care-team eligibility and new travel conflicts",
      async () => {
        const target = await create("2026-12-07", "12:00", "13:00");
        let p = await preview("2026-12-07");
        assert.equal(data(p).proposed.length, 1);
        const link = await repo.one("ClientCareTeamEntity", {
          client: client.id,
          carer: staff.id,
        });
        await repo.save("ClientCareTeamEntity", {
          ...link,
          allowedToVisit: false,
        });
        assert.equal((await apply(data(p).id)).status, 409);
        await repo.save("ClientCareTeamEntity", {
          ...link,
          allowedToVisit: true,
        });
        p = await preview("2026-12-07");
        await create("2026-12-07", "13:05", "14:00", client2.id, staff.id);
        assert.equal((await apply(data(p).id)).status, 409);
        assert.equal(
          (
            await db.query(
              "SELECT staff_id FROM node_roster_visits WHERE id=$1",
              [target.id],
            )
          ).rows[0].staff_id,
          null,
        );
        assert.equal(
          (await preview("2026-12-07")).body.results.data.proposed.length,
          0,
        );
      },
    );
    await t.test("Bulk allocation assigns the selected visits together", async () => {
      const first = await create("2026-12-10", "09:00", "10:00");
      const second = await create("2026-12-10", "11:00", "12:00", client2.id);
      const result = await call("post", "/api/roster/bulk-assign", {
        visitIds: [first.id, second.id],
        staffId: staff.id,
      });
      assert.equal(result.status, 200, result.body.message);
      assert.equal(data(result).count, 2);
      const assigned = await db.query(
        "SELECT staff_id,status FROM node_roster_visits WHERE id=ANY($1::uuid[]) ORDER BY start_time",
        [[first.id, second.id]],
      );
      assert.deepEqual(
        assigned.rows.map((row) => [row.staff_id, row.status]),
        [[staff.id, "SCHEDULED"], [staff.id, "SCHEDULED"]],
      );
    });
  } finally {
    await db.close();
  }
});
