# Masar Platform — Production Readiness Audit (Final Pre-Launch)

**Question:** can Masar safely go live for its first real paying school?
**Method:** the system exactly as implemented, audited against production operation. No hypothetical architectures.

---

## Executive Summary

**Verdict: PRODUCTION BLOCKED.**

The engineering is genuinely strong. 71 tables at 100% RLS enabled *and* forced, 256 policies, 143 functions with zero `search_path` gaps, 142 indexes covering every hot path, a clean generated-type contract across six portals, and 545 passing backend tests. The security *model* is sound and the schema is production-grade. That is not the problem.

**The problem is that every connection to the outside world is a stub.** All five external provider ports — activation dispatch, notifications, payments, camera relay, LLM — are `console.info` stubs that return success without doing anything:

| Port | What it does today |
|---|---|
| `activation.ts` | Fabricates a URL with a random UUID token, logs it, returns `delivered: true` |
| `notificationProviders.ts` | Push/WhatsApp/SMS/email all return `delivered: true`, send nothing |
| `paymentGateway.ts` | Returns `redirectUrl: null` and a fake reference; Fawry code is `Math.random()` |
| `mediaRelay.ts` | Returns `https://relay.stub.masar.app/...` — a host that does not exist |
| `llmProvider.ts` | Returns template text, not model output |

Each is deliberately and honestly marked as stubbed pending vendor contracting. But in production this is not a set of degraded features — it is a system that **silently reports success for things that never happened.** No parent receives a notification, yet `notification_deliveries` fills with `delivered: true` rows. That is not a missing feature; it is a falsified operational record.

Separately, one finding is a straightforward **critical security vulnerability**: the payment webhook is a public unauthenticated endpoint whose signature check **returns `true` when its secret is unset**. Anyone on the internet could mark any payment succeeded.

Two additional hard blockers: **no user can complete first login** (activation is never delivered and SMS is disabled), and **the project is on the Supabase free plan** — no PITR, no production backup guarantee for a system holding children's records.

None of this is a design failure. The architecture anticipated all of it. It is the last mile — vendor contracts, secrets, plan tier, and one fail-open default — and none of it can be waived for a real school with real children and real money.

---

## 1. Launch Blockers

### B1 — Payment webhook fails open 🔴 CRITICAL SECURITY

`backend/supabase/functions/_shared/paymentGateway.ts`:

```ts
export function verifyWebhookSignature(req: Request, _rawBody: string): boolean {
  const expected = Deno.env.get('PAYMENT_WEBHOOK_SECRET');
  if (!expected) {
    return true;                                   // ← unauthenticated pass
  }
  return req.headers.get('x-webhook-secret') === expected;
}
```

Combined with `config.toml`:

```toml
[functions.payment-webhook]
verify_jwt = false
```

The endpoint is publicly reachable with no Supabase auth by design (a PSP carries no user JWT). If `PAYMENT_WEBHOOK_SECRET` is not set in the production environment, **the signature check unconditionally passes** and any anonymous caller can POST a webhook that transitions payment transactions to `succeeded`.

The code comment states a production deployment *must* set the secret — but the failure mode is silent. A missed environment variable produces no error, no log, no degraded behaviour: it produces an open financial endpoint that looks like it is working.

Even with the secret set, it is a static header equality check — no HMAC over the body, no timestamp, no replay protection. That is acceptable for a first deployment *if and only if* the secret is set and transport is TLS. **The fail-open default is the blocker.**

### B2 — No external integration functions 🔴

All five provider ports are stubs (see Executive Summary). Consequences for a real school:

- **No parent, teacher, driver or manager can be onboarded** — activation links are logged to a Deno console, not sent.
- **No payment can be collected** — `createPaymentIntent` returns `redirectUrl: null`, so the Parent app's payment hand-off has nowhere to go. The Fawry reference is a random 9-digit number no kiosk will accept.
- **No notification reaches anyone** — attendance alerts, pickup confirmations, payment reminders, bus arrival, AI report delivery: all record success, none send.
- **No camera streams** — the relay URL points at a non-existent host.
- **AI reports are templates**, not model output, and are presented to families as reports about their child.

