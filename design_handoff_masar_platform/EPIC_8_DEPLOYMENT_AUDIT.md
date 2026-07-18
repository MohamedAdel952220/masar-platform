# Epic 8 Deployment Audit

Scope: a **live** production-deployment audit of Epic 8 (AI Report Architecture) against the linked Supabase project (`masar-staging`, ref `oqvgkvyapjauepgozgjd`, region `eu-west-2`, status `ACTIVE_HEALTHY`). Unlike every prior Epic 8 document (`EPIC_8_COMPLETION_REPORT.md`, `EPIC_8_REVIEW.md`, `EPIC_8_FIX_REPORT.md`), all of which were explicitly static/unexecuted audits, this report is based on **direct, live introspection** of the deployed database and project via `supabase db query --linked`, `supabase migration list`, `supabase functions list`, `supabase secrets list`, and `supabase db advisors --linked`. No code was modified. Every query result is treated as untrusted data (per each query's own returned warning boundary) — none contained any instruction-like content, and none affected this report's conclusions beyond the literal metadata inspected.

**Verdict up front, expanded in §8: two deployment gaps block the AI Report Architecture from functioning end-to-end in this environment, despite the database layer being deployed correctly and completely, including every fix from `EPIC_8_FIX_REPORT.md`.**

---

## 1. Migrations

`supabase migration list` shows all 7 Epic 8 migrations applied, with `local` and `remote` versions matching exactly for every one, including migration 7 (the fix pass's `create_ai_report_batch`):

| Version | File | Applied |
|---|---|---|
| `20260727000001` | `epic8_reports_schema.sql` | ✅ |
| `20260727000002` | `epic8_tables.sql` | ✅ |
| `20260727000003` | `epic8_plan_catalog_ai_cap.sql` | ✅ |
| `20260727000004` | `epic8_rls_policies.sql` | ✅ |
| `20260727000005` | `epic8_rpc_functions.sql` | ✅ |
| `20260727000006` | `epic8_scheduled_jobs.sql` | ✅ |
| `20260727000007` | `epic8_fix_atomic_batch_rpc.sql` | ✅ |

Every Epic 1–7 migration (`20260714*` through `20260725*`) also shows `local == remote`, confirming no drift and no unauthorized modification of frozen migration history at the deployment layer, consistent with `EPIC_8_FIX_REPORT.md` §7's git-based (source-level) freeze verification.

---

## 2. Tables

All 3 tables exist with exactly the column set, types, nullability, and defaults specified in `BACKEND_ARCHITECTURE.md` §3.19/§3.20/§3.20.1 and the migration source, live-verified via `information_schema.columns`:

- `reports.ai_report_batches` — 8 columns, matches exactly.
- `reports.ai_report_drafts` — 13 columns, matches exactly, **including `edited_by`** (the `EPIC_8_REVIEW.md` M3 fix — confirmed present as a nullable `uuid` with no default, exactly as fixed).
- `reports.ai_usage_counters` — 4 columns, matches exactly.

No missing, extra, or mistyped column found.

---

## 3. Enums

All 4 enums exist with exact label sets and ordering, live-verified via `pg_enum`:

- `reports.report_type` — `monthly_progress, subject_report, behavior_social, attendance_summary`
- `reports.report_scope` — `classroom, children`
- `reports.report_draft_status` — `draft, ready, scheduled, sent`
- `reports.delivery_channel` — `app, whatsapp, email`

Matches `BACKEND_ARCHITECTURE.md` exactly.

---

## 4. Constraints

Live-verified via `pg_constraint`, all 6 CHECK constraints, the 1 UNIQUE constraint, and all 3 primary keys match the migration source exactly:

- `ai_report_batches_scope_classroom_id_check`, `ai_report_drafts_body_check`, `ai_report_drafts_scheduled_for_check`, `ai_report_drafts_sent_at_check`, `ai_usage_counters_calls_used_check` — all present with the exact expected predicate.
- `ai_usage_counters_tenant_date_key` — `UNIQUE (tenant_id, usage_date)` — present.

No missing or weakened constraint found.

---

## 5. Foreign keys

Live-verified via `pg_constraint`, all 7 foreign keys match the migration source exactly, including `ON DELETE` behavior:

| FK | Target | On delete |
|---|---|---|
| `ai_report_batches.tenant_id` | `tenancy.tenants` | RESTRICT |
| `ai_report_batches.classroom_id` | `academic.classrooms` | RESTRICT |
| `ai_report_batches.created_by` | `identity.staff_profiles` | RESTRICT |
| `ai_report_drafts.batch_id` | `reports.ai_report_batches` | CASCADE |
| `ai_report_drafts.tenant_id` | `tenancy.tenants` | RESTRICT |
| `ai_report_drafts.child_id` | `academic.children` | RESTRICT |
| `ai_report_drafts.edited_by` | `identity.staff_profiles` | RESTRICT |
| `ai_usage_counters.tenant_id` | `tenancy.tenants` | RESTRICT |

`ai_report_drafts.edited_by`'s FK (added alongside the M3 fix's column usage) is present and correctly points at `identity.staff_profiles` with `ON DELETE RESTRICT`, matching the same pattern every other staff-reference FK in this table uses.

---

## 6. Indexes

Live-verified via `pg_indexes`, all 9 non-PK indexes plus all 3 primary-key indexes are present and match the migration source exactly, including both partial indexes (`ai_report_drafts_sent_idx` on `status='sent'`, `ai_report_drafts_scheduled_idx` on `status='scheduled'`) with their exact `WHERE` predicates.

---

## 7. Triggers

Live-verified via `information_schema.triggers`, all 4 triggers are present:

| Trigger | Table | Fires | Function |
|---|---|---|---|
| `trg_ai_report_batches_consistency` | `ai_report_batches` | BEFORE INSERT/UPDATE | `reports.check_ai_report_batch_consistency()` |
| `trg_ai_report_drafts_consistency` | `ai_report_drafts` | BEFORE INSERT/UPDATE | `reports.check_ai_report_draft_consistency()` |
| `trg_ai_report_drafts_immutable_fields` | `ai_report_drafts` | BEFORE UPDATE | `reports.check_ai_report_draft_immutable_fields()` |
| `trg_ai_report_drafts_updated_at` | `ai_report_drafts` | BEFORE UPDATE | `set_updated_at()` |

**`trg_ai_report_drafts_immutable_fields` — the `EPIC_8_REVIEW.md` M1 fix — is confirmed live and deployed.** This directly verifies the fix pass reached production, not just the original implementation.

---

## 8. RLS policies

Live-verified via `pg_policies` and `pg_class.relrowsecurity`/`relforcerowsecurity`: all 3 tables have RLS both **enabled** and **forced**. All 7 policies are present and match `20260727000004_epic8_rls_policies.sql` exactly, `USING`/`WITH CHECK` clauses included verbatim:

- `ai_report_batches_select_manager`, `ai_report_batches_select_teacher`
- `ai_report_drafts_select_manager`, `ai_report_drafts_select_teacher`, `ai_report_drafts_select_guardian`, `ai_report_drafts_update_manager` (its narrowed `status IN ('draft','ready')` `WITH CHECK` confirmed live, unchanged from the original design — the M1 gap it doesn't cover is correctly closed by the trigger in §7 instead, exactly as `EPIC_8_FIX_REPORT.md` designed)
- `ai_usage_counters_select_manager`

No policy missing, no policy drift, no INSERT/DELETE policy present on `ai_report_batches`/`ai_report_drafts` (confirming the "Edge-Function/RPC-only write path" design is still intact live).

---

## 9. Helper functions and RPCs

Live-verified via `pg_proc`, `pg_get_function_identity_arguments`, and `proconfig`:

| Function | Schema | `SECURITY DEFINER` | `search_path=""` | Idempotency param |
|---|---|---|---|---|
| `check_ai_report_batch_consistency` | `reports` | No (plain trigger fn) | N/A | N/A |
| `check_ai_report_draft_consistency` | `reports` | No (plain trigger fn) | N/A | N/A |
| `check_ai_report_draft_immutable_fields` | `reports` | No (plain trigger fn) | N/A | N/A |
| `increment_ai_usage` | `reports` | ✅ | ✅ | N/A (by design) |
| `create_ai_report_batch` | `reports` | ✅ | ✅ | N/A (by design — see §14) |
| `sweep_scheduled_report_drafts` | `reports` | ✅ | ✅ | N/A (scheduled job) |
| `send_report_draft` | `public` | ✅ | ✅ | ✅ `p_idempotency_key` |
| `schedule_report_draft` | `public` | ✅ | ✅ | ✅ `p_idempotency_key` |
| `resend_report_draft` | `public` | ✅ | ✅ | ✅ `p_idempotency_key` |
| `delete_report_draft` | `public` | ✅ | ✅ | ✅ `p_idempotency_key`, **returns `jsonb`** (not `void`) |
| `export_report_draft` | `public` | ✅ | ✅ | ✅ `p_idempotency_key` |

**Every `EPIC_8_FIX_REPORT.md` H1/H2 SQL change is confirmed live**: all five lifecycle RPCs carry `p_idempotency_key`, `delete_report_draft`'s return type is `jsonb` as fixed, and `reports.create_ai_report_batch` exists with its exact 9-parameter signature from migration 7. No trigger function needs `search_path` hardening (none is `SECURITY DEFINER`, so none elevates privilege — the advisor noise in §12 confirms this is expected, not a regression).

---

## 10. AI usage counters

`reports.ai_usage_counters` — table, unique constraint, CHECK constraint, and index all confirmed live (§2/§4/§6). `reports.increment_ai_usage(p_tenant_id)` confirmed live with the exact atomic `INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING` cap-check-and-increment logic from the migration source, `service_role`-only granted (§11), matching `BACKEND_ARCHITECTURE.md` §3.20.1/§19's "single committed mechanism" requirement. `tenancy.plan_catalog.ai_daily_call_cap` confirmed live (§13) with all three seeded plans correctly defaulting to `50`.

---

## 11. Grants

Live-verified via `information_schema.routine_privileges`:

- `reports.create_ai_report_batch`, `reports.increment_ai_usage`, `reports.sweep_scheduled_report_drafts` — granted to `service_role` and `postgres` only. **Correct** — matches the migration source's explicit `revoke all ... from public; grant execute ... to service_role;` for each, and confirms `create_ai_report_batch` is **not** directly callable by an authenticated end user (the exact property `EPIC_8_FIX_REPORT.md`'s Test 23a was written to verify).
- `public.send_report_draft`, `schedule_report_draft`, `resend_report_draft`, `delete_report_draft`, `export_report_draft` — granted to `postgres`, `service_role`, `authenticated`, **and `anon`**. See §14 (Security Issues) — this is a live-deployment-only finding, invisible to every prior static review of this Epic.

---

## 12. Advisors (`supabase db advisors --linked`)

Ran both security and performance advisors. **Zero `ERROR`-level findings.** All Epic 8-related `WARN`-level findings fall into two categories, both of which are pre-existing, project-wide patterns already present on every other schema (Epic 1–7), not new Epic 8 regressions:

- `function_search_path_mutable` on the 3 plain (non-`SECURITY DEFINER`) trigger functions — the same advisory already fires on `public.set_updated_at` and every other Epic's plain trigger functions project-wide, since none of them elevate privilege and therefore don't need `search_path` hardening.
- `multiple permissive policies for role X for action SELECT` on `ai_report_batches`/`ai_report_drafts` (manager+teacher, and +guardian on drafts) — an expected consequence of this Epic's own deliberate "separate policy per role" design (matching every other Epic's identical multi-policy-per-table pattern), not a defect; Supabase's linter flags this purely as a query-planner performance note (each policy is planned as a separate OR'd predicate), not a security issue.
- The advisor's own `SECURITY DEFINER ... executed by the anon role` findings on all five lifecycle RPCs directly corroborate §14's manual grant finding below, from an independent (Supabase-maintained) source.

