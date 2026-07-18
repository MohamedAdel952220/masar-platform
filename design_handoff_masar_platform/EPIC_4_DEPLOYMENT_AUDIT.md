# Epic 4 Deployment Audit

Production audit of Epic 4 (`Communication & Notification Backbone`) against the live, linked Supabase project (`oqvgkvyapjauepgozgjd`), performed **directly against the deployed database and project** via `supabase db query --linked`, `supabase migration list --linked`, and `supabase functions list` — not a static re-read of migration files. Every claim below reflects what is actually running in production at audit time, cross-checked against `BACKEND_ARCHITECTURE.md` and `BACKEND_EXECUTION_PLAN.md`. No code was modified during this audit.

**Verdict up front:** the database layer (schema, RLS, RPCs, constraints, storage, realtime) is deployed correctly and matches `EPIC_4_FIX_REPORT.md` exactly, field for field. However, **the runtime delivery pipeline is incomplete**: the `notification-dispatch` Edge Function that Epic 4's entire business goal depends on is not deployed, and no scheduler/webhook exists to invoke it even if it were. This is a **deployment issue**, not a schema or code defect — see §2. Full verdict in §7.

---

## 1. Missing items

| Item | Expected (per docs) | Found in production |
|---|---|---|
| `notification-dispatch` Edge Function | `BACKEND_EXECUTION_PLAN.md` Epic 4 §7: "the central fan-out function every other Epic's events route through" | **Not deployed.** `supabase functions list` returns only 5 active functions, all from Epic 1 (`provision-tenant`, `suspend-staff-account`, `reactivate-staff-account`, `revoke-sessions`, `regenerate-activation-link`). The function exists locally at `backend/supabase/functions/notification-dispatch/` but has never been pushed to the linked project. |
| A trigger mechanism for `notification-dispatch` | `BACKEND_ARCHITECTURE.md` §26: polled by a scheduled Edge Function every ~10-30s, or invoked via a database webhook on `jobs.background_job_queue` insert | **Neither exists.** `pg_cron` extension is available but not installed (`installed_version: null`); no rows in `information_schema.triggers` reference `net.http_post`/`supabase_functions`; `net.http_request_queue` is empty. There is no automated path from "a job is queued" to "the job is processed," even in principle. |
| `add-bus`, `add-staff`, `enroll-child` Edge Functions | Required by Epic 2/3 (not Epic 4's own contract, but relevant context: `platform.notify_on_provisioning_event` — Epic 4's own retroactive-activation trigger — fires off `platform.audit_log` rows these functions are supposed to write) | **Not deployed either**, alongside `notification-dispatch`. Noted for completeness since it means the "retroactive activation of Epics 1/3" acceptance criterion (§19 of Epic 4's plan) currently has no live producer of the audit_log rows it listens for, beyond what Epic 1's 5 already-deployed functions write. |
| `jobs.scheduled_job_runs`, `pg_cron` jobs | `BACKEND_ARCHITECTURE.md` §3.53.2, §27 | **Correctly absent** — not an Epic 4 gap. Epic 4's own execution-plan entry explicitly states "Scheduled Jobs Involved: None new," and Epic 1's schema migration explicitly defers `scheduled_job_runs` to "later Epics." Flagged here only to distinguish it from the two genuine gaps above — it is in-scope for a future epic, not this one. |

No missing tables, columns, enums, constraints, foreign keys, indexes, RLS policies, helper functions, or RPCs were found — every database-layer object specified in `EPIC_4_FIX_REPORT.md` and cross-referenced against `BACKEND_ARCHITECTURE.md` §3.44-3.53.4 is present and correct in the live database (full verification detail in §4-§6).

---

## 2. Deployment issues

- **Critical — the notification pipeline cannot deliver anything in production right now.** The chain is: an event happens → an RPC/trigger inserts a `comms.notifications` row → `trg_notifications_enqueue_dispatch` (confirmed live, fires correctly) inserts a `jobs.background_job_queue` row with `job_type = 'notification_dispatch'` → **nothing ever reads that row**, because `notification-dispatch` isn't deployed and nothing is configured to invoke it. Jobs will accumulate in `status = 'queued'` indefinitely. This directly contradicts Epic 4's own Definition of Done ("dispatch job failure/retry behavior verified against a simulated provider outage") and Acceptance Criteria ("Every event type in the Notification Matrix produces a correctly-routed notifications row and, where the recipient hasn't opted out, a delivered push/WhatsApp/SMS/email") — the first half (the `notifications` row) works; the second half (actual delivery) cannot happen at all yet.
- **`platform.drain_notification_outbox()` (Epic 4's own fix-forward for Epic 3's stubbed notifications) is similarly stranded.** It's only ever called from inside `notification-dispatch/index.ts` (confirmed by reading the deployed function's source locally, since it isn't live) — so Epic 3's retroactively-activated trip/handover notifications are equally undelivered until the Edge Function is deployed and invoked.
- At present this has no visible symptom, because `jobs.background_job_queue` currently holds 0 rows and `platform.notification_outbox` currently holds 0 undispatched rows (checked live) — there is no seed/test data flowing through the system yet. The gap will become visible the moment any real notification-triggering action occurs (a message sent, an announcement broadcast, a trip status updated).
- **This is a deployment/operations gap, not a code defect.** Every line of `notification-dispatch/index.ts` that was reviewed and fixed in `EPIC_4_FIX_REPORT.md` (the C2 atomic-claim RPC call, the M2/M3/M4 fixes) is correct as written — it simply has never been `supabase functions deploy`'d, and no cron/webhook has been provisioned to call it. Both are remediable without any further code change.
- Migration deployment itself is clean: all 8 Epic 4 migrations (`20260719000001` through `20260719000008`) show `local` and `remote` timestamps in exact agreement per `supabase migration list --linked` — no drift, no partial application, no manual out-of-band changes detected.

---

## 3. Security issues

No new security issues were found in the deployed database layer — every fix from `EPIC_4_FIX_REPORT.md` was independently re-verified live and matches exactly (see §5-§6 for the policy-by-policy and function-by-function comparison). Two pre-existing, project-wide (not Epic-4-introduced) observations surfaced during this audit, included here for completeness:

- **All RPCs, including Epic 4's (`send_message`, `broadcast_announcement`, `escalate_conversation`, `register_device_token`, `update_notification_preferences`), have `EXECUTE` granted to the `anon` role**, in addition to `authenticated`. This is Postgres/PostgREST's default behavior for functions created in the `public` schema (grants cascade from `PUBLIC` unless explicitly revoked) and was confirmed to be identical for every Epic 1-3 RPC checked for comparison (`withdraw_child`, `mark_attendance`, `scan_pickup_pass`) — it is not something Epic 4 introduced or regressed. Functionally it is a non-issue: every RPC body calls `current_role()`/`auth.uid()` as its first authorization step, both of which are null for an unauthenticated `anon` caller, so the call fails with `PERM_ROLE_DENIED` (or an unhandled null-comparison exception) rather than executing. Recorded here as a hardening opportunity (an explicit `revoke execute ... from anon` per RPC would be defense-in-depth), not a live vulnerability.
- `jobs.claim_background_jobs` — the one function this task's own C2 fix added — correctly has **no** grant to `anon`/`authenticated`, only `service_role` (confirmed live via `information_schema.routine_privileges`). This is the correct pattern; it's called out only to contrast against the point above.

No cross-tenant data leakage, RLS bypass, or privilege-escalation path was found in the live comms/jobs schema. `FORCE ROW LEVEL SECURITY` is active on all 10 comms/jobs tables (verified via `pg_class.relforcerowsecurity`), and `comms.notification_deliveries`, `jobs.background_job_queue`, `jobs.idempotency_keys` correctly have **zero** policies — RLS's default-deny means these are entirely inaccessible outside `service_role`, matching their intended "internal queue table" role.

---

## 4. Architecture deviations

None found. Specifically checked and confirmed matching `BACKEND_ARCHITECTURE.md`:

- **§3.44-3.53.4 table shapes** — every column, type, nullability, and default on `comms.conversations`, `comms.messages`, `comms.announcements`, `comms.announcement_recipients`, `comms.notifications`, `comms.notification_deliveries`, `comms.device_tokens`, `comms.notification_preferences`, `jobs.background_job_queue`, `jobs.idempotency_keys` matches the doc's field lists exactly, including the two unique constraints described in prose (`device_tokens` unique on `(recipient_type, recipient_id, token)`, `notification_preferences` unique on `(recipient_type, recipient_id, category, channel)`) — both implemented as unique indexes in the live database, not table constraints, which is a legitimate equivalent, not a deviation.
- **§13.1 RLS baseline pattern** — every policy checked is a flat equality/role check, no subqueries beyond the documented "join-through-parent" exception pattern already established for link-shaped tables; `tenant_id` is never client-writable (every `INSERT` `WITH CHECK` pins it to `current_tenant_id()`).
- **§13.6 Platform Admin bypass scope** — `announcements` platform-scoped-only policies confirmed; no platform_admin policy exists on `conversations`/`messages`/`device_tokens`/`notification_preferences` (absence-as-deny, correct).
- **§14.2 contract catalog** — all 5 Epic 4 RPCs (`send_message`, `escalate_conversation`, `broadcast_announcement`, `register_device_token`, `update_notification_preferences`) exist live with the documented role restrictions.
- **§14.3 idempotency convention** — `send_message`/`broadcast_announcement` correctly route through `jobs.idempotency_keys` via the frozen Epic 1 `idempotency_replay`/`idempotency_store` helpers, with the Epic 4 fix's payload-hash envelope layered on top exactly as documented in the fix report.
- **§15 Realtime Event Matrix** — `comms.messages` and `comms.notifications` are both present in the live `supabase_realtime` publication; no other comms table is (correct — `conversations`/`announcements`/`device_tokens`/`notification_preferences` were never specified as realtime-subscribed).
- **§21 Storage Architecture** — `chat-attachments` bucket exists, private, with participant-scoped read/write policies; the C1 fix (removal of the `is_platform_admin()` bypass) is live.
- **§25.6 idempotency contract** — `CONFLICT_IDEMPOTENCY_KEY_REUSED` on payload mismatch confirmed live in both RPC bodies.
- **§26 Background Jobs table** — `jobs.background_job_queue` schema matches; the "Notification dispatch" row's *trigger* condition ("Any INSERT into notifications") is correctly implemented as `trg_notifications_enqueue_dispatch`. The row's *work* half (call provider APIs, update delivery status) is where the deployment gap in §2 lives — the schema/trigger side of this architecture entry is fully deployed, only the Edge Function execution side is missing.

---

## 5. Documentation inconsistencies

None found. `EPIC_4_FIX_REPORT.md`'s claims were independently re-verified against the live database rather than trusted, and every specific claim checked (RLS policy text, RPC body content, function grants, constraint definitions, index definitions) matches what the report describes, including down to the exact SQL fragments (e.g. `current_account_is_active()` applied to exactly the 9 policies the report lists; `messages_update_guardian`/`messages_update_staff` both carry `sender_id IS DISTINCT FROM auth.uid()` in `USING`; `jobs.claim_background_jobs` matches the report's `FOR UPDATE SKIP LOCKED` pattern verbatim). No gap was found between what the fix report claims was done and what is actually running.

