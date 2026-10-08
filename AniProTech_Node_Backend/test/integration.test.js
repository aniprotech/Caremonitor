import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { openDatabase, initializeSchema, entities } from "../src/db.js";
import { createApp } from "../src/app.js";
import { carePlans } from "../src/services/care-plans.js";

test("Express migration integration tests against PostgreSQL", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "aniprotech-test-"));
  const config = {
    driver: "pglite",
    dataDir: ":memory:",
    production: false,
    jwtSecret: "integration-only-secret-at-least-32-characters",
    frontendUrl: "http://localhost:5173",
    corsOrigins: ["http://localhost:5173"],
    uploadDir: path.join(directory, "uploads"),
    outboxDir: path.join(directory, "outbox"),
  };
  const db = await openDatabase(config);
  await initializeSchema(db);
  const sent = [],
    app = createApp({ db, config, mail: { send: async (m) => sent.push(m) } }),
    { repo, auth } = app.locals.ctx;
  const agency = randomUUID(),
    otherAgency = randomUUID();
  const admin = await repo.save("UserEntity", {
    agencyId: agency,
    firstName: "Test",
    lastName: "Admin",
    email: "admin@example.test",
    role: "ADMIN",
    isActive: true,
  });
  const carer = await repo.save("UserEntity", {
    agencyId: agency,
    firstName: "Test",
    lastName: "Carer",
    email: "carer@example.test",
    role: "CAREGIVER",
    isActive: true,
  });
  const other = await repo.save("UserEntity", {
    agencyId: otherAgency,
    firstName: "Other",
    lastName: "Client",
    email: "other@example.test",
    role: "USER",
    isActive: true,
  });
  let token, clientId, carerToken;
  const call = (method, url, body, access = token) => {
    let r = request(app)[method](url);
    if (access) r = r.set("Authorization", "Bearer " + access);
    if (body !== undefined) r = r.send(body);
    return r;
  };
  const data = (r) => r.body.results.data;
  async function login(email) {
    await auth.requestLink(email);
    const url = sent.at(-1).text.match(/http[^\s]+/)[0];
    const [e, password] = Buffer.from(
      new URL(url).searchParams.get("token"),
      "base64url",
    )
      .toString()
      .split(":");
    return { email: e, password };
  }
  try {
    await t.test(
      "health and CORS preflight work without authentication",
      async () => {
        assert.equal((await request(app).get("/api/health")).status, 200);
        assert.deepEqual((await request(app).get("/api/ready")).body.checks, { database: "UP", email: "UP", storage: "filesystem" });
        assert.equal(
          (
            await request(app)
              .options("/api/client/create")
              .set("Origin", "http://localhost:5173")
              .set("Access-Control-Request-Method", "POST")
          ).status,
          204,
        );
        assert.equal(
          (await request(app).get("/api/client/get-all-clients")).status,
          401,
        );
      },
    );
    await t.test(
      "one-time email login, token validation, and replay rejection",
      async () => {
        const credentials = await login(admin.email);
        const response = await call(
          "post",
          "/api/auth/get-token",
          credentials,
          null,
        );
        assert.equal(response.status, 200, JSON.stringify(response.body));
        token = data(response).accessToken;
        assert.equal(
          (await call("post", "/api/auth/get-token", credentials, null)).status,
          401,
        );
        assert.equal(
          (await call("post", "/api/auth/validate-token", {})).status,
          200,
        );
        const before = sent.length;
        assert.equal(
          (
            await call(
              "post",
              "/api/auth/request-link",
              { email: "nobody@example.test" },
              null,
            )
          ).status,
          200,
        );
        assert.equal(sent.length, before);
      },
    );
    await t.test(
      "client creation, nested addresses, pagination and tenant boundaries",
      async () => {
        const response = await call("post", "/api/client/create", {
          firstName: "Demo",
          lastName: "Client",
          email: "client@example.test",
          role: "SUPERADMIN",
          addresses: [
            { addressLine1: "Test house", city: "Test City", isPrimary: true },
          ],
        });
        assert.equal(response.status, 200, JSON.stringify(response.body));
        clientId = data(response).id;
        assert.equal(data(response).role, "USER");
        assert.equal(data(response).addresses[0].city, "Test City");
        assert.equal(
          data(await call("post", "/api/client/get-all-clients", {}))
            .totalCount,
          1,
        );
        assert.equal(
          (await call("get", "/api/client/get-client/" + other.id)).status,
          404,
        );
        assert.equal(
          (await call("post", "/api/client/get-all-clients", { size: 100000 }))
            .status,
          400,
        );
        assert.equal(
          (
            await call("post", "/api/team/create-user", {
              firstName: "Escalation",
              lastName: "Test",
              email: "escalation@example.test",
              role: "SUPERADMIN",
            })
          ).status,
          403,
        );
      },
    );
    await t.test("new caregivers receive a working one-time invitation", async () => {
      const before = sent.length;
      const created = await call("post", "/api/team/create-user", {
        firstName: "New", lastName: "Caregiver", email: "new-caregiver@example.test", role: "CAREGIVER",
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      assert.equal(sent.length, before + 1);
      const invitation = sent.at(-1);
      assert.equal(invitation.to, "new-caregiver@example.test");
      assert.match(invitation.actionUrl, /\/mobile-sign-in\.html#token=/);
      const webUrl = invitation.text.match(/On a computer, open (http[^\s]+)/)?.[1];
      assert.ok(webUrl);
      const [email, password] = Buffer.from(new URL(webUrl).searchParams.get("token"), "base64url").toString().split(":");
      const signedIn = await call("post", "/api/auth/get-token", { email, password }, null);
      assert.equal(signedIn.status, 200, JSON.stringify(signedIn.body));
      const caregiverAccess = data(signedIn).accessToken;
      assert.equal((await call("get", "/api/client/get-client/" + clientId, undefined, caregiverAccess)).status, 403);
      assert.equal((await call("post", "/api/auth/get-token", { email, password }, null)).status, 401);
      const repeat = await call("put", "/api/team/update-user/" + data(created).id, { primaryPhone: "+441234567890" });
      assert.equal(repeat.status, 200);
      assert.equal(sent.length, before + 1);
      const resent = await call("post", "/api/team/invite/" + data(created).id, {});
      assert.equal(resent.status, 200);
      assert.equal(sent.length, before + 2);
      assert.match(sent.at(-1).actionUrl, /\/mobile-sign-in\.html#token=/);
    });
    await t.test(
      "all 18 care domains round-trip assessments, review audit and risks",
      async () => {
        for (const [key, name] of Object.entries(carePlans)) {
          const prefix = "/api/client-care-plan/" + key;
          const plan = await call("get", prefix + "/" + clientId);
          assert.equal(plan.status, 200, key + JSON.stringify(plan.body));
          const assessment = entities[name].fields.find(
            (f) => f.name === "assessments",
          ).target;
          const fields = entities[assessment].fields.filter((f) => f.json);
          const answers = Object.fromEntries(
            fields.map((f) => [
              f.name,
              { answer: "Test answer", details: "Round-trip check" },
            ]),
          );
          const created = await call(
            "post",
            prefix + "/assessment/" + clientId,
            {
              ...answers,
              assessmentInprogress: false,
              reviewInprogress: false,
            },
          );
          assert.equal(created.status, 200, key + JSON.stringify(created.body));
          const id = data(created).id;
          const got = await call("get", prefix + "/assessment/" + id);
          assert.equal(got.status, 200);
          for (const f of fields)
            assert.deepEqual(
              data(got)[f.name],
              answers[f.name],
              key + "." + f.name,
            );
          assert.equal(data(got).submittedBy.id, admin.id);
          assert.equal(data(got).reviewedBy.id, admin.id);
          const risk = await call("post", prefix + "/risk/" + clientId, {
            risk: "Test hazard",
            mitigation: "Test action",
            riskLevel: "LOW",
          });
          assert.equal(risk.status, 200, key + JSON.stringify(risk.body));
          assert.equal(
            (await call("get", prefix + "/risk/" + data(risk).id)).status,
            200,
          );
          assert.equal(
            (await call("delete", prefix + "/risk/" + data(risk).id)).status,
            200,
          );
          assert.equal(
            (await call("delete", prefix + "/assessment/" + id)).status,
            200,
          );
        }
      },
    );
    await t.test(
      "assignment is bidirectional and carers cannot modify roles or unassigned records",
      async () => {
        carerToken = data(
          await call(
            "post",
            "/api/auth/get-token",
            await login(carer.email),
            null,
          ),
        ).accessToken;
        assert.equal(
          (
            await call(
              "get",
              "/api/client/get-client/" + clientId,
              undefined,
              carerToken,
            )
          ).status,
          403,
        );
        const assigned = await call(
          "put",
          "/api/client-care-team/update/" + clientId,
          { carerId: carer.id, viewAccess: true, allowedToVisit: true },
        );
        assert.equal(assigned.status, 200, JSON.stringify(assigned.body));
        assert.equal(sent.at(-1).to, carer.email);
        assert.match(sent.at(-1).subject, /client access/i);
        assert.match(sent.at(-1).actionUrl, /\/mobile-sign-in\.html#token=/);
        assert.doesNotMatch(sent.at(-1).text, /Demo Client/);
        assert.equal(
          (
            await call(
              "get",
              "/api/client/get-client/" + clientId,
              undefined,
              carerToken,
            )
          ).status,
          200,
        );
        assert.equal(data(await call("post", "/api/client/get-all-clients", {}, carerToken)).users.some((u) => u.id === clientId), true);
        assert.equal((await call("get", `/api/mobile/clients/${clientId}/care-overview`, undefined, carerToken)).status, 200);
        assert.equal((await call("get", `/api/client-care-plan/${Object.keys(carePlans)[0]}/${clientId}`, undefined, carerToken)).status, 200);
        assert.equal((await call("get", "/api/client/get-client/" + other.id, undefined, carerToken)).status, 404);
        const teamClients = await call(
          "post",
          "/api/team-clients/getByTeamMember/" + carer.id,
          {},
        );
        assert.equal(data(teamClients).data.clients[0].clientId, clientId);
        const notificationCount = sent.length;
        assert.equal((await call("put", "/api/client-care-team/update/" + clientId,
          { carerId: carer.id, viewAccess: true, allowedToVisit: true })).status, 200);
        assert.equal(sent.length, notificationCount);
        assert.equal(
          (
            await call(
              "put",
              "/api/team/update-user/" + carer.id,
              { role: "ADMIN" },
              carerToken,
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await call(
              "get",
              "/api/client/get-client/" + other.id,
              undefined,
              carerToken,
            )
          ).status,
          404,
        );
      },
    );
    await t.test(
      "clinical information children are saved and protected from cross-client IDs",
      async () => {
        const response = await call(
          "post",
          "/api/client-information/update/" + clientId,
          {
            ethnicity: "Test",
            medicalHistory: ["Test condition"],
            pharmacyOtherInformation: "Collect from the named pharmacy after 16:00.",
            healthWelfareLpa: "YES",
            healthWelfareLpaReference: "HW-LPA-1024",
            healthWelfareLpaDate: "2025-04-18",
            healthWelfareLpaExpiry: "",
            propertyFinancialLpa: "YES",
            propertyFinancialLpaReference: "PF-LPA-2048",
            propertyFinancialLpaDate: "2024-12-01",
            propertyFinancialLpaExpiry: "2029-12-01",
            clientEmergencyContacts: [
              {
                firstName: "Contact",
                lastName: "One",
                phoneNumber: 123,
                phoneCode: "44",
                typeOfContact: [],
              },
            ],
          },
        );
        assert.equal(response.status, 200, JSON.stringify(response.body));
        assert.deepEqual(data(response).medicalHistory, ["Test condition"]);
        assert.equal(data(response).pharmacyOtherInformation, "Collect from the named pharmacy after 16:00.");
        assert.equal(
          data(response).clientEmergencyContacts[0].firstName,
          "Contact",
        );
        assert.equal(data(response).healthWelfareLpaReference, "HW-LPA-1024");
        assert.equal(data(response).healthWelfareLpaDate, "2025-04-18");
        assert.equal(data(response).healthWelfareLpaExpiry, null);
        assert.equal(data(response).propertyFinancialLpaExpiry, "2029-12-01");
      },
    );
    await t.test(
      "task plan recurrence, category response and atomic validation",
      async () => {
        const category = await repo.save("ClientTaskCategoryEntity", {
            name: "Test category",
          }),
          task = await repo.save("ClientTaskEntity", {
            name: "Test task",
            clientTaskCategory: category.id,
          });
        const body = {
          taskId: task.id,
          userId: clientId,
          details: "Assist safely",
          isAnyTime: true,
          frequency: "DAILY",
          startDate: "2026-09-08",
        };
        const response = await call(
          "post",
          "/api/client-task-plan/create",
          body,
        );
        assert.equal(response.status, 201, JSON.stringify(response.body));
        assert.equal(
          data(
            await call(
              "post",
              "/api/client-task-plan/getByClient/" + clientId,
              {},
            ),
          ).taskPlans[0].taskName,
          "Test task",
        );
        assert.equal(
          (
            await call("post", "/api/client-task-plan/create", {
              ...body,
              frequency: "WEEKLY",
              selectedDays: [],
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await call(
              "delete",
              "/api/client-task-plan/delete/" + data(response).id,
            )
          ).status,
          200,
        );
      },
    );
    await t.test(
      "medication schedule, exact times, administration, scheduled stop and soft delete",
      async () => {
        const response = await call(
          "post",
          "/api/client-medication-scheduling/create/" + clientId,
          {
            medicationName: "Test only",
            type: "REGULAR",
            firstDoseDate: "2026-09-01",
            selectedTimeSlots: ["MORNING"],
            exactTimes: { dose1: "08:00" },
            medicalCondition: ["Test"],
            pastAdministrations: [],
          },
        );
        assert.equal(response.status, 200, JSON.stringify(response.body));
        const id = data(response).id;
        assert.deepEqual(data(response).exactTimes, { dose1: "08:00" });
        const updated = await call(
          "put",
          "/api/client-medication-scheduling/update/past-administration",
          {
            medicationId: id,
            date: "2026-09-08",
            slot: "MORNING",
            outcome: "FULLY_TAKEN",
            userId: other.id,
          },
          carerToken,
        );
        assert.equal(updated.status, 200, JSON.stringify(updated.body));
        const fetched = await call(
          "get",
          "/api/client-medication-scheduling/get-by-id/" + id,
        );
        assert.equal(
          data(fetched).pastAdministrations[0].updatedBy,
          "Test Carer",
        );
        assert.equal(
          (
            await call(
              "put",
              "/api/client-medication-scheduling/stop-scheduling/" + id,
              {
                stopType: "SCHEDULED",
                endDate: "2020-01-01",
                endTime: "08:00",
              },
            )
          ).status,
          200,
        );
        assert.equal(
          data(
            await call(
              "get",
              "/api/client-medication-scheduling/get-by-id/" + id,
            ),
          ).isStopped,
          true,
        );
        assert.equal(
          (
            await call(
              "delete",
              "/api/client-medication-scheduling/delete/" + id,
            )
          ).status,
          200,
        );
        assert.equal(
          data(
            await call(
              "get",
              "/api/client-medication-scheduling/get-all-by-client-id/" +
                clientId,
            ),
          ).medicationSchedules.length,
          0,
        );
      },
    );
    await t.test(
      "availability exclusions, absence overlap, operations and skills",
      async () => {
        const a = await call(
          "post",
          "/api/team-availability/create/" + carer.id,
          {
            frequency: "WEEKLY",
            selectedDays: ["MONDAY"],
            startDate: "2026-09-01",
            startTime: "08:00",
            endTime: "17:00",
            isEnds: false,
          },
        );
        assert.equal(a.status, 200, JSON.stringify(a.body));
        assert.equal(
          (
            await call(
              "delete",
              "/api/team-availability/delete/" + data(a).id,
              { deletedDate: ["2026-09-07"] },
            )
          ).status,
          200,
        );
        const avail = await call(
          "post",
          "/api/team-availability/getAll/" + carer.id,
          { startDate: "2026-09-01", endDate: "2026-09-30" },
        );
        assert.deepEqual(data(avail)[0].deletedDate, ["2026-09-07"]);
        assert.equal(
          (
            await call("put", "/api/team-operations/update/" + carer.id, {
              address: "Test address",
              transportMethod: "CAR",
            })
          ).status,
          200,
        );
        const operations='/api/team-operations/update/'+carer.id;
        assert.equal((await call('put',operations,{rateCard:'Standard care',travelRateCard:'Mileage'})).status,200);
        let saved=data(await call('get','/api/team-operations/get/'+carer.id));
        assert.equal(saved.address,'Test address');assert.equal(saved.transportMethod,'CAR');assert.equal(saved.rateCard,'Standard care');
        assert.equal((await call('put',operations,{address:'Updated address',transportMethod:'WALKING'})).status,200);
        saved=data(await call('get','/api/team-operations/get/'+carer.id));assert.equal(saved.rateCard,'Standard care');assert.equal(saved.travelRateCard,'Mileage');
        assert.equal((await call('put',operations,{transportMethod:'PLANE'})).status,400);
        assert.equal((await call('put',operations,{rateCard:'x'.repeat(101)})).status,400);
        assert.equal((await call('put',operations,{address:null,transportMethod:null})).status,200);
        saved=data(await call('get','/api/team-operations/get/'+carer.id));assert.equal(saved.address,null);assert.equal(saved.transportMethod,null);assert.equal(saved.rateCard,'Standard care');
        const skill = await request(app)
          .post("/api/team/skills/update/" + carer.id)
          .set("Authorization", "Bearer " + token)
          .field("name", "First aid")
          .field("endsAt", "false");
        assert.equal(skill.status, 200, JSON.stringify(skill.body));
      },
    );
    await t.test(
      "private file upload, signed download, caregiver visibility, signature pack",
      async () => {
        const pdf = Buffer.from(
          "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF",
        );
        const upload = await request(app)
          .post("/api/client-care-plan/files/upload-document")
          .set("Authorization", "Bearer " + token)
          .field("clientId", clientId)
          .field("fileType", "OTHER")
          .field("readAccessToCareGivers", "false")
          .attach("file", pdf, "test.pdf");
        assert.equal(upload.status, 200, JSON.stringify(upload.body));
        const fileUrl = data(upload).fileUrl;
        assert.equal((await request(app).get("/" + fileUrl)).status, 200);
        assert.equal(
          (await request(app).get("/" + fileUrl.split("?")[0])).status,
          401,
        );
        assert.equal(
          data(
            await call(
              "get",
              "/api/client-care-plan/files/" + clientId,
              undefined,
              carerToken,
            ),
          ).length,
          0,
        );
        const source = await request(app)
          .post("/api/client-care-plan/signature/upload")
          .set("Authorization", "Bearer " + token)
          .field("clientId", clientId)
          .attach("file", pdf, "signature.pdf");
        assert.equal(source.status, 200, JSON.stringify(source.body));
        const pack = await call(
          "post",
          "/api/client-care-plan/signature/document-pack/create",
          { clientId, documents: [data(source).id] },
        );
        assert.equal(pack.status, 200, JSON.stringify(pack.body));
        const signed = await call(
          "post",
          "/api/client-care-plan/signature/save-signed-documents",
          {
            clientId,
            documentPackId: data(pack).documentPackId,
            signatories: [{ name: "Test Signer", role: "CLIENT" }],
            documentNotes: [],
          },
        );
        assert.equal(signed.status, 200, JSON.stringify(signed.body));
        assert.equal(
          data(
            await call(
              "get",
              "/api/client-care-plan/signature/document-pack/" + clientId,
            ),
          ).status,
          "SIGNED",
        );
        const bad = await request(app)
          .post("/api/client-care-plan/files/upload-document")
          .set("Authorization", "Bearer " + token)
          .field("clientId", clientId)
          .attach("file", Buffer.from("<script>bad</script>"), "fake.pdf");
        assert.equal(bad.status, 400);
      },
    );
    await t.test(
      "onboarding uploads and additional documents, absence overlap and sharing settings",
      async () => {
        const pdf = Buffer.from(
          "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF",
        );
        const onboarding = await request(app)
          .post("/api/team-onboarding/update/" + carer.id)
          .set("Authorization", "Bearer " + token)
          .field("role", "CARER")
          .field("contractType", "SALARIED")
          .field("weeklyContractedHours", "35")
          .field("additionalDocumentDescription", "Demo certificate")
          .field("additionalDocumentCategory", "OTHER")
          .field("additionalDocumentExpires", "false")
          .attach("contractFile", pdf, "contract.pdf")
          .attach("additionalDocumentFiles", pdf, "certificate.pdf");
        assert.equal(onboarding.status, 200, JSON.stringify(onboarding.body));
        assert.equal(data(onboarding).role, "CARER");
        assert.match(data(onboarding).contractFilePath, /^uploads\//);
        assert.equal(
          data(onboarding).teamOnboardingAdditionalDocuments[0]
            .additionalDocumentDescription,
          "Demo certificate",
        );
        const a = await call("post", "/api/team-absence/create/" + carer.id, {
          startDate: "2026-09-09",
          endDate: "2026-09-11",
          startTime: "08:00",
          endTime: "17:00",
          reason: "Demo absence",
        });
        assert.equal(a.status, 200, JSON.stringify(a.body));
        assert.equal(
          data(
            await call("post", "/api/team-absence/getAll/" + carer.id, {
              startDate: "2026-10-01",
              endDate: "2026-10-31",
            }),
          ).length,
          0,
        );
        assert.equal(
          data(
            await call("post", "/api/team-absence/getAll/" + carer.id, {
              startDate: "2026-09-01",
              endDate: "2026-09-30",
            }),
          ).length,
          1,
        );
        const access = await call("post", "/api/client-share-access/generate", {
          clientId,
          scopes: ["BASIC"], days: 7, acknowledged: true, revision: 0,
        });
        assert.equal(access.status, 200);
        assert.match(data(access).accessCode, /^[A-F0-9]{4}(-[A-F0-9]{4}){4}$/);
        assert.equal(
          (
            await call("post", "/api/client-share-access/send-magic-link", {
              clientId,
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await call("post", "/api/client-medication/create/" + clientId, {
              allergies: "Test only",
              isMedicineSupportProvided: true,
            })
          ).status,
          201,
        );
        assert.equal(
          (
            await call(
              "get",
              "/api/client-medication-scheduling/get-all-by-client-id/" +
                clientId +
                "?dateFilter=September_2026",
            )
          ).status,
          200,
        );
      },
    );
    await t.test(
      "bulk changes roll back atomically and request bodies cannot forge file ownership",
      async () => {
        const assignment = await repo.one("ClientCareTeamEntity", {
          client: clientId,
          carer: carer.id,
        });
        const response = await call(
          "put",
          "/api/client-care-team/bulk-update/" + clientId,
          [
            { id: assignment.id, viewAccess: false },
            { carerId: other.id, viewAccess: true },
          ],
        );
        assert.equal(response.status, 404);
        assert.equal(
          (await repo.get("ClientCareTeamEntity", assignment.id)).viewAccess,
          true,
        );
        const changed = await call("put", "/api/team/update-user/" + carer.id, {
          profileImagePath: "uploads/forged-private-document.pdf",
        });
        assert.equal(changed.status, 200);
        assert.equal(data(changed).profileImagePath, null);
        const info = await repo.one("ClientInformationEntity", {
          user: clientId,
        });
        const forged = await call(
          "post",
          "/api/client-information/update/" + clientId,
          {
            ethnicity: "Should roll back",
            clientEmergencyContacts: [
              { id: randomUUID(), firstName: "Forged" },
            ],
          },
        );
        assert.equal(forged.status, 404);
        assert.equal(
          (await repo.get("ClientInformationEntity", info.id)).ethnicity,
          "Test",
        );
      },
    );
    await t.test(
      "expired links and deactivated accounts cannot sign in",
      async () => {
        const credentials = await login(carer.email);
        await db.query(
          "UPDATE node_login_links SET expires_at=$1 WHERE user_id=$2",
          [new Date(Date.now() - 1000).toISOString(), carer.id],
        );
        assert.equal(
          (await call("post", "/api/auth/get-token", credentials, null)).status,
          401,
        );
        await repo.save("UserEntity", { id: carer.id, isActive: false });
        assert.equal(
          (await call("post", "/api/auth/validate-token", {}, carerToken))
            .status,
          401,
        );
        await repo.save("UserEntity", { id: carer.id, isActive: true });
      },
    );
    await t.test(
      "settings, QR regeneration, care circle invitations and logout revocation",
      async () => {
        assert.equal(
          (
            await call(
              "post",
              "/api/client-settings/regenerate-qrcode/" + clientId,
              {},
            )
          ).status,
          200,
        );
        const circle = await call("post", "/api/client-care-circle/create", {
          userId: clientId,
          firstName: "Circle",
          lastName: "Member",
          isInviteSent: true,
          phoneNumber: 123,
        });
        assert.equal(circle.status, 201, JSON.stringify(circle.body));
        assert.equal(
          (
            await call(
              "put",
              "/api/client-care-circle/invitation/" + data(circle).id,
              { isInviteSent: false },
            )
          ).status,
          200,
        );
        assert.equal((await call("post", "/api/auth/logout", {})).status, 200);
        assert.equal(
          (await call("post", "/api/auth/validate-token", {})).status,
          401,
        );
      },
    );
  } finally {
    await db.close();
    await rm(directory, { recursive: true, force: true });
  }
});