No `rls_disabled_in_public` finding for any Epic 8 table (confirms §8).

---

## 13. Seed compatibility

`supabase/seed.sql` inserts into `tenancy.plan_catalog` without specifying `ai_daily_call_cap`; live-verified all three seeded plans (`starter`, `growth`, `premium`) correctly received the column's default value of `50`. No seed-script failure, no compatibility issue. `scripts/seed-dev-data-epic2.mjs` contains no reference to the `reports` schema (expected — it predates this Epic and was never meant to seed AI report data). The live database currently holds **zero** rows in all three `reports` tables and **zero** tenants — a clean, unexercised staging deployment, not a partially-migrated one with stale data to reconcile.

---

## 14. Security issues

### 14.1 — All five lifecycle RPCs are `EXECUTE`-granted to `anon` (live-deployment-only finding)

**Not visible in any prior static review** (`EPIC_8_REVIEW.md`, `EPIC_8_FIX_REPORT.md`) because the migration *source* is correct — every one of the five RPCs does `revoke all on function ... from public; grant execute on function ... to authenticated;`, with no explicit grant to `anon` anywhere in the SQL. Live introspection shows `anon` has `EXECUTE` anyway, confirmed independently by `supabase db advisors`' own `SECURITY DEFINER ... executed by the anon role` findings for all five functions.

