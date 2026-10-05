import { createHash, randomBytes } from "node:crypto";
import { fail, reply } from "../http.js";

const baseUrl = "https://www.saltedge.com/api/v6";
const hash = (value) => createHash("sha256").update(value).digest("hex");
const asText = (value, max = 200) => String(value ?? "").slice(0, max);
const isProviderId = (value) => /^\d{1,30}$/.test(String(value ?? ""));
const gbpPence = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) && Math.abs(amount) <= 1e9 ? Math.round(amount * 100) : null;
};

async function saltEdge(config, method, path, data) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "App-id": config.saltEdgeAppId,
      Secret: config.saltEdgeSecret,
    },
    ...(data === undefined ? {} : { body: JSON.stringify({ data }) }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    const error = new Error("Salt Edge request failed");
    error.providerStatus = response.status;
    throw error;
  }
  return response.json();
}

async function pages(config, path) {
  const rows = [];
  let fromId = "";
  for (let page = 0; page < 20; page++) {
    const url = new URL(`${baseUrl}${path}`);
    url.searchParams.set("per_page", "250");
    if (fromId) url.searchParams.set("from_id", fromId);
    const result = await saltEdge(config, "GET", `${url.pathname.slice("/api/v6".length)}${url.search}`);
    if (!Array.isArray(result.data)) throw new Error("Salt Edge returned an invalid list");
    rows.push(...result.data);
    const next = String(result.meta?.next_id || "");
    if (!next) return rows;
    if (!isProviderId(next) || next === fromId) throw new Error("Invalid Salt Edge pagination");
    fromId = next;
  }
  throw new Error("Salt Edge pagination limit reached");
}

async function requireAgency({ db, auth }, req) {
  auth.admin(req);
  if (!req.user.agencyId) fail(403, "An organisation is required");
  const agency = (await db.query("SELECT status FROM node_agencies WHERE id=$1", [req.user.agencyId])).rows[0];
  if (agency?.status !== "ACTIVE") fail(403, "Organisation approval is required");
  return req.user.agencyId;
}

async function customerForAgency({ db, config }, agencyId) {
  const existing = (await db.query("SELECT customer_id FROM node_salt_edge_customers WHERE agency_id=$1", [agencyId])).rows[0];
  if (existing) return existing.customer_id;
  const identifier = `caremonitor-${agencyId}`;
  let customerId;
  try {
    const customer = await saltEdge(config, "GET", `/customers/${encodeURIComponent(identifier)}`);
    customerId = customer.data?.customer_id;
  } catch (error) {
    if (error.providerStatus !== 404) throw error;
    const customer = await saltEdge(config, "POST", "/customers", { identifier });
    customerId = customer.data?.customer_id;
  }
  if (!isProviderId(customerId)) throw new Error("Salt Edge customer ID is invalid");
  await db.query(`INSERT INTO node_salt_edge_customers(agency_id,customer_id) VALUES($1,$2)
    ON CONFLICT(agency_id) DO NOTHING`, [agencyId, String(customerId)]);
  return (await db.query("SELECT customer_id FROM node_salt_edge_customers WHERE agency_id=$1", [agencyId])).rows[0].customer_id;
}

export function registerSaltEdgeBanking(ctx, route) {
  const { db, auth, config } = ctx;
  route("GET", "/api/accounting/banking", async (req, res) => {
    const agencyId = await requireAgency(ctx, req);
    try {
      const banking = await readSaltEdgeBankingData(ctx, agencyId);
      return reply(res, { ...banking, transactions: banking.transactions.slice(0, 100) });
    } catch (error) {
      console.error("Salt Edge banking read failed", error.providerStatus || error.message);
      fail(502, "Bank data is temporarily unavailable. Please try again.");
    }
  });

  route("POST", "/api/accounting/banking/salt-edge/start", async (req, res) => {
    const agencyId = await requireAgency(ctx, req);
    if (!config.saltEdgeAppId || !config.saltEdgeSecret) fail(503, "Salt Edge is not configured");
    if (config.production && !config.saltEdgeCallbackUri?.startsWith("https://")) fail(503, "A secure banking callback is required");
    try {
      const customerId = await customerForAgency(ctx, agencyId);
      const state = randomBytes(32).toString("base64url");
      const returnTo = new URL(config.saltEdgeCallbackUri);
      returnTo.searchParams.set("state", state);
      const response = await saltEdge(config, "POST", "/connections/connect", {
        customer_id: customerId,
        consent: { scopes: ["accounts", "transactions"], period_days: 90 },
        attempt: { fetch_scopes: ["accounts", "balance", "transactions"],
          allowed_countries: ["GB", "XF"], popular_providers_country: "GB", return_to: returnTo.toString() },
        provider: { include_sandboxes: true },
        return_connection_id: true,
        return_error_class: true,
        automatic_refresh: false,
      });
      const connectUrl = response.data?.connect_url;
      if (!connectUrl || new URL(connectUrl).origin !== "https://www.saltedge.com") throw new Error("Invalid Salt Edge connect URL");
      await db.query(`INSERT INTO node_salt_edge_connection_attempts
        (state_hash,agency_id,customer_id,started_by,expires_at)
        VALUES($1,$2,$3,$4,CURRENT_TIMESTAMP + INTERVAL '15 minutes')`,
      [hash(state), agencyId, customerId, req.user.id]);
      return reply(res, { url: connectUrl });
    } catch (error) {
      console.error("Salt Edge connection start failed", error.providerStatus || error.message);
      fail(502, "Unable to start the bank connection. Please try again.");
    }
  });
}

