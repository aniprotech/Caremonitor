import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { openDatabase, initializeSchema } from "../src/db.js";
import { createApp } from "../src/app.js";

test("Client profile and live feed", async (t) => {
  const db = await openDatabase({ driver: "pglite", dataDir: ":memory:" });
  await initializeSchema(db);
  const sent = [];
  const app = createApp({
    db,
    config: {
      production: false,
      jwtSecret: "client-feed-test-secret-32-characters-long",
      frontendUrl: "http://localhost:5173",
      corsOrigins: [],
      uploadDir: "./test-uploads",
    },
    mail: { send: async (m) => sent.push(m) },
  });
  const { repo, auth } = app.locals.ctx,
    agency = randomUUID();
  const person = (name, role = "USER", agencyId = agency) =>
    repo.save("UserEntity", {
      firstName: name,
      lastName: "Test",
      email: name + "@feed.test",
      isActive: true,
      role,
      agencyId,
    });
  const admin = await person("admin", "ADMIN"),
    carer = await person("carer", "CAREGIVER"),
    outsider = await person("outsider", "ADMIN", randomUUID()),
    client = await person("client"),
    otherClient = await person("second");
  const login = async (user) => {
    await auth.requestLink(user.email);
    const link = sent.at(-1).text.match(/http[^\s]+/)[0];
    const [email, password] = Buffer.from(
      new URL(link).searchParams.get("token"),
      "base64url",
    )
      .toString()
      .split(":");
    return (await auth.exchange(email, password)).accessToken;
  };
  const at = await login(admin),
    ct = await login(carer),
    ot = await login(outsider);
  const call = (method, path, body, token = at) =>
    request(app)
      [method](path)
      .set("Authorization", "Bearer " + token)
      .send(body);
  const data = (r) => r.body.results.data,
    base = `/api/clients/${client.id}`;
  let v, note;
  try {
    await t.test(
      "Middle name, leading zero phone, multiline highlights and address survive multipart edit",
      async () => {
        const r = await request(app)
          .post("/api/client/create")
          .set("Authorization", "Bearer " + at)
          .field("id", client.id)
          .field("firstName", "Dummy")
          .field("lastName", "Test")
          .field("middleName", "Example")
          .field("email", client.email)
          .field("dateOfBirth", "1950-01-01")
          .field("primaryPhone", "07700900123")
          .field("primaryPhoneType", "MOBILE")
          .field("highlights", "Life story\n\nImportant people")
          .field(
            "addresses",
            JSON.stringify([
              {
                addressLine1: "Test address",
                latitude: 51.5,
                longitude: -0.1,
                checkinRadius: 200,
                secureCheckin: "true",
                isPrimary: true,
              },
            ]),
          );
        assert.equal(r.status, 200, r.body.message);
        assert.equal(data(r).middleName, "Example");
        assert.equal(data(r).primaryPhone, "07700900123");
        assert.equal(data(r).highlights, "Life story\n\nImportant people");
        assert.equal(data(r).addresses[0].checkinRadius, 200);
        const again = await request(app)
          .post("/api/client/create")
          .set("Authorization", "Bearer " + at)
          .field("id", client.id)
          .field("middleName", "Changed");
        assert.equal(again.status, 200);
        assert.equal(data(again).addresses.length, 1);
        assert.equal(data(again).highlights, "Life story\n\nImportant people");
      },
    );
    await t.test(
      "Identifiers update without replacing unrelated clinical fields",
      async () => {
        await call("post", `/api/client-information/update/${client.id}`, {
          allergiesIntolerances: "Test only",
          fundingOption: ["PRIVATE"],
          carerPreferences: "NO_PREFERENCE",
        });
        const r = await call(
          "post",
          `/api/client-information/update/${client.id}`,
          {
            uniqueClientIdentifier: "TEST-001",
            nhsNumber: "9991234500",
            localAuthorityId: "TEST-LA",
          },
        );
        assert.equal(r.status, 200);
        assert.equal(data(r).allergiesIntolerances, "Test only");
        assert.deepEqual(data(r).fundingOption, ["PRIVATE"]);
        const identity = await call("post", `/api/client-information/update/${client.id}`, {
          sex: "FEMALE", gender: "NON_BINARY", sexualOrientation: "Bisexual", religion: "Test belief",
        });
        assert.equal(identity.status, 200, identity.body.message);
        assert.equal(data(identity).gender, "NON_BINARY");
        assert.equal(data(identity).sexualOrientation, "Bisexual");
        const invalid = await call("post", `/api/client-information/update/${client.id}`, { nhsNumber: "9991234501" });
        assert.equal(invalid.status, 400);
      },
    );
    await t.test("Admin-added clinical options are reusable across organisations without sharing client data", async () => {
      const added = await call("post", "/api/clinical-catalog", { kind: "history", name: "Spinal injury rehabilitation" });
      assert.equal(added.status, 201, added.body.message);
      const sameAgency = await call("get", "/api/clinical-catalog?kind=history&q=spinal");
      assert.ok(data(sameAgency).terms.some(term => term.name === "Spinal injury rehabilitation"));
      const otherAgency = await call("get", "/api/clinical-catalog?kind=history&q=spinal", undefined, ot);
      assert.ok(data(otherAgency).terms.some(term => term.name === "Spinal injury rehabilitation"));
      const privateClient = await call("get", `/api/client/get-client/${client.id}`, undefined, ot);
      assert.equal(privateClient.status, 404);
      const addedReligion = await call("post", "/api/onboarding-options", { kind: "religion", name: "Test belief" });
      assert.equal(addedReligion.status, 201);
      const sharedReligion = await call("get", "/api/onboarding-options?kind=religion", undefined, ot);
      assert.ok(data(sharedReligion).options.includes("Test belief"));
      const addedProfessionalRole = await call("post", "/api/onboarding-options", { kind: "professional_role", name: "Care coordinator" });
      assert.equal(addedProfessionalRole.status, 201, addedProfessionalRole.body.message);
      const sharedProfessionalRole = await call("get", "/api/onboarding-options?kind=professional_role", undefined, ot);
      assert.ok(data(sharedProfessionalRole).options.includes("Care coordinator"));
      const addedRelationship = await call("post", "/api/onboarding-options", { kind: "relationship", name: "Family friend" });
      assert.equal(addedRelationship.status, 201, addedRelationship.body.message);
      const carerAdd = await call("post", "/api/onboarding-options", { kind: "religion", name: "Private note" }, ct);
      assert.equal(carerAdd.status, 403);
      const invalid = await call("post", "/api/clinical-catalog", { kind: "history", name: "<script>" });
      assert.equal(invalid.status, 400);
    });
    await t.test(
      "Roster visits populate the feed and each visit detail collection",
      async () => {
        const r = await call("post", "/api/roster/visits", {
          clientId: client.id,
          staffId: carer.id,
          date: "2026-01-01",
          startTime: "07:00",
          endTime: "08:00",
          title: "Test morning visit",
          status: "SCHEDULED",
        });
        assert.equal(r.status, 201, r.body.message);
        v = data(r).visits[0];
        const list = await call("get", base + "/feed");
        assert.equal(list.status, 200, list.body.message);
        assert.equal(data(list).counts.VISIT, 1);
      assert.equal(typeof data(list).items[0].occurred_at, "string");
      assert.equal(app.locals.ctx.files.signTree(new Date("2026-09-08T07:00:00Z"), {}), "2026-09-08T07:00:00.000Z");
        const detail = await call("get", base + `/visits/${v.id}`);
        assert.equal(detail.status, 200);
        assert.equal(
          data(detail).events[0].description,
          "Visit schedule created",
        );
        assert.equal(data(detail).addresses.length, 1);
      },
    );
    await t.test(
      "All entry types persist, with note versions and stale edit protection",
      async () => {
        for (const [kind, status] of [
          ["NOTE", "RECORDED"],
          ["ALERT", "OPEN"],
          ["ACTION", "OPEN"],
          ["ACTIVITY", "COMPLETED"],
          ["OBSERVATION", "RECORDED"],
        ]) {
          const r = await call("post", base + "/entries", {
            kind,
            status,
            title: "Test " + kind,
            body: "Test content only",
            visitId: v.id,
          });
          assert.equal(r.status, 201, r.body.message);
          if (kind === "NOTE") note = data(r);
        }
        const body = {
          kind: "NOTE",
          status: "RECORDED",
          title: "Updated note",
          body: "Corrected content",
          visitId: v.id,
          revision: 1,
        };
        assert.equal(
          (await call("put", base + `/entries/${note.id}`, body)).status,
          200,
        );
        assert.equal(
          (await call("put", base + `/entries/${note.id}`, body)).status,
          409,
        );
        const h = data(await call("get", base + `/entries/${note.id}`));
        assert.equal(h.history.length, 2);
        assert.equal(h.history[1].snapshot.body, "Test content only");
        assert.equal(h.history[0].snapshot.body, "Corrected content");
        const d = data(await call("get", base + `/visits/${v.id}`));
        assert.equal(d.entries.length, 5);
        assert.equal(d.events.length, 7);
        const list = data(await call("get", base + "/feed?kind=VISIT"));
        assert.equal(list.items[0].alerts, 1);
        assert.equal(list.items[0].activities, 1);
        assert.equal(list.items[0].observations, 1);
      },
    );
    await t.test(
      "Feed, visits and history enforce agency, client and carer permissions",
      async () => {
        assert.equal(
          (await call("get", base + "/feed", undefined, ot)).status,
          404,
        );
        assert.equal(
          (await call("get", base + "/feed", undefined, ct)).status,
          403,
        );
        await repo.save("ClientCareTeamEntity", {
          client: client.id,
          carer: carer.id,
          viewAccess: true,
          allowedToVisit: true,
        });
        assert.equal(
          (await call("get", base + "/feed", undefined, ct)).status,
          200,
        );
        assert.equal(
          (
            await call(
              "get",
              `/api/clients/${otherClient.id}/entries/${note.id}`,
            )
          ).status,
          404,
        );
        assert.equal(
          (
            await call("post", `/api/clients/${otherClient.id}/entries`, {
              kind: "NOTE",
              status: "RECORDED",
              title: "Wrong client",
              visitId: v.id,
            })
          ).status,
          404,
        );
        assert.equal(
          (
            await call(
              "put",
              base + `/entries/${note.id}`,
              {
                kind: "NOTE",
                status: "RECORDED",
                title: "Unauthorised edit",
                visitId: v.id,
                revision: 2,
              },
              ct,
            )
          ).status,
          403,
        );
      },
    );
    await t.test(
      "Attendance and status transitions create actual times and timeline events",
      async () => {
        let r = await call("post", `/api/roster/visits/${v.id}/status`, {
          status: "IN_PROGRESS",
          revision: v.revision,
        });
        assert.equal(r.status, 200);
        v = data(r);
        r = await call("post", `/api/roster/visits/${v.id}/status`, {
          status: "COMPLETED",
          revision: v.revision,
        });
        assert.equal(r.status, 200);
        v = data(r);
        const corrected = {
          start: "2026-01-01T07:00:00Z",
          end: "2026-01-01T08:01:00Z",
          reason: "Test attendance correction",
          revision: v.revision,
        };
        assert.equal(
          (await call("put", base + `/visits/${v.id}/actuals`, corrected, ct))
            .status,
          403,
        );
        r = await call("put", base + `/visits/${v.id}/actuals`, corrected);
        assert.equal(r.status, 200, r.body.message);
        assert.equal(
          (await call("put", base + `/visits/${v.id}/actuals`, corrected))
            .status,
          409,
        );
        const d = data(await call("get", base + `/visits/${v.id}`));
        assert.ok(
          d.events.some((e) =>
            e.description.includes("Test attendance correction"),
          ),
        );
        const list = data(await call("get", base + "/feed?kind=VISIT"));
        assert.equal(list.items[0].actualMinutes, 61);
      },
    );
    await t.test(
      "Filters and validation reject mismatched status and empty titles",
      async () => {
        assert.equal(
          data(await call("get", base + "/feed?search=does-not-exist")).items
            .length,
          0,
        );
        assert.equal(
          (
            await call("post", base + "/entries", {
              kind: "NOTE",
              status: "OPEN",
              title: "Bad status",
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await call("post", base + "/entries", {
              kind: "ACTIVITY",
              status: "COMPLETED",
              title: "No visit",
            })
          ).status,
          400,
        );
        assert.equal((await call("get", base + "/feed?page=0")).status, 400);
      },
    );
    await t.test('Carer activity feed combines only assigned visits and staff records with filters and permissions', async()=>{
      const path=`/api/team/${carer.id}/activity-feed`;
      const noteResponse=await call('post',`/api/team/${carer.id}/feed`,{kind:'CONCERN',body:'Staff concern for feed verification'});
      assert.equal(noteResponse.status,201);
      const r=await call('get',path);assert.equal(r.status,200,r.body.message);
      assert.ok(data(r).items.some(x=>x.id===v.id&&x.clientId===client.id));
      assert.ok(data(r).items.some(x=>x.teamEntry&&x.kind==='ALERT'));
      assert.equal(data(await call('get',path+'?kind=VISIT')).counts.VISIT,1);
      assert.ok(data(await call('get',path+'?kind=VISIT')).items.every(x=>x.kind==='VISIT'));
      assert.equal(data(await call('get',path+'?search=absent-string')).items.length,0);
      assert.equal((await call('get',path+'?from=2026-02-30')).status,400);
      assert.equal((await call('get',path,undefined,ot)).status,404);
      assert.equal((await call('get',`/api/team/${admin.id}/activity-feed`,undefined,ct)).status,403);
      assert.equal((await call('get',path,undefined,ct)).status,200);
      const detail=await call('get',`/api/team/${carer.id}/activity-entry/${data(noteResponse).id}`);assert.equal(detail.status,200);
      assert.equal(data(detail).entry.body,'Staff concern for feed verification');
      assert.equal((await call('get',`/api/team/${admin.id}/activity-entry/${data(noteResponse).id}`)).status,404);
    });
  } finally {
    await db.close();
  }
});