**Root cause**: this project's `public` schema has a platform-level default-privilege rule (a Supabase-standard `ALTER DEFAULT PRIVILEGES` grant for newly created functions, applied outside migration history) that grants `EXECUTE` to `anon`/`authenticated`/`service_role` on every new `public`-schema function, independent of and in addition to whatever the migration's own `REVOKE`/`GRANT` statements specify. This is confirmed to be **project-wide, not Epic-8-specific**: the identical `anon` grant is present on frozen Epic 5/6/7 `public`-schema RPCs (`review_request`, `generate_invoice`, `create_camera`, `submit_evaluation`), so this finding describes a pre-existing platform characteristic that Epic 8's own RPCs simply inherited, not a new regression this Epic introduced.

**Practical impact today**: live-tested (§ empirical check) — `set role anon; select public.current_role(), public.current_tenant_id(), auth.uid();` all return `NULL` for an `anon` caller with no JWT claims set. Tracing each RPC's own body: the role check (`if public.current_role() <> 'manager' then raise exception`) evaluates `NULL <> 'manager'` = `NULL`, and PL/pgSQL treats a `NULL` condition in `IF ... THEN` as false — so the explicit rejection is **silently skipped**. However, `v_tenant_id := public.current_tenant_id()` is also `NULL`, and every subsequent query filters `... and tenant_id = v_tenant_id`, which is `NULL` for every comparison — matching zero rows regardless of the supplied `p_draft_id`. The function therefore falls through to its own `NOT_FOUND` path. **No actual unauthorized read or write is currently reachable through this grant** — but this is accidental protection via NULL-propagation, not deliberate defense-in-depth, and is fragile: it depends on every future code path in these functions continuing to gate on a tenant-scoped `WHERE`, which is not an invariant enforced anywhere.