The notification case is the most serious because it is not merely absent — `notification_deliveries` and the `delivered` flag will be populated with **false positives**. A manager auditing "did the parent get told their child was absent?" gets an affirmative answer that is untrue.

### B3 — First login is impossible 🔴

Two independent causes, either sufficient:

1. Activation dispatch is stubbed (B2), so the link never arrives.
2. `config.toml` has `[auth.sms.twilio] enabled = false`, so the phone-OTP fallback built in Phase 10 — the alternative activation path — cannot send a code either.

Provisioning deliberately never sets a password (§10.3, correctly). With neither delivery channel live, **every provisioned account is permanently unreachable.** Email reset for Platform Admin is the only credential path with a chance of working, and only if SMTP is configured.

### B4 — Free-plan project: no PITR, no production backup posture 🔴

`config.toml` states plainly: *"this project (masar-staging) is on the free plan."*

For a system of record holding children's medical notes, guardian identities, custody arrangements and financial records, the free tier provides no point-in-time recovery and no production backup guarantee. **There is no verified restore path.** Backup restoration has never been exercised.

This is a data-loss exposure with legal weight given the data class, independent of any code defect.

### B5 — No provisioning UI: a school cannot be onboarded 🔴

Confirmed in the Phase 9 integration audit and unchanged: **12 of 19 Edge Functions have no frontend caller**, including every create path — `provision-tenant`, `enroll-child`, `add-staff`, `add-bus`, `issue-service-account-key`, `regenerate-activation-link`.

The platform can display everything and create nothing. Onboarding a school requires direct database/API operation by an engineer for every tenant, staff member, child, guardian and bus.

### B6 — Redirect allow-list does not cover the portals 🔴

```toml
site_url = "https://app.masar.app"
additional_redirect_urls = ["http://localhost:3000"]
```

Six portals will deploy to six origins. None is on the allow-list. Supabase rejects any `redirectTo` not listed, so the Platform Admin email reset (`window.location.origin + '/reset'`) will be refused — breaking the one credential-recovery path that could otherwise work.

### B7 — Never executed against real data 🔴

The staging database is empty. No query has returned a row, no RPC has run against real data, no RLS policy has been observed narrowing a result, no realtime event received.

This is not theoretical caution. The Phase 9 audit found the Teacher App calling a manager-only RPC — a button that failed on every press — which survived five phases precisely because an empty result and a permission denial are indistinguishable with no data. **The same blindness covers every flow in the system.**

`pnpm build` passing is not evidence that a school day works.

---

## 2. High-Risk Operational Issues

Issues that will generate support incidents within the first month.

| # | Risk | Impact |
|---|---|---|
| R1 | **`pg_cron` not installed** — 17 registered jobs, zero scheduled | Analytics never refresh; payment reminders never fire; stale `pending_verification` never escalates; **GPS retention purge never runs** (see P2); idempotency ledger never purged |
| R2 | **`storage_objects` never implemented** (`BACKEND_CERTIFICATION.md` §7.3) | 9 `*_object_id` columns unresolvable. No child photos, no staff photos, no invoice PDFs, and **no pickup-pass ID photo at a child-handover desk** — the identity check falls back to physical ID with no stored reference |
| R3 | **Notifications silently report success** | Staff will believe parents were informed. Disputes ("nobody told me my child was absent") will be unresolvable from the record, which says they were told |
| R4 | **Background GPS impossible in a web build** | A driver who locks their phone or backgrounds the app stops transmitting. Parents watching the bus see it freeze mid-route. Requires the Capacitor shell |
| R5 | **No `mark_notification_read` RPC** | Notification badges never clear in any portal. Guaranteed early complaint across all six apps |
| R6 | **Rate limiting unimplemented** except `scan_pickup_pass` (§7.2) | Login, OTP request and AI endpoints are unthrottled. Client-side debounce is explicitly documented as a courtesy control, not a boundary |
| R7 | **No frontend tests** (0 files) | 46 backend unit test files exist and 545 tests pass; the frontend has none. Regressions ship undetected |
| R8 | **MFA lockout is unrecoverable in-app** | A Platform Admin who loses their authenticator requires manual Supabase project intervention. No backup codes, no reset RPC |
| R9 | **`app_access` claim not enforced** | Backend issues it on every provisioned identity; no portal checks it. Revoking one portal's access without a role change has no effect |

