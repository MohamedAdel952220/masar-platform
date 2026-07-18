# Epic 9 Review — Platform Operations & Admin Console

Scope: a production-grade architecture and security review of Epic 9 only (the `platform`/`jobs` schema additions, the 6 new migrations, the TypeScript application layer, and the test suites). Reviewed against `BACKEND_ARCHITECTURE.md`, `BACKEND_EXECUTION_PLAN.md`, the established, frozen conventions of Epics 1-8, and the infrastructure-hardening migration. No code was modified in the production of this document — this is analysis and static tracing only.

Method: every RLS policy, trigger, RPC, and scheduled-job function was traced by hand against every role/path that can invoke it, cross-checked against the exact frozen precedent each Epic 9 file's own comments claim to mirror (e.g. `billing.refund_payment`, Epic 6; `reports.sweep_scheduled_report_drafts`, Epic 8) to verify the mirroring was actually faithful, not just claimed. Several findings below are exactly this: a place where Epic 9's own header comment cites a correct, safe precedent but the implementation diverges from it in a way that reintroduces the defect class that precedent exists to prevent.

---

## Findings

### C1 — `platform.write_activity_log` is directly callable by any authenticated user with fully attacker-controlled parameters, allowing forged activity-log entries for any tenant

**Severity**: Critical

**Location**: `backend/supabase/migrations/20260729000004_epic9_rpc_functions.sql:24-52`

**Root cause**: `platform.write_activity_log(p_tenant_id, p_actor_type, p_actor_id, p_action, p_target_type, p_target_id, p_metadata)` is `SECURITY DEFINER` and performs a bare `INSERT INTO platform.activity_log` using every parameter exactly as supplied — no check that `p_tenant_id` matches the caller's own tenant, no check that `p_actor_id` is the caller's own id, no role check at all. It is granted `execute` to `authenticated` (line 52), mirroring `public.write_audit_log`'s own grant shape (Epic 1) — but `write_audit_log` is a poor precedent to mirror here, because the correct precedent for an *internal-only* write primitive meant to be called exclusively from within other `SECURITY DEFINER` functions is `comms.enqueue_notification` (Epic 4), which is granted to `service_role` only, precisely because nothing external ever needs to call it directly. This function's own header comment even states the intended usage ("Only this Epic's own three new mutating RPCs below call it") — but the grant does not enforce that intention at all.

**Risk**: Any authenticated user — a teacher, guardian, or driver from Tenant A, or a manager from a completely different tenant — can call `POST /rest/v1/rpc/write_activity_log` directly with an arbitrary `p_tenant_id` and forge a fake `activity_log` entry that will appear in **Tenant B's own manager-facing "recent activity" feed** (§3.50, §24), with an arbitrary `action`/`target_type`/`metadata` and an `actor_id` the caller can set to any UUID they choose (including impersonating a specific real staff member). This is a direct tenant-isolation and content-integrity bypass, reachable by the lowest-privileged authenticated role in the system, requiring no exploit beyond a single REST call the API layer is already configured to accept.

**Architecture reference**: `BACKEND_ARCHITECTURE.md` §24 ("written by the same RPCs that perform the underlying action — never a generic table-level trigger... **or direct client access**" is the clear implication of the "curated feed" framing); §14.3's own "every Edge Function/RPC re-verifies the caller" convention that `comms.enqueue_notification`'s `service_role`-only grant already exemplifies in this exact codebase.

**Recommended fix**: `revoke execute on function platform.write_activity_log from authenticated;` — grant `service_role` only, matching `comms.enqueue_notification`'s own precedent exactly. This is a pure grant change; no calling code needs to change, since every current caller (`create_support_ticket`) is itself `SECURITY DEFINER` and already executes with the privileges needed to call a `service_role`-only function internally (the same mechanism that already lets every RPC in this codebase call `write_audit_log`/`enqueue_notification` without issue).

---

### H1 — `refund_tenant_billing_transaction` has no atomic status guard, permitting a double refund under concurrent or duplicate calls

**Severity**: High