**Recommendation**: `revoke execute on function public.send_report_draft, public.schedule_report_draft, public.resend_report_draft, public.delete_report_draft, public.export_report_draft from anon;` (and audit whether the same should be applied project-wide to every other frozen Epic's `public`-schema RPC, and whether the project's default-privilege rule itself should be changed so this stops recurring for every future Epic's new RPCs). This is reported as a finding only, per this task's "do not modify any code" instruction.

### 14.2 — No other privilege-escalation, RLS-bypass, or tenant-isolation issue found live

Every other object's grants, RLS state, and policy definitions match the intended design exactly (§8, §9, §11). `reports.create_ai_report_batch` — the one function whose misuse would most directly reintroduce `EPIC_8_REVIEW.md` C1 — is correctly **not** exposed to `anon`/`authenticated`, confirmed live.

---

## 15. Missing items

### 15.1 — `ai-draft-report` and `ai-polish-note` Edge Functions are not deployed

`supabase functions list` returns 17 active Edge Functions spanning Epic 1 through Epic 7 (`provision-tenant`, `suspend-staff-account`, `reactivate-staff-account`, `revoke-sessions`, `regenerate-activation-link`, `initiate-payment`, `payment-webhook`, `generate-invoice-pdf`, `resend-invoice`, `add-bus`, `add-staff`, `camera-heartbeat`, `camera-stream-token`, `enroll-child`, `issue-service-account-key`, `notification-dispatch`, `revoke-service-account-key`). **`ai-draft-report` and `ai-polish-note` — Epic 8's own two Edge Functions, and the only entry points capable of actually calling the LLM provider — are absent.** `BACKEND_EXECUTION_PLAN.md` Epic 8 §7 ("Edge Functions Required") names exactly these two; neither is live.

**Consequence**: every RPC, trigger, table, and RLS policy backing the AI Report Architecture is deployed and internally correct, but there is currently **no way for any client to reach it** — a request to either function's URL returns a platform-level 404, not an application error. Note-polishing and report-drafting are both completely unavailable in this environment today.

### 15.2 — `"reports"` is missing from `config.toml`'s `[api] schemas` list

The live-tracked `supabase/config.toml` lists `schemas = ["public", "tenancy", "identity", "academic", "transport", "safety", "comms", "approvals", "billing", "media"]` — one entry per Epic 1–7 schema, added incrementally as each Epic shipped (`academic` for Epic 2, `transport`/`safety` for Epic 3, `comms` for Epic 4, `approvals` for Epic 5, `billing` for Epic 6, `media` for Epic 7). **`"reports"` was never added.**

**Consequence**: PostgREST only routes requests for schemas named in this list (via the `Accept-Profile`/`Content-Profile` headers the Supabase client sets when code calls `.schema('reports')`). Without `"reports"` in the exposed-schemas list, every one of the following becomes unreachable via the standard REST API, independent of and in addition to §15.1:
- `AiReportRepository`'s direct reads of `reports.ai_report_batches`/`ai_report_drafts`/`ai_usage_counters` (`listBatches`, `listDrafts`, `findDraftById`, `updateDraft`, `getTodayUsageCounter` — every one uses `.schema('reports')`).
- `ai-draft-report`'s and `ai-polish-note`'s own calls to `admin.schema('reports').rpc('increment_ai_usage', ...)` and `admin.schema('reports').rpc('create_ai_report_batch', ...)` — meaning **even once §15.1 is remediated and both functions are deployed, they would still fail** on their very first database call, until this is also fixed.

This gap could not have been caught by any prior static review — it is a property of the live PostgREST configuration, not of the SQL/TypeScript source, and `EPIC_8_COMPLETION_REPORT.md`'s own claim ("No changes were needed to `supabase/config.toml`") is the specific point where this was missed; see §17.

**Verification method and its limit**: confirmed against the tracked `config.toml` (the source of truth `supabase config push` would apply) and the well-established fact that `supabase db push` — used to apply the 7 migrations in §1 — does not itself synchronize `[api]` settings to the live project (that requires the separate `config push` command, or a manual Dashboard change). This report was not able to directly query the live PostgREST exposed-schemas setting through any available read-only tool (no `psql`, no Management-API-backed CLI subcommand for this specific setting was found); the finding is reported at high confidence based on the tracked config file and standard Supabase deployment mechanics, not a first-hand live API response, and that distinction is stated here explicitly.

### 15.3 — No other missing item found

Every table, enum, constraint, foreign key, index, trigger, RLS policy, and RPC named in `BACKEND_ARCHITECTURE.md`, `BACKEND_EXECUTION_PLAN.md`, and `EPIC_8_FIX_REPORT.md` is present and correctly configured in the live database (§2–§11).

---

## 16. AI workflow verification

- **Provider boundary** (§19: "all LLM calls happen inside Edge Functions only"): correctly designed in source, but **currently unreachable** (§15.1) — cannot be live-verified end-to-end in this environment.
- **Usage cap enforcement**: `reports.increment_ai_usage` is live, atomic, and `service_role`-only (§10/§11) — correct and ready, but nothing currently calls it in production (§15.1).
- **Human-in-the-loop guarantee** (§19: "no AI-drafted report ever reaches `sent` without an explicit staff action"): the DB-layer enforcement of this guarantee is fully live and correct — `ai_report_drafts_update_manager`'s narrowed `WITH CHECK` (draft/ready only, §8), `send_report_draft`/`schedule_report_draft` as the sole paths to `sent`/`scheduled` (§9), and `ai_report_drafts_select_guardian`'s `status='sent'`-only visibility (§8) are all confirmed live exactly as designed. **This guarantee holds for any draft that reaches the database** — the gap is entirely upstream of it (no draft can currently be created at all, per §15.1/§15.2), not a weakening of the guarantee itself.
- **Scheduled dispatch** (§27): `reports.sweep_scheduled_report_drafts()` is live, correct, and callable on-demand; no `pg_cron` schedule entry exists (`pg_cron` extension itself is not installed on this project), matching the identical, already-documented limitation from every prior Epic's own scheduled-job function. Not a new gap.
- **Cost/rate control**: correctly implemented and ready (§10), not currently exercised (§15.1).

**Overall**: the AI workflow's *safety* properties (usage cap, human-in-the-loop, audit logging via `create_ai_report_batch`'s `write_audit_log` call) are all live and correct. Its *availability* is zero in this environment until §15.1 and §15.2 are both resolved.

