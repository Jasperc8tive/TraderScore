/* eslint-disable no-console -- this is a CLI reporter; console output is its purpose */
// End-to-end feature demo against the running TradeScore API (localhost:4000).
// Drives the real auth + trade + confirmation + reputation + admin flows.
const BASE = process.env.DEMO_API ?? "http://localhost:4000/api/v1";

let pass = 0, fail = 0;
const line = (s = "") => console.log(s);
const h = (s) => line(`\n\x1b[1m\x1b[36m=== ${s} ===\x1b[0m`);
const ok = (s) => { pass++; line(`  \x1b[32m✓\x1b[0m ${s}`); };
const bad = (s) => { fail++; line(`  \x1b[31m✗\x1b[0m ${s}`); };
// Report a pass/fail in one expression so call sites stay statements (not
// bare ternaries, which ESLint flags as unused expressions).
const check = (cond, good, ill) => (cond ? ok(good) : bad(ill));

async function api(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, ok: res.ok, data: json?.data ?? json, raw: json };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Dev OTP login -> access token. Retries through the resend cooldown so the
// demo is re-runnable without waiting manually.
async function login(phone) {
  let req = await api("POST", "/auth/otp/request", { body: { phone } });
  for (let i = 0; i < 14 && req.raw?.error?.code === "RATE_LIMITED"; i++) {
    if (i === 0) line(`  …rate-limited on ${phone}, waiting out the 60s OTP cooldown`);
    await sleep(5000);
    req = await api("POST", "/auth/otp/request", { body: { phone } });
  }
  const code = req.data?.devCode;
  if (!code) throw new Error(`no devCode for ${phone}: ${JSON.stringify(req.raw)}`);
  const ver = await api("POST", "/auth/otp/verify", { body: { phone, code } });
  const token = ver.data?.accessToken;
  if (!token) throw new Error(`verify failed for ${phone}: ${JSON.stringify(ver.raw)}`);
  return token;
}

const money = (minor, cur = "NGN") => `${cur} ${(minor / 100).toLocaleString()}`;