export async function readSaltEdgeBankingData({ db, config }, agencyId) {
  if (!config.saltEdgeAppId || !config.saltEdgeSecret)
    return { provider: "salt-edge", configured: false, connections: [], accounts: [], transactions: [] };
  const customer = (await db.query("SELECT customer_id FROM node_salt_edge_customers WHERE agency_id=$1", [agencyId])).rows[0];
  if (!customer) return { provider: "salt-edge", configured: true, connections: [], accounts: [], transactions: [] };
  const connections = await pages(config, `/connections?customer_id=${encodeURIComponent(customer.customer_id)}`);
  const active = connections.filter((connection) => connection.status === "active" &&
    String(connection.customer_id) === customer.customer_id && isProviderId(connection.id));
  const accounts = [], transactions = [];
  for (const connection of active) {
    const isSandbox = connection.country_code !== "GB" ||
      !connection.provider_code || /^fake_/i.test(connection.provider_code) ||
      /fake|sandbox/i.test(String(connection.provider_name || ""));
    const currentAccounts = await pages(config, `/accounts?connection_id=${encodeURIComponent(connection.id)}&customer_id=${encodeURIComponent(customer.customer_id)}`);
    const ids = new Set();
    for (const account of currentAccounts) {
      if (!isProviderId(account.id) || String(account.connection_id) !== String(connection.id)) continue;
      const id = String(account.id), currency = asText(account.currency_code, 3).toUpperCase();
      ids.add(id);
      accounts.push({ id, name: asText(account.name), currency,
        accountType: asText(account.nature, 60), lastFour: asText(account.extra?.account_number, 100).slice(-4),
        balancePence: currency === "GBP" ? gbpPence(account.balance) : null,
        providerName: asText(connection.provider_name, 120) });
    }
    const currentTransactions = await pages(config, `/transactions?connection_id=${encodeURIComponent(connection.id)}&pending=false&duplicated=false`);
    for (const transaction of currentTransactions) {
      const id = String(transaction.id ?? ""), accountId = String(transaction.account_id ?? "");
      const currency = asText(transaction.currency_code, 3).toUpperCase();
      const pence = gbpPence(transaction.amount);
      if (!isProviderId(id) || !ids.has(accountId) || currency !== "GBP" || pence === null || transaction.duplicated) continue;
      transactions.push({ id, accountId, date: /^\d{4}-\d{2}-\d{2}$/.test(transaction.made_on) ? transaction.made_on : null,
        description: asText(transaction.description, 500), amountPence: pence, currency, isSandbox });
    }
  }
  transactions.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return { provider: "salt-edge", configured: true,
    connections: connections.map((connection) => ({ id: String(connection.id),
      name: asText(connection.provider_name, 120), status: asText(connection.status, 30) })),
    accounts, transactions };
}

export function saltEdgeCallback({ db, config }) {
  return async (req, res) => {
    const returnUrl = new URL("/admin/accounting?section=banking", config.frontendUrl);
    try {
      const state = String(req.query.state || "");
      const connectionId = String(req.query.connection_id || "");
      if (!/^[A-Za-z0-9_-]{40,60}$/.test(state)) throw new Error("Invalid connection state");
      const attempt = (await db.query(`SELECT agency_id,customer_id FROM node_salt_edge_connection_attempts
        WHERE state_hash=$1 AND completed_at IS NULL AND expires_at>CURRENT_TIMESTAMP`, [hash(state)])).rows[0];
      if (!attempt) throw new Error("Connection attempt is invalid or expired");
      if (req.query.error_class || !isProviderId(connectionId)) {
        await db.query(`UPDATE node_salt_edge_connection_attempts SET completed_at=CURRENT_TIMESTAMP
          WHERE state_hash=$1 AND completed_at IS NULL AND expires_at>CURRENT_TIMESTAMP`, [hash(state)]);
        if (req.query.error_class === "ClientPending") returnUrl.searchParams.set("bank", "approval_required");
        else returnUrl.searchParams.set("bank", "failed");
        return res.redirect(303, returnUrl.toString());
      }
      const connection = (await saltEdge(config, "GET", `/connections/${encodeURIComponent(connectionId)}`)).data;
      if (String(connection?.customer_id) !== attempt.customer_id) throw new Error("Connection belongs to a different customer");
      const consumed = await db.query(`UPDATE node_salt_edge_connection_attempts SET completed_at=CURRENT_TIMESTAMP
        WHERE state_hash=$1 AND completed_at IS NULL AND expires_at>CURRENT_TIMESTAMP RETURNING agency_id`, [hash(state)]);
      if (!consumed.rows[0]) throw new Error("Connection attempt already used");
      returnUrl.searchParams.set("bank", "connected");
    } catch (error) {
      console.error("Salt Edge connection callback failed", error.providerStatus || error.message);
      returnUrl.searchParams.set("bank", "failed");
    }
    return res.redirect(303, returnUrl.toString());
  };
}