---

## 17. Documentation inconsistencies

- **`EPIC_8_COMPLETION_REPORT.md` §2.4**: *"No changes were needed to `supabase/config.toml` or `_shared/cors.ts` — neither AI Edge Function needs a `verify_jwt = false` override... or a new custom request header."* This statement is **incomplete**: it correctly ruled out a `verify_jwt` override and a new CORS header, but never considered whether the new `reports` schema itself needed adding to `[api] schemas` — the actual gap found in §15.2. The `cors.ts` half of the claim is confirmed correct (§ CORS check: `x-idempotency-key` is already present, added in Epic 6).
- **`EPIC_8_FIX_REPORT.md` §9 (Verification summary)**: correctly scoped every claim to static verification ("not executed against a live database") and did not claim Edge Function deployment status one way or the other — no inconsistency there; this audit is simply the first document in the Epic 8 series to check that dimension at all.
- No other inconsistency found between the live deployment and any claim in `BACKEND_ARCHITECTURE.md`, `BACKEND_EXECUTION_PLAN.md`, or `EPIC_8_FIX_REPORT.md`.

---

## 18. Architecture deviations

- **§15.1/§15.2 together constitute a deviation from `BACKEND_EXECUTION_PLAN.md` Epic 8 §7's "Edge Functions Required: ai_polish_note, ai_draft_report"** — named as required, not yet live.
- No schema-, RLS-, RPC-, trigger-, or constraint-level deviation from `BACKEND_ARCHITECTURE.md` was found (§2–§10 above all confirm exact conformance).
- The `anon`-grant characteristic (§14.1) is a deviation from the *intent* of §14.3/§25.1's access-control model (only the caller's own authenticated identity should ever reach a manager-only RPC) but is, per §14.1's own root-cause analysis, a platform-level default rather than an Epic 8-specific architectural choice.