**Location**: `backend/supabase/migrations/20260729000004_epic9_rpc_functions.sql:372-395`

**Root cause**: The function reads `v_original` via a plain `SELECT ... WHERE id = p_original_transaction_id` (line 372), checks `v_original.status <> 'succeeded'` in application logic (line 379), and only then performs `update platform.tenant_billing_transactions set status = 'refunded' where id = p_original_transaction_id;` (line 391) — with **no `AND status = 'succeeded'` guard on the `UPDATE`'s own `WHERE` clause**, and no check afterward that the `UPDATE` actually changed a row consistent with the pre-read state. This is exactly the class of read-then-write race the codebase's own M1 pattern (`UPDATE ... WHERE <status-guard> RETURNING *`, used by `send_report_draft`/`schedule_report_draft`, Epic 8) exists to close — and this function's own header comment claims to mirror `billing.refund_payment` (Epic 6), which *does* use this pattern correctly (it delegates to `billing.settle_payment_transaction`, whose own `WHERE status = 'succeeded'` guard is what produces the "This payment has already been settled" `STATE_ALREADY_PROCESSED` check at line 629-633 of that file) — the mirroring was not actually carried through into this implementation.

**Risk**: Two concurrent `refund_tenant_billing_transaction` calls against the same `succeeded` transaction (a genuine possibility: two Platform Admins acting on the same overdue-tenant ticket, or a client retry with no/a fresh idempotency key) both pass the `status <> 'succeeded'` check before either commits, both execute the unguarded `UPDATE` (the second, once unblocked by the first's row lock, still matches `WHERE id = ...` since there is no status predicate to invalidate it), and **both insert an independent `kind='refund'` row** — recording two refunds against Masar's own ledger for a single original transaction. This is a financial-integrity defect, not merely a UX one.

**Architecture reference**: `BACKEND_ARCHITECTURE.md` §20's own ledger-atomicity framing ("partial ledger updates on payment success are a correctness bug class to explicitly guard against"), applied here to the tenant-side ledger; the M1 pattern itself (first codified in Epic 8's own fix pass, `EPIC_8_FIX_REPORT.md` H1/H2's atomic-guard discussion).

**Recommended fix**: `update platform.tenant_billing_transactions set status = 'refunded' where id = p_original_transaction_id and status = 'succeeded' returning * into v_row2;` (a distinct variable from the eventual refund-row `v_row`), then check `if v_row2.id is null then raise STATE_ALREADY_PROCESSED end if;` before inserting the new refund row — mirroring `billing.settle_payment_transaction`'s own actual guard, not just its cited name.

---

### H2 — `update_support_ticket` has the same unguarded read-then-write race, permitting a lost update and a duplicate notification under concurrent calls

**Severity**: High

**Location**: `backend/supabase/migrations/20260729000004_epic9_rpc_functions.sql:184-223`

**Root cause**: `v_current` is read via a plain `SELECT` (line 184); `v_new_status`/`v_new_resolved_at` are computed from it in PL/pgSQL variables (lines 200-205); the eventual `UPDATE ... WHERE id = p_ticket_id` (lines 207-212) carries no guard tying it back to the state `v_current` was read from (e.g. `AND status = v_current.status`), and the notification decision (`if p_status is not null and p_status <> v_current.status`, line 217) is likewise made against the stale, pre-lock snapshot.

**Risk**: Two concurrent `update_support_ticket` calls on the same ticket (e.g., Admin A sets `status='in_progress'` while Admin B, working from the same stale `open` snapshot, sets `status='resolved'`) resolve via ordinary last-writer-wins row locking: whichever `UPDATE` commits second silently overwrites the first's change with no conflict signal to either caller, and **both** calls independently evaluate their own (both-true, since both saw `status='open'`) "did status change" condition and **each fires its own notification** to the reporting manager — a real duplicate-notification / silently-lost-update pair, the same defect class as H1, in the other new stateful RPC this Epic introduces.

**Architecture reference**: Same M1-pattern precedent as H1; `BACKEND_ARCHITECTURE.md` §16's own notification-matrix framing implicitly assumes one notification per actual state transition, not per call.

**Recommended fix**: Fold the `UPDATE` into an atomic guarded form keyed on the row's own current values at write time (e.g. `UPDATE ... WHERE id = p_ticket_id RETURNING *`, then compare `v_row`'s pre-image via a second guard column, or — more simply — accept that `support_tickets` has no meaningful "already processed" terminal state the way `ai_report_drafts`/`payment_transactions` do, and instead derive the notification decision and `resolved_at` stamping from `v_row` (the actual post-`UPDATE` state) rather than from the pre-`UPDATE` `v_current` snapshot, closing the staleness window even without a full M1-style guard.

---

### M1 — `update_support_ticket`'s reporting-manager notification does not filter `deleted_at is null` on the recipient

**Severity**: Medium

**Location**: `backend/supabase/migrations/20260729000004_epic9_rpc_functions.sql:216-223`

**Root cause**: The notification is fired directly at `v_current.reported_by` with no check that the corresponding `identity.staff_profiles` row is still `deleted_at is null`. Every other notification fan-out introduced in this same Epic (`run_tenant_billing_check`, `run_trial_expiry_sweep` — `identity.platform_admins where deleted_at is null`; `run_attendance_non_marking_alert` — `identity.staff_profiles where role='manager' and deleted_at is null`) correctly applies this filter; this one RPC does not, making it an isolated inconsistency rather than a systemic gap in this Epic.

**Risk**: If the ticket's original reporting manager has since been terminated (soft-deleted) by the time a Platform Admin updates the ticket's status, a notification row is still created addressed to that now-terminated account — a harmless-but-incorrect orphaned notification (the terminated account's session should already be revoked, per Epic 1's `revoke-sessions`, so nothing is actually delivered), but it is precisely the defect class `EPIC_5_REVIEW.md` M2 already named and fixed elsewhere in this codebase.

**Architecture reference**: `EPIC_5_REVIEW.md` M2 ("filter deleted_at before notifying"), already correctly re-applied three other times within this same Epic (see Root cause above).

**Recommended fix**: Before calling `comms.enqueue_notification`, add `if exists (select 1 from identity.staff_profiles where id = v_current.reported_by and deleted_at is null) then ... end if;` (or fold the check into the existing condition), matching the guard already present in this Epic's own three other notification fan-outs.

---

### M2 — `issue_tenant_billing_transaction` has no SQL-level validation of the `currency` format

**Severity**: Medium

**Location**: `backend/supabase/migrations/20260729000004_epic9_rpc_functions.sql:252-320`; `backend/supabase/migrations/20260729000002_epic9_platform_ops_tables.sql` (the `tenant_billing_transactions.currency` column, no `CHECK`).

**Root cause**: `issueTenantBillingTransactionSchema` (`backend/src/validation/platformOps.schema.ts`) validates `currency` against a 3-letter ISO-4217-shaped regex, but this is a client-side (Zod) check only — neither `issue_tenant_billing_transaction` nor the `tenant_billing_transactions` table itself enforces any format constraint on the column. `p_currency` is only run through `coalesce(nullif(btrim(p_currency), ''), 'EGP')` (line 310) — trimmed and defaulted, never format-checked.

**Risk**: A caller reaching the RPC directly (bypassing the Node API layer's Zod validation entirely — the same "Direct REST bypass" surface this review's scope explicitly names) can insert an arbitrary string of up to Postgres's `text` limit into `currency`, corrupting Masar's own financial ledger with malformed currency data that every downstream reconciliation/reporting query would need to defensively re-validate against.

**Architecture reference**: `BACKEND_ARCHITECTURE.md` §28's own "RLS/validation is mandatory even on tables that feel safe, the RPC is the true last line of defense" framing, already applied correctly elsewhere in this Epic (e.g. `create_support_ticket`'s own server-side non-empty checks on `subject`/`body`, duplicated from — not solely delegated to — the Zod layer).

