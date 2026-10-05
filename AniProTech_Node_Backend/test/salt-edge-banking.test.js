import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { openDatabase, initializeSchema } from "../src/db.js";
import { createApp } from "../src/app.js";

test("Salt Edge keeps banking data within its organisation and rejects callback replay", async () => {
  const db = await openDatabase({ driver: "pglite", dataDir: ":memory:" });
  const originalFetch = global.fetch;
  try {
    await initializeSchema(db);
    const sent = [], agencyA = randomUUID(), agencyB = randomUUID();
    for (const id of [agencyA, agencyB]) await db.query(`INSERT INTO node_agencies
      (id,name,business_type,phone,address_line1,city,postcode,country,timezone,terms_accepted_at)
      VALUES($1,'Test care','HOME_CARE','01234567890','1 Road','London','SW1A 1AA','United Kingdom','Europe/London',CURRENT_TIMESTAMP)`, [id]);
    const app = createApp({ db, config: { production: false,
      jwtSecret: "salt-edge-test-secret-at-least-32-characters", frontendUrl: "http://localhost:5173",
      corsOrigins: [], uploadDir: "./test-uploads", saltEdgeAppId: "test-app",
      saltEdgeSecret: "test-secret", saltEdgeCallbackUri: "http://localhost:9000/api/accounting/banking/salt-edge/callback",
    }, mail: { send: async (message) => sent.push(message) } });
    const { repo, auth } = app.locals.ctx;
    async function login(name, agencyId) {
      const user = await repo.save("UserEntity", { firstName: name, lastName: "Owner",
        email: `${name}@test.example`, role: "SUPERADMIN", isActive: true, agencyId });
      await auth.requestLink(user.email);
      const url = sent.at(-1).text.match(/http[^\s]+/)[0];
      const [email, password] = Buffer.from(new URL(url).searchParams.get("token"), "base64url").toString().split(":");
      return (await auth.exchange(email, password)).accessToken;
    }
    const tokenA = await login("ownerA", agencyA), tokenB = await login("ownerB", agencyB);
    let state, customerId;
    global.fetch = async (url, options) => {
      const address = new URL(String(url));
      assert.equal(options.headers["App-id"], "test-app");
      assert.equal(options.headers.Secret, "test-secret");
      if (address.pathname.startsWith("/api/v6/customers/caremonitor-")) return Response.json({ error: {} }, { status: 404 });
      if (address.pathname === "/api/v6/customers" && options.method === "POST") {
        assert.equal(JSON.parse(options.body).data.identifier, `caremonitor-${agencyA}`);
        customerId = "101";
        return Response.json({ data: { customer_id: customerId } });
      }
      if (address.pathname === "/api/v6/connections/connect") {
        const data = JSON.parse(options.body).data;
        assert.equal(data.customer_id, customerId);
        assert.deepEqual(data.consent.scopes, ["accounts", "transactions"]);
        state = new URL(data.attempt.return_to).searchParams.get("state");
        return Response.json({ data: { connect_url: "https://www.saltedge.com/connect?token=test-token" } });
      }
      if (address.pathname === "/api/v6/connections/201") return Response.json({ data: { id: "201", customer_id: customerId, status: "active" } });
      if (address.pathname === "/api/v6/connections") {
        assert.equal(address.searchParams.get("customer_id"), customerId);
        return Response.json({ data: [{ id: "201", customer_id: customerId, status: "active", provider_name: "Fake Bank Simple" }], meta: {} });
      }
      if (address.pathname === "/api/v6/accounts") return Response.json({ data: [{ id: "301", connection_id: "201",
        name: "Business current", nature: "checking", balance: 100.25, currency_code: "GBP", extra: { account_number: "12345678" } }], meta: {} });
      if (address.pathname === "/api/v6/transactions") return Response.json({ data: [{ id: "401", account_id: "301",
        amount: 42.15, currency_code: "GBP", made_on: "2026-10-02", description: "Invoice payment", duplicated: false }], meta: {} });
      throw new Error(`Unexpected provider path: ${address.pathname}`);
    };
    const begin = await request(app).post("/api/accounting/banking/salt-edge/start")
      .set("Authorization", `Bearer ${tokenA}`).send({});
    assert.equal(begin.status, 200);
    assert.match(begin.body.results.data.url, /^https:\/\/www\.saltedge\.com\/connect/);
    assert.ok(state);
    const callback = await request(app).get("/api/accounting/banking/salt-edge/callback").query({ state, connection_id: "201" });
    assert.equal(callback.status, 303);
    assert.match(callback.headers.location, /bank=connected/);
    const own = await request(app).get("/api/accounting/banking").set("Authorization", `Bearer ${tokenA}`);
    const other = await request(app).get("/api/accounting/banking").set("Authorization", `Bearer ${tokenB}`);
    assert.equal(own.body.results.data.accounts.length, 1);
    assert.equal(own.body.results.data.accounts[0].balancePence, 10025);
    assert.equal(own.body.results.data.transactions[0].amountPence, 4215);
    assert.equal(own.body.results.data.transactions[0].isSandbox, true);
    assert.equal(other.body.results.data.accounts.length, 0);
    assert.equal(other.body.results.data.transactions.length, 0);
    const replay = await request(app).get("/api/accounting/banking/salt-edge/callback").query({ state, connection_id: "201" });
    assert.match(replay.headers.location, /bank=failed/);
    const second = await request(app).post("/api/accounting/banking/salt-edge/start")
      .set("Authorization", `Bearer ${tokenA}`).send({});
    assert.equal(second.status, 200);
    const pending = await request(app).get("/api/accounting/banking/salt-edge/callback")
      .query({ state, error_class: "ClientPending" });
    assert.match(pending.headers.location, /bank=approval_required/);
    const pendingReplay = await request(app).get("/api/accounting/banking/salt-edge/callback")
      .query({ state, error_class: "ClientPending" });
    assert.match(pendingReplay.headers.location, /bank=failed/);
  } finally { global.fetch = originalFetch; await db.close(); }
});

 test("unconfigured banking reports unavailable without calling the provider", async () => {
  const { readSaltEdgeBankingData } = await import("../src/services/salt-edge-banking.js");
  const result = await readSaltEdgeBankingData({ db: { query() { throw new Error("must not query"); } }, config: {} }, "agency");
  assert.equal(result.provider, "salt-edge");
  assert.equal(result.configured, false);
  assert.deepEqual(result.transactions, []);
 });