---

## 3. Infrastructure Status

| Component | Status | Evidence |
|---|---|---|
| Supabase project & schema | **READY** | 67 migrations, 14 schemas, 71 tables, deployed and audited live |
| PostgREST exposure | **READY** | 13 schemas exposed; `analytics` correctly withheld and verified fail-closed |
| Auth — providers | **NOT READY** | `[auth.sms.twilio] enabled = false`; SMS is the primary factor for 5 of 6 roles |
| Auth — email | **PARTIALLY READY** | Enabled; SMTP not verified in this project |
| Auth — MFA | **READY** | TOTP enroll + verify enabled, `max_enrolled_factors = 10`; recovery limits documented |
| Auth — redirect allow-list | **NOT READY** | Portal origins absent (B6) |
| JWT config | **READY** | 1h expiry, refresh rotation on, 10s reuse interval |
| SMS provider | **NOT READY** | Disabled in config; stubbed in code |
| Email provider | **NOT READY** | Stubbed in `notificationProviders.ts` |
| Push / WhatsApp | **NOT READY** | Stubbed |
| Payments (PSP) | **NOT READY** | Stubbed; webhook fails open (B1) |
| Camera relay | **NOT READY** | Stub host `relay.stub.masar.app` |
| LLM provider | **NOT READY** | Template output |
| Storage — buckets | **PARTIALLY READY** | 7 buckets created with policies and a 20 MiB limit; the `storage_objects` layer that would make them usable is absent (R2) |
| Realtime | **READY** | Enabled; 12 channels; reference-counted registry verified leak-free |
| Cron | **NOT READY** | `pg_cron` not installed; 17 jobs registered but unscheduled |
| Secrets | **PARTIALLY READY** | `.env` correctly git-ignored; only public-safe values in client bundles; no `service_role` leak. **Production secrets not provisioned** (`PAYMENT_WEBHOOK_SECRET` especially — B1) |
| Environment variables | **READY** (pattern) | `.env.example` per portal; `env.ts` fails loudly on missing values |
| Domains / DNS / SSL | **NOT READY** | No hosting or DNS configuration exists in the repository |
| CORS | **PARTIALLY READY** | Supabase default; no explicit origin policy |
| Rate limiting | **NOT READY** | One RPC only (R6) |
| Sentry / error reporting | **NOT READY** | **No integration anywhere** — grep across all apps and packages returns nothing |
| Logging | **PARTIALLY READY** | `platform.audit_log` + `activity_log` are strong at the domain layer; no application/infrastructure log aggregation |
| Monitoring / alerting | **NOT READY** | `service_health_status` table exists and is read by Platform Admin, but nothing writes it — the health-check function that populates it depends on the absent cron |
| Backups / PITR | **NOT READY** | Free plan (B4) |
| Disaster recovery | **NOT READY** | No runbook, no tested restore |

**Summary: 5 READY · 6 PARTIALLY READY · 13 NOT READY.**

---

## 4. Security Status

**The security model is the strongest part of this system.** Findings are confined to configuration and one fail-open default — not to design.