async function main() {
  // ---------------------------------------------------------------- HEALTH
  h("1. Health & readiness");
  const health = await api("GET", "/health");
  const ready = await api("GET", "/health/ready");
  check(health.ok, `GET /health -> ${JSON.stringify(health.data)}`, `/health ${health.status}`);
  check(ready.ok, `GET /health/ready -> ${JSON.stringify(ready.data)}`, `/health/ready ${ready.status}`);

  // ----------------------------------------------------------- DISCOVERY (public)
  h("2. Public discovery (no auth) — the marketplace");
  const disc = await api("GET", "/discovery");
  const items = disc.data?.items ?? disc.data?.data ?? disc.data ?? [];
  const list = Array.isArray(items) ? items : (items.items ?? []);
  ok(`GET /discovery -> ${list.length} businesses listed publicly`);
  for (const b of list.slice(0, 6)) {
    line(`     • ${b.name} (${b.slug}) — score ${b.score ?? b.trustScore ?? "n/a"}, ${b.assuranceLevel ?? ""}`);
  }
  const sample = list[0];
  if (sample?.slug) {
    const detail = await api("GET", `/discovery/${sample.slug}`);
    check(detail.ok, `GET /discovery/${sample.slug} -> public profile for "${detail.data?.name}"`,
      `discovery detail ${detail.status}`);
  }

  // ----------------------------------------------------------------- AUTH
  h("3. Authentication — phone OTP flow (dev code)");
  const adminToken = await login("+2348000000000");
  ok("Logged in as platform admin (+2348000000000) via OTP");
  const ikejaToken = await login("+2348120000001");
  ok("Logged in as Ikeja Phone Hub owner via OTP");
  const lagosToken = await login("+2348120000005");
  ok("Logged in as Lagos Tech Mart owner via OTP");

  // ------------------------------------------------------------- BUSINESSES
  h("4. Businesses directory (authenticated)");
  const biz = await api("GET", "/businesses", { token: adminToken });
  const bizList = biz.data?.items ?? biz.data ?? [];
  const all = Array.isArray(bizList) ? bizList : [];
  const total = biz.data?.total ?? all.length;
  ok(`GET /businesses -> page of ${all.length} (total ${total}) businesses`);
  const ikejaRes = await api("GET", "/businesses/ikeja-phone-hub", { token: ikejaToken });
  const lagosRes = await api("GET", "/businesses/lagos-tech-mart", { token: lagosToken });
  const ikeja = ikejaRes.data;
  const lagos = lagosRes.data;
  if (!ikeja?.id || !lagos?.id) { bad("expected pilot businesses not found — run `pnpm db:seed:pilot`"); return; }
  ok(`Initiator: ${ikeja.name} (${ikeja.id.slice(0, 8)}…)`);
  ok(`Counterparty: ${lagos.name} (${lagos.id.slice(0, 8)}…)`);

  // score BEFORE
  const scoreBefore = await api("GET", `/businesses/${lagos.id}/score`, { token: lagosToken });
  const sb = scoreBefore.data?.score ?? scoreBefore.data?.value ?? JSON.stringify(scoreBefore.data);
  ok(`Lagos Tech Mart score BEFORE new trade: ${sb}`);

  // --------------------------------------------------------------- TRADES
  h("5. Trade logging — Ikeja logs a sale to Lagos Tech Mart");
  const create = await api("POST", "/trades", {
    token: ikejaToken,
    body: {
      initiatorBusinessId: ikeja.id,
      counterpartyBusinessId: lagos.id,
      direction: "SALE",
      amountMinor: 475000,
      currency: "NGN",
      description: "Bulk USB-C cables + chargers",
      occurredOn: new Date().toISOString().slice(0, 10),
    },
  });
  if (!create.ok) { bad(`create trade ${create.status}: ${JSON.stringify(create.raw)}`); return; }
  const trade = create.data;
  ok(`POST /trades -> created ${trade.referenceCode ?? trade.id} status=${trade.status} amount=${money(475000)}`);

  const submit = await api("POST", `/trades/${trade.id}/submit`, { token: ikejaToken });
  check(submit.ok, `POST /trades/${trade.id.slice(0, 8)}…/submit -> status=${submit.data?.status}`,
    `submit ${submit.status}: ${JSON.stringify(submit.raw)}`);

  // -------------------------------------------------------- CONFIRMATIONS
  h("6. Counterparty confirmation — Lagos confirms the incoming trade");
  const incoming = await api("GET", `/confirmations/incoming?businessId=${lagos.id}`, { token: lagosToken });
  const inc = incoming.data?.items ?? incoming.data ?? [];
  ok(`GET /confirmations/incoming -> ${(Array.isArray(inc) ? inc.length : 0)} pending for Lagos Tech Mart`);
  const confirm = await api("POST", `/confirmations/${trade.id}/confirm`, {
    token: lagosToken, body: { note: "Goods received in full." },
  });
  check(confirm.ok, `POST /confirmations/${trade.id.slice(0, 8)}…/confirm -> status=${confirm.data?.status}`,
    `confirm ${confirm.status}: ${JSON.stringify(confirm.raw)}`);

  const history = await api("GET", `/trades/${trade.id}/history`, { token: ikejaToken });
  const hist = Array.isArray(history.data) ? history.data : [];
  ok(`GET /trades/:id/history -> ${hist.length} immutable events: ${hist.map((e) => e.eventType ?? e.toStatus).join(" → ")}`);

  // --------------------------------------------------------- REPUTATION
  h("7. Reputation engine — recompute after confirmed trade");
  // Forcing a recompute is admin-only (owners get 403) — use the admin token.
  const recompute = await api("POST", `/businesses/${lagos.id}/score/recompute`, { token: adminToken });
  check(recompute.ok, `POST /score/recompute -> ${JSON.stringify(recompute.data).slice(0, 120)}`,
    `recompute ${recompute.status}: ${JSON.stringify(recompute.raw)}`);
  const scoreAfter = await api("GET", `/businesses/${lagos.id}/score`, { token: lagosToken });
  const sa = scoreAfter.data?.score ?? scoreAfter.data?.value ?? JSON.stringify(scoreAfter.data);
  ok(`Lagos Tech Mart score AFTER: ${sa}`);
  const scoreHist = await api("GET", `/businesses/${lagos.id}/score/history`, { token: lagosToken });
  const sh = scoreHist.data?.items ?? scoreHist.data ?? [];
  ok(`GET /score/history -> ${(Array.isArray(sh) ? sh.length : 0)} snapshots`);

  // ------------------------------------------------------------- BILLING
  h("8. Billing & subscriptions");
  const plans = await api("GET", "/billing/plans", { token: adminToken });
  const pl = plans.data?.items ?? plans.data ?? [];
  ok(`GET /billing/plans -> ${(Array.isArray(pl) ? pl : Object.keys(pl)).length} plans`);
  for (const p of (Array.isArray(pl) ? pl : [])) {
    line(`     • ${p.name ?? p.id}: ${typeof p.priceMinor === "number" ? money(p.priceMinor) : ""}`);
  }
  const sub = await api("GET", `/businesses/${ikeja.id}/subscription`, { token: ikejaToken });
  ok(`GET /businesses/:id/subscription -> ${JSON.stringify(sub.data).slice(0, 120)}`);
  const revenue = await api("GET", "/admin/billing/revenue", { token: adminToken });
  check(revenue.ok, `GET /admin/billing/revenue -> ${JSON.stringify(revenue.data).slice(0, 120)}`,
    `revenue ${revenue.status}`);

  // ------------------------------------------------------ FRAUD + ADMIN
  h("9. Fraud detection & admin oversight");
  const scan = await api("POST", "/admin/fraud/scan", { token: adminToken, body: {} });
  check(scan.ok, `POST /admin/fraud/scan -> ${JSON.stringify(scan.data).slice(0, 140)}`,
    `fraud scan ${scan.status}: ${JSON.stringify(scan.raw)}`);
  const flags = await api("GET", "/admin/fraud/flags", { token: adminToken });
  const fl = flags.data?.items ?? flags.data ?? [];
  ok(`GET /admin/fraud/flags -> ${(Array.isArray(fl) ? fl.length : 0)} flags`);
  const scores = await api("GET", "/admin/scores/overview", { token: adminToken });
  check(scores.ok, `GET /admin/scores/overview -> ${JSON.stringify(scores.data).slice(0, 140)}`,
    `scores overview ${scores.status}`);
  const fraudOv = await api("GET", "/admin/fraud/overview", { token: adminToken });
  check(fraudOv.ok, `GET /admin/fraud/overview -> ${JSON.stringify(fraudOv.data).slice(0, 140)}`,
    `fraud overview ${fraudOv.status}`);

  // --------------------------------------------------------- ANALYTICS
  h("10. Pilot analytics & feature flags");
  const pilot = await api("GET", "/pilot/stats", { token: adminToken });
  check(pilot.ok, `GET /pilot/stats -> ${JSON.stringify(pilot.data).slice(0, 200)}`,
    `pilot stats ${pilot.status}`);
  const flags2 = await api("GET", "/feature-flags", { token: adminToken });
  check(flags2.ok, `GET /feature-flags -> ${JSON.stringify(flags2.data).slice(0, 160)}`,
    `feature flags ${flags2.status}`);

  // --------------------------------------------------------------- SUMMARY
  line(`\n\x1b[1m──────────────────────────────────────────\x1b[0m`);
  line(`\x1b[1mRESULT: \x1b[32m${pass} passed\x1b[0m, ${fail ? `\x1b[31m${fail} failed\x1b[0m` : "0 failed"}`);
}

main().catch((e) => { console.error("\x1b[31mDEMO ERROR:\x1b[0m", e); process.exit(1); });