**Recommended fix**: Add a `CHECK (currency ~ '^[A-Z]{3}$')` constraint to the `tenant_billing_transactions` table (or an equivalent in-RPC check before the `INSERT`), matching the discipline `create_support_ticket` already applies to its own text fields in the same migration file.

---

### L1 — `jobs.scheduled_job_runs.job_name` has no closed vocabulary

**Severity**: Low

**Location**: `backend/supabase/migrations/20260729000002_epic9_platform_ops_tables.sql` (the `scheduled_job_runs.job_name` column, plain `text`).

**Root cause**: `job_name` is unconstrained `text`, not an enum or a foreign key to a job registry — every current caller passes a hardcoded literal (`'service_health_check'`, `'tenant_billing_check'`, `'trial_expiry_sweep'`, `'attendance_non_marking_alert'`), so this is not currently reachable with attacker- or user-supplied input, but it means a future typo in a new job's own hardcoded string (e.g. a copy-paste of an existing function with the name not updated) would silently create a disconnected row of run-history under the wrong name, with nothing in the schema to catch it.

**Risk**: Low — purely an internal-consistency/observability concern (a mis-attributed job-run row would make Platform Admin's System Health view harder to trust), not a security issue, since no external input reaches this column today.

**Architecture reference**: `BACKEND_ARCHITECTURE.md` §27's own named job list is the closest thing to a canonical vocabulary, but the doc does not mandate an enum here.

**Recommended fix**: Low priority; if addressed, either a `CHECK (job_name = ANY(ARRAY[...]))` constraint or a small lookup table, updated whenever a new scheduled job is introduced by any future Epic.

---

### L2 — No automated test exercises the two concurrency races (H1, H2) directly

**Severity**: Low

**Location**: `backend/tests/rls/epic9_rls_adversarial.sql` (the suite as a whole).

**Root cause**: The RLS adversarial suite runs entirely within a single Postgres session/transaction per the established convention (`begin; ... rollback;`), which cannot express two genuinely concurrent sessions racing against the same row — the same structural limitation that means this class of bug is inherently hard to catch with this codebase's existing test methodology, not specific to this Epic's own test-writing effort.

**Risk**: Low on its own (a coverage gap, not a runtime defect) — but it is the direct reason H1/H2 were only caught by manual line-by-line tracing during this review rather than by re-running the existing suite, and is worth naming so it isn't mistaken for "the tests already cover this."

**Architecture reference**: N/A — testing-methodology limitation, consistent with every prior Epic's own identical constraint (no Docker/local Postgres available to run a true two-connection concurrency test in this sandbox).

**Recommended fix**: Out of this Epic's scope to resolve (would require a genuine multi-session test harness this sandbox cannot run); once H1/H2 are fixed with proper atomic guards, a regression test *can* be written the same way `send_report_draft`'s own `STATE_ALREADY_PROCESSED` path is tested today (call twice sequentially within one session and assert the second call is rejected/no-ops) — sequential-call testing is a reasonable proxy for the atomic-guard property even without true concurrency.

---

## Summary

### Critical findings
- **C1** — `platform.write_activity_log` is granted to `authenticated` with no internal authorization check, letting any logged-in user forge `activity_log` entries for any tenant.

### High findings
- **H1** — `refund_tenant_billing_transaction`'s status transition has no atomic guard; concurrent/duplicate calls can record a double refund.
- **H2** — `update_support_ticket`'s status/assignment update has the same unguarded read-then-write race; concurrent calls can lose an update and double-fire a notification.

### Medium findings
- **M1** — `update_support_ticket`'s reporting-manager notification doesn't filter `deleted_at is null` on the recipient, unlike every other notification fan-out this Epic introduces.
- **M2** — `issue_tenant_billing_transaction`/`tenant_billing_transactions.currency` has no SQL-level format validation, relying entirely on the Zod layer.

### Low findings
- **L1** — `jobs.scheduled_job_runs.job_name` has no closed vocabulary (internal-consistency risk only, not currently reachable by external input).
- **L2** — No automated test directly exercises the H1/H2 concurrency races (a coverage gap explaining why they weren't caught earlier, not a runtime defect on its own).