| Control | Status | Notes |
|---|---|---|
| RLS coverage | ✅ **Strong** | 71/71 tables enabled *and* FORCED; 256 policies; internal tables carry zero policies so absence is a hard deny |
| `SECURITY DEFINER` hardening | ✅ **Strong** | 75 definer functions, **zero** missing `search_path` |
| Tenant isolation | ✅ **Strong** | Single denormalized `tenant_id` predicate; no join-based policies |
| Analytics fail-closed | ✅ **Verified** | Converted from fail-open in Epic 10 and confirmed live at three layers |
| Client-side authorization | ✅ **Clean** | Phase 9 verified zero duplicated tenant/role/owner filtering across six portals |
| Service-role isolation | ✅ **Clean** | No `service_role` reference in any frontend artifact; anon key only |
| JWT / claims | ✅ **Sound** | `app_metadata` server-set only; rotation enabled |
| MFA | ✅ **Enforced** | Mandatory for `platform_admin`, gated before any data route |
| XSS | ✅ **Clean** | No `dangerouslySetInnerHTML`, no `innerHTML` anywhere; React escaping throughout |
| SQL injection | ✅ **Not applicable** | All access via PostgREST/RPC with parameter binding; no string-built SQL |
| IDOR | ✅ **Mitigated** | RLS is the boundary; §13.4's pickup-pass two-layer control verified (passes never listed, reachable only by opaque token) |
| CSRF | ✅ **Low risk** | Bearer tokens in headers, not cookies |
| Client-forbidden surfaces | ✅ **Unreachable** | 6 forbidden RPCs and 3 forbidden Edge Functions: zero call sites |
| Driver PII minimisation | ✅ **Server-enforced** | `children_driver_safe()` gated view, not client redaction |
| **Payment webhook** | 🔴 **CRITICAL** | Fails open without a secret; public endpoint (B1) |
| Rate limiting | 🟠 **Gap** | Unimplemented outside one RPC (R6) |
| `app_access` enforcement | 🟠 **Gap** | Issued, never checked (R9) |

**One critical vulnerability (B1). Everything else in the security column is production-grade.**

---

## 5. Performance Status

Measurable risks only.

| Area | Assessment |
|---|---|
| Indexes | ✅ **142 indexes**, correctly shaped — composite `(tenant_id, occurred_at desc)` on log tables, partial `where read_at is null` on notification feeds, `(trip_id, recorded_at desc)` on GPS. This is careful work |
| Query patterns | ✅ RLS predicates are index-aligned single-column `tenant_id` matches |
| Materialized views | 🟠 3 MVs exist; **refresh never runs** (no cron). Figures are snapshots of unbounded age. Correctly disclosed in the UI via `computed_at`, which prevents a *correctness* incident but not a *usefulness* one |
| **P2 — GPS table growth** | 🔴 `run_gps_ping_retention_purge` exists with a 30-day default but **is not scheduled**. At §30's modelled ~500 rows/hour per active bus-leg, `transport.gps_pings` grows without bound. Index bloat and query degradation follow within months |
| Realtime | ✅ Reference-counted single socket per app; GPS render capped at 1/s independent of ping cadence |
| Camera streams | N/A — relay stubbed; no load path exists |
| Pagination | 🟠 Frontend adopts cursor semantics, but Epic 1–9 repositories use **offset pagination server-side** (`BACKEND_CERTIFICATION.md` §7.5). On high-write tables (notifications, GPS, activity log) offsets are unstable — rows can be skipped or repeated during paging |
| Frontend bundle | ✅ 160–166 KB gzipped per portal, inside the <200 KB mobile budget |
| Rendering | ✅ GPS throttled; list virtualisation absent but datasets are small at pilot scale |

---

## 6. Scalability Status

| Scale | Assessment |
|---|---|
| **1 school** | ✅ Architecturally comfortable. Schema, indexes and realtime are well within capacity |
| **10 schools** | ✅ Comfortable. Tenant isolation is a single indexed predicate; no cross-tenant fan-out |
| **100 schools** | 🟠 Workable **only with cron installed**. Unpurged GPS becomes the first constraint; concurrent AM/PM windows put GPS inserts in the low hundreds/second, which §30 models as within a single instance's capacity |
| **500 schools** | 🔴 Requires work the system does not have: GPS partitioning (deliberately deferred in §30 "until volume warrants"), realtime concurrency measured against the §30 ceiling (never measured), and offset→cursor pagination server-side |

**No architectural bottleneck blocks the first school.** The multi-tenant model is sound and scales on the right axis. The constraints at 100+ are operational (cron, retention) and deferred-by-design (partitioning), not structural.

---

## 7. Operational Readiness