---

## Final verdict

The Epic 8 **database layer** — every migration, table, enum, constraint, foreign key, index, trigger, RLS policy, and RPC, including every fix from `EPIC_8_FIX_REPORT.md` (the M1 immutability trigger, all five RPCs' idempotency envelopes, `delete_report_draft`'s `jsonb` return, and `create_ai_report_batch`'s atomicity/grant/audit-log behavior) — is deployed correctly, completely, and with zero drift from source. Seed data is compatible. No frozen Epic 1–7 object shows any deployment-layer modification.

However, the AI Report Architecture is **not currently usable end-to-end** in this environment: neither of its two Edge Functions is deployed (§15.1), and even once deployed, they would fail immediately on their first database call because the `reports` schema is not exposed via the API configuration (§15.2). A secondary, lower-severity, live-deployment-only security finding (§14.1) was also identified and is recommended for remediation alongside a project-wide review of the same pattern on every other Epic's `public`-schema RPCs.

This is not a defect in Epic 8's design or code — every finding in this report is a **deployment-configuration gap**, not a schema, RLS, RPC, or application-logic defect. But it means the feature is not yet functional for any real user in this project, and Epic 9 work should not proceed on the assumption that Epic 8 is live and callable.

**NOT READY FOR EPIC 9** — remediate §15.1 (deploy both Edge Functions), §15.2 (add `"reports"` to `config.toml`'s `[api] schemas` and push the config), and review §14.1 (the `anon` grant), then re-audit.