One clarification worth recording (not an inconsistency, a scope note): `BACKEND_ARCHITECTURE.md` §26 describes background-job polling as implemented via *either* a scheduled Edge Function *or* database webhooks — the current deployment has configured **neither** mechanism, which is why §2's gap exists. The architecture doc itself doesn't mandate which one Epic 4 must use, so closing this gap is an operational choice (provision a `pg_cron` schedule + `net.http_post` webhook, or deploy `notification-dispatch` and schedule it directly), not a documentation fix.

---

## 6. Verification detail (what was checked, live)

- **Migrations**: `supabase migration list --linked` — all 8 Epic 4 migrations (`20260719000001`-`20260719000008`) show local/remote timestamps in agreement; no drift.
- **Tables**: `information_schema.columns` for `comms`/`jobs` schemas — 10 tables, all columns/types/defaults/nullability cross-checked against `BACKEND_ARCHITECTURE.md` §3.44-3.53.4.
- **Enums**: `pg_type`/`pg_enum` — 13 enum types, all values cross-checked against the doc's inline `enum(...)` lists; exact match on every one (`announcement_audience`, `announcement_channel`, `announcement_priority`, `announcement_recipient_type`, `conversation_status`, `device_platform`, `message_sender_type`, `notification_channel`, `notification_delivery_status`, `notification_recipient_type`, `notification_severity`, `platform_announcement_audience`, `background_job_status`).
- **Constraints**: `pg_constraint` — all `CHECK`/`PRIMARY KEY`/`FOREIGN KEY` constraints on all 10 tables read via `pg_get_constraintdef`; the H1-fix's `announcements_classroom_audience_requires_classroom` constraint confirmed live alongside the pre-existing `announcements_classroom_requires_classroom_audience`.
- **Foreign keys**: included in the constraint dump above — every FK's target table and `ON DELETE` behavior matches the migration files (e.g. `conversations_child_id_fkey → academic.children ON DELETE RESTRICT`, `messages_conversation_id_fkey → comms.conversations ON DELETE CASCADE`).
- **Indexes**: `pg_indexes` — all indexes present, including the two unique-constraint-equivalent indexes (`device_tokens_recipient_token_key`, `notification_preferences_key`) and the C2 fix's supporting `background_job_queue_poll_idx` partial index.
- **RLS policies**: `pg_policies` for `comms`/`jobs` (28 policies) plus `storage.objects` chat-attachments policies (2) — full `USING`/`WITH CHECK` text read and compared clause-by-clause against `EPIC_4_FIX_REPORT.md`'s described fixes (C1, H2, L2, M1 all confirmed live verbatim). `pg_class.relforcerowsecurity` confirmed `true` on all 10 tables.
- **Helper functions**: `current_account_is_active()`, `current_notification_recipient_type()` — full body pulled via `pg_get_functiondef` and compared line-for-line against the fix report; both `SECURITY DEFINER` with `search_path = ''`, correctly.
- **RPCs**: `send_message`, `broadcast_announcement`, `escalate_conversation` — full bodies pulled and read end-to-end; H1/H3/H4/L3 fixes all present and correct; L1 (`escalate_conversation`'s per-manager loop) confirmed still present as the fix report's own documented, deliberate non-fix.
- **Edge Functions**: `supabase functions list` — only 5 active (all Epic 1); `notification-dispatch` absent (§1-§2).
- **Storage**: `storage.buckets` (6 buckets, correct public/private split) and `storage.objects` chat-attachments policies (C1 fix confirmed live — no `is_platform_admin()` bypass).
- **Realtime**: `pg_publication_tables` for `supabase_realtime` — `comms.messages`, `comms.notifications` present; no unexpected comms tables present.
- **Seed compatibility**: `backend/scripts/seed-dev-data.mjs` and `seed-dev-data-epic2.mjs` read in full — neither touches `comms`/`jobs` schemas, so no Epic 4 seed data exists yet (expected — no Epic 4 seed script was part of this task's scope). The one new trigger Epic 4 adds to an *existing* Epic 1 table (`trg_audit_log_notify_provisioning` on `platform.audit_log`) wraps its body in `exception when others then raise warning` — confirmed live — so it cannot break any existing or future seed script's `audit_log` inserts even on an unexpected `action`/`target_type` value.
- **Extensions**: `pg_extension`/`pg_available_extensions` — `pg_net` installed (used by `platform.drain_notification_outbox`'s design intent and general webhook capability), `pg_cron` available but not installed.

---

## 7. Final verdict

**Database layer: correct and complete.** Every table, enum, constraint, foreign key, index, RLS policy, helper function, and RPC specified for Epic 4 — including all 12 fixes from `EPIC_4_FIX_REPORT.md` (C1, C2, H1-H4, M1-M4, L2-L3) — is deployed to production exactly as documented, with zero drift between the migration files, the fix report's claims, and the live database. No architecture deviation, no documentation inconsistency, and no new security issue was found at the database layer.

**Runtime layer: incomplete.** The `notification-dispatch` Edge Function — the single piece of infrastructure Epic 4's entire business goal ("turn every 'something happened' event into an actual message a human receives") depends on — is not deployed, and no scheduler or webhook exists to invoke it even once deployed. This means Epic 4 currently produces `notifications` rows (the in-app feed half) correctly, but delivers zero push/WhatsApp/SMS/email messages and never drains Epic 3's retroactively-activated notification backlog. This is an operational deployment gap, not a code or schema defect — the fix is `supabase functions deploy notification-dispatch` plus provisioning either a `pg_cron` schedule or a database webhook, no code changes required.

Because a required Edge Function from Epic 4's own contract (`BACKEND_EXECUTION_PLAN.md` §7) is missing from production, this audit **cannot** issue a clean pass.

**NOT READY FOR EPIC 5** — remediate §1/§2 (deploy `notification-dispatch`, provision its invocation mechanism, confirm at least one end-to-end delivery in the provider sandbox) and re-run this audit before proceeding.