| Capability | Status |
|---|---|
| School onboarding | 🔴 No UI; requires direct API/DB operation (B5) |
| Tenant provisioning | 🔴 `provision-tenant` exists, has no caller |
| Staff onboarding | 🔴 `add-staff` exists, has no caller; activation undeliverable |
| Activation | 🔴 Stubbed dispatch + disabled SMS (B3) |
| Password recovery | 🔴 Same two channels; email path blocked by redirect allow-list (B6) |
| Support workflow | 🟠 Ticket CRUD and tiers implemented and correct; no intake channel for a school to raise one |
| Backup restoration | 🔴 Free plan; never tested (B4) |
| Incident handling | 🔴 No runbook, no on-call, no alerting |
| Monitoring | 🔴 No Sentry; `service_health_status` has no writer |
| Audit logs | ✅ **Strong** — immutable `audit_log`, tenant-facing `activity_log`, both written server-side only; `write_audit_log` is client-forbidden so entries cannot be forged |
| Platform Admin bootstrap | 🔴 No provisioning path at all; first admin created manually |

---

## 8. Production Deployment Checklist

Only items still required. Ordered by dependency.

**Security — must precede any public exposure**
- [ ] Set `PAYMENT_WEBHOOK_SECRET` in production **and** change `verifyWebhookSignature` to fail *closed* when unset (B1)
- [ ] Move the project off the free plan; enable PITR and daily backups (B4)
- [ ] Perform and document one full restore test

**External providers — contracts and credentials**
- [ ] SMS/WhatsApp provider: contract, credentials, enable `[auth.sms.twilio]`, replace `notificationProviders.ts` stub
- [ ] Replace `activation.ts` stub with real Supabase link generation (Epic 4's stated owner)
- [ ] SMTP for transactional email
- [ ] PSP: contract, sandbox → production credentials, replace `paymentGateway.ts` stub
- [ ] Media relay: deploy or contract; replace `mediaRelay.ts` stub
- [ ] LLM: API key; replace `llmProvider.ts` stub — **or** disable AI reports for launch

**Infrastructure**
- [ ] Install `pg_cron`; register all 17 scheduled jobs; verify GPS purge and MV refresh actually run
- [ ] Provision DNS for all six portal origins; TLS certificates
- [ ] Add every portal origin to `additional_redirect_urls` (B6)
- [ ] Define explicit CORS origins
- [ ] Configure rate limiting on auth, OTP and AI endpoints
- [ ] Deploy CI/CD (none exists in the repository)

**Observability**
- [ ] Sentry (or equivalent) in all six portals and Edge Functions
- [ ] Log aggregation and retention
- [ ] Alerting on: webhook failures, payment state stalls, notification dispatch failures, job non-execution
- [ ] Populate `service_health_status` via the health-check function

**Data & verification**
- [ ] Seed one realistic tenant and exercise every flow end-to-end (B7)
- [ ] Implement `storage_objects` or formally accept no photos/PDFs at launch (R2)
- [ ] Build the provisioning UI or write an operator runbook for manual onboarding (B5)

---

## 9. First-School Checklist

Assuming deployment tomorrow for one real nursery. **Missing steps marked 🔴.**

| # | Step | Today |
|---|---|---|
| 1 | School signs contract | ✅ Commercial, outside the system |
| 2 | **Tenant created** | 🔴 `provision-tenant` has no UI. Engineer must invoke it directly |
| 3 | **Manager receives credentials** | 🔴 Activation stubbed. Password must be set manually in Supabase |
| 4 | **Staff invited** | 🔴 `add-staff` has no UI; activation undeliverable |
| 5 | **Parents activated** | 🔴 `enroll-child` has no UI; guardian activation undeliverable |
| 6 | **Students enrolled** | 🔴 No enrolment wizard; direct API only |
| 7 | Classrooms / buses configured | 🔴 `add-bus` has no UI |
| 8 | First attendance | ✅ **Works** — `mark_attendance`, natural upsert, once staff can log in |
| 9 | Attendance notification to parent | 🔴 Recorded as delivered; **never sent** |
| 10 | **First payment** | 🔴 No PSP. `redirectUrl: null`; Fawry code is random digits |
| 11 | First pickup | 🟠 Scan → validate → handover **works**; ID photo unavailable (R2) |
| 12 | Pickup notification to guardian | 🔴 Never sent |
| 13 | **First bus trip** | 🟠 Trip, manifest, boarding, GPS write **work**; tracking stops if the driver backgrounds the app (R4) |
| 14 | Parent watches the bus | 🟠 Live position works while the driver app is foregrounded |
| 15 | **First AI report** | 🟠 Draft generates from a template, not a model; manager review gate works; **delivery never happens** |
| 16 | Daily operation | 🟠 In-app flows work; every outbound message is silent |
| 17 | **Monthly billing** | 🔴 Ledger and invoices generate; reminders never fire (no cron); payment cannot be collected |

**Steps 2–7 all require an engineer.** Onboarding is not an operation the product can perform on itself.

**The critical missing operational step:** there is no path from "school signs" to "staff can log in" that does not involve manual database and Supabase Auth intervention for every individual account. For one pilot nursery of ~15 staff and ~80 families that is perhaps a day of careful manual work — but it is not a product, it is a migration, and every account created that way carries a manually-set password, which contradicts the no-plaintext-credential design (§10.3) the whole auth model is built on.

---

## 10. Production Verdict

# PRODUCTION BLOCKED

**Masar is not certified for deployment to its first real school.**

### Reasoning

Certification fails on four independent grounds, any one of which is disqualifying:

1. **A critical security vulnerability.** The payment webhook is a public, unauthenticated endpoint whose signature verification returns `true` when its secret is unset. Combined with `verify_jwt = false`, a missing environment variable silently exposes an endpoint that can mark arbitrary payments succeeded. Financial endpoints must fail closed.

2. **No external integration functions.** All five provider ports are stubs. The system cannot send a message, take a payment, stream a camera, deliver an activation link, or generate a genuine AI report. Worse than absence, the notification stub records `delivered: true` for messages it never sent, corrupting the delivery record staff would rely on in a dispute about a child.

3. **No user can log in.** Activation dispatch is stubbed and SMS is disabled — both credential-delivery channels are dead. Every provisioned account is unreachable. A platform nobody can sign into cannot serve a school.

4. **No production data protection.** The project is on the free plan: no PITR, no backup guarantee, no tested restore — for a system holding children's medical information, custody arrangements and guardian identities.

Supporting: no monitoring or error reporting of any kind, no CI/CD, no DNS or TLS, `pg_cron` absent so all 17 scheduled jobs including GPS retention never run, no provisioning UI, and **no flow in the system has ever executed against real data.**

### What this verdict is not

This is not a judgement on the engineering. The schema, RLS model, RPC discipline, type contract and portal implementations are of high quality and, in the security model specifically, better than most systems that do reach production. 71/71 tables RLS-forced with zero `search_path` gaps is genuinely rare.

Every blocker above is a **last-mile item**: vendor contracts, credentials, a plan upgrade, an infrastructure extension, and one fail-open default. The architecture anticipated all five stubs explicitly and isolated each to a single file precisely so this moment would be a configuration exercise rather than a rewrite. That was correct planning, and it means the path from here is short and known — but it has not been walked yet.

### Path to certification

**Minimum for CERTIFIED FOR PILOT** (one nursery, staff informed that notifications and payments are offline):

1. Fix the webhook to fail closed; set the secret.
2. Upgrade the plan; enable PITR; test one restore.
3. Wire SMS **or** email so accounts can be activated.
4. Install `pg_cron`.
5. Add Sentry.
6. Add portal origins to the redirect allow-list.
7. Seed one tenant and walk every flow end-to-end.

Items 1–7 are days of work, not months. With them done and payments/notifications explicitly out of scope for the pilot, a supervised single-school pilot becomes defensible.

**For CERTIFIED FOR PRODUCTION**, additionally: all five provider integrations live, the provisioning UI built, `storage_objects` implemented, monitoring and alerting operational, and a tested disaster-recovery runbook.

---

**Audit complete. No code was modified, and no fixes were implemented.**
