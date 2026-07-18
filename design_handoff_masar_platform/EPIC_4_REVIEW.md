# Epic 4 Review — Principal Backend Audit

**Role:** Principal Backend Auditor. **Scope:** every file delivered in Epic 4 (`backend/supabase/migrations/20260719*.sql`, `backend/supabase/functions/{notification-dispatch,_shared/notificationProviders.ts}`, `backend/src/**` additions, `backend/tests/**` additions). **Method:** line-by-line re-read of every migration, RPC body, RLS policy, Edge Function, and TypeScript file, cross-checked against `BACKEND_ARCHITECTURE.md` (§2.2, §3.44-3.49.2, §4, §5, §6, §12, §12.1, §13.1, §14.2, §15, §16, §25.6, §26, §27) and `BACKEND_EXECUTION_PLAN.md`'s Epic 4 section — and explicitly checked against every Critical/High finding class from `EPIC_2_REVIEW.md` and `EPIC_3_REVIEW.md` to confirm none has recurred.

**This is documentation only. No code was modified as part of this review.**

---

## Executive summary

Epic 4's structural shape correctly applies most of the hard-won Epic 2/3
lessons — `comms.enqueue_notification` is `service_role`-only from its first
draft (the C4 lesson), cross-table tenant-consistency triggers exist from
each table's first migration (the C1 lesson), and `platform.drain_notification_outbox`
correctly uses `SELECT ... FOR UPDATE SKIP LOCKED` for atomic, concurrency-safe
claiming. That last point makes the most severe finding below more notable,
not less: the same engineer who got the claiming pattern right in
`drain_notification_outbox` did not apply it to `notification-dispatch`'s own
job-queue polling, which has **zero protection against concurrent double-processing**
— a direct, unmitigated recurrence of the review-requested "duplicate
notification risk" / "queue consistency" category. A second Critical finding
is a direct, explicit contradiction of `BACKEND_ARCHITECTURE.md` §12's own
named privacy boundary ("Platform Admin never gets blanket R on tenant
operational data... chat contents... this is a deliberate privacy boundary,
not an oversight") — `chat_attachments_read_participant` grants exactly that
blanket cross-tenant read access to any platform_admin, support tier
included.

**Finding counts: 2 Critical · 4 High · 4 Medium · 4 Low.**

---

## Critical

### C1 — `chat_attachments_read_participant` grants any Platform Admin (support tier included) unrestricted, cross-tenant read access to private chat attachments — a direct violation of §12's named privacy boundary

**Where:** `20260719000008_epic4_storage_and_realtime.sql`, `chat_attachments_read_participant`.

```sql
using (
  bucket_id = 'chat-attachments'
  and (
    ( ... tenant-prefix + participant check ... )
    or public.is_platform_admin()
  )
);
```

**Root cause:** the policy's final disjunct, `or public.is_platform_admin()`,
is an unconditional bypass — no tenant match, no participant check, no
platform-admin-tier check. `is_platform_admin()` is `true` for **all three**
platform-admin tiers, including `support`.

`BACKEND_ARCHITECTURE.md` §12's own notes section states, verbatim: *"Platform
Admin **never** gets blanket `R` on tenant operational data (children's
health notes, **chat contents**, evaluation details) — support access is
limited to what's needed for billing/technical support... enforced by giving
Platform Admin RLS bypass only on `platform.*` schema tables and the specific
cross-tenant support views, not a global bypass role. This is a **deliberate
privacy boundary, not an oversight**."* Chat attachments are literally chat
content — photos/documents a guardian and teacher share in a private,
one-on-one thread about a specific child. This policy grants exactly the
"global bypass role" shape the architecture doc explicitly rules out, to
exactly the resource type it names as the example of what must never be
exposed this way.

**Risk:** any platform_admin account — including a `support`-tier account,
whose entire justification per §12.1 is "ticket context," not blanket data
access — can read every attachment in every conversation across every
tenant, with no audit trail distinguishing this from a legitimate
participant read (the policy doesn't even require the read to correlate to
an open support ticket). This is the single most sensitive category of data
this Epic introduces (private family/child-related chat content), and the
exposure is total and unconditional.

**Recommended fix:** remove the `or public.is_platform_admin()` disjunct
entirely, matching the "no blanket bypass" rule the architecture doc already
states. If Platform Admin support genuinely needs attachment access for a
specific ticket, model it the same way §12.1 models every other
support-scoped exception: a narrow, audited, ticket-linked access path (e.g.
a `get_chat_attachment_for_support_ticket(ticket_id, object_path)` RPC that
checks an open, assigned `support_tickets` row references this conversation
before minting a signed URL) rather than a raw storage RLS bypass.

---

### C2 — `notification-dispatch` has no atomic job-claiming mechanism — concurrent invocations double-process the same jobs, causing duplicate real-world sends and a lost-update race on retry counters

**Where:** `supabase/functions/notification-dispatch/index.ts`, lines 58-95.

**Root cause:** the function `SELECT`s a batch of `queued`/`processing` jobs,
then loops over them calling `processNotificationJob`, and only updates each
job's `status` **after** processing completes (success or failure). There is
no `UPDATE ... WHERE status = 'queued' RETURNING *`-style atomic claim before
work begins, no `FOR UPDATE SKIP LOCKED`, and the `processing` status value
that exists in the `jobs.background_job_status` enum is never actually
written by any code path — it is dead, unused. Two concurrent invocations of
this function (overlapping cron fires, a manual invocation racing a
scheduled one, or a caller's HTTP-level retry after a timeout while the
first invocation is still running) will both `SELECT` the identical batch of
job rows and both execute `processNotificationJob` for every one of them.

This is the exact defect class `EPIC_2_REVIEW.md` M1 and `EPIC_3_REVIEW.md`
M3 already fixed twice in this codebase (fold a state check into the write's
own atomic `WHERE` clause, never check-then-act) — and, notably, the *same
migration set* in this very Epic gets it right elsewhere:
`platform.drain_notification_outbox()` (migration 7) correctly uses
`SELECT ... FOR UPDATE SKIP LOCKED` for precisely this reason. The lesson was
demonstrably known and applied once in this delivery; it was not applied to
the higher-traffic, more consequential job queue.

**Risk:** concurrent processing of the same job means (a) duplicate
`notification_deliveries` rows and duplicate real provider sends — once a
real push/WhatsApp/SMS/email provider replaces the current stub, this is
duplicate WhatsApp/SMS **cost** and duplicate, confusing push notifications
to real end users (guardians receiving the same "child picked up" alert
twice); (b) a lost-update race on `attempts`: both invocations read the same
`attempts` value, both compute `attempts + 1`, and whichever `UPDATE`
commits last silently overwrites the other's increment — the retry-cap logic
(`isExhausted = attempts >= max_attempts`) becomes unreliable exactly when
it matters most (a job stuck in a failure loop may never actually reach its
cap, or may reach a phantom cap early depending on write ordering).

**Recommended fix:** claim jobs atomically before processing, e.g. `UPDATE
jobs.background_job_queue SET status = 'processing' WHERE id = ANY($batch)
AND status = 'queued' RETURNING *` (or a `SELECT ... FOR UPDATE SKIP LOCKED`
read immediately followed by the same atomic status flip, matching
`drain_notification_outbox`'s own pattern in this same delivery) — only
process rows the claiming statement actually returned. Increment `attempts`
in the same atomic statement, not via a separate read-then-write.

---

## High

### H1 — `broadcast_announcement` silently delivers to zero recipients when `audience = 'classroom'` and `classroomId` is omitted, at every validation layer

**Where:** `src/validation/comms.schema.ts` (`broadcastAnnouncementSchema`), `src/services/announcementService.ts`, `20260719000006_epic4_rpc_functions.sql` (`broadcast_announcement`'s classroom fan-out branch), `20260719000002_epic4_announcements.sql` (`announcements_classroom_requires_classroom_audience` CHECK).

**Root cause:** four layers exist between the client and the database, and
none of them enforces "classroom_id is required when audience = 'classroom'":

1. The Zod schema only validates `classroomId` as an optional UUID — no
   `.refine()` ties its presence to `audience === 'classroom'`.
2. `AnnouncementService.broadcast()` checks `!input.audience` but never
   checks `input.audience === 'classroom' && !input.classroomId`.
3. `broadcast_announcement`'s own PL/pgSQL body never checks
   `p_audience = 'classroom' and p_classroom_id is null`.
4. The DB `CHECK` constraint, `announcements_classroom_requires_classroom_audience
   check (classroom_id is null or audience = 'classroom')`, only enforces the
   *converse* direction (if `classroom_id` is set, `audience` must be
   `'classroom'`) — it does **not** require `classroom_id` to be set when
   `audience = 'classroom'`, because `classroom_id IS NULL` alone already
   satisfies the `OR`.

With `p_classroom_id` `NULL`, the fan-out query's join predicate
`ch.classroom_id = p_classroom_id` never matches any row under standard SQL
NULL-comparison semantics (`x = NULL` is never true) — the `for` loop's
classroom branch silently contributes zero rows. The function still inserts
the `announcements` row with `sent_at = now()` and returns it successfully.

**Risk:** a manager creates a "classroom" broadcast (e.g. "field trip
tomorrow — permission slip due") without selecting a classroom (a plausible
UI/form-state bug, not just a malicious input), and the system reports
success with a `sent_at` timestamp while zero guardians are ever notified.
This is a silent, undetectable failure of a manager-facing feature with
real-world consequences (missed time-sensitive communication) and no
downstream error, log, or retry signal — the announcement simply looks sent.

**Recommended fix:** add the missing direction to the `CHECK` constraint
(`(audience <> 'classroom' or classroom_id is not null)`), add the
corresponding Zod `.refine()`, and add an explicit RPC-level check that
raises `VALIDATION_FAILED` before the fan-out loop runs — defense in depth
at all three layers, matching this codebase's own established convention
elsewhere (e.g. `assign_bus_rider`'s capacity check is validated both in the
RPC and by a DB trigger).

---

### H2 — `device_tokens`/`notification_preferences` self-service RLS policies validate only `recipient_id`, never `recipient_type` or `tenant_id` — a direct recurrence of the `EPIC_3_REVIEW.md` C2 defect class on new tables

**Where:** `20260719000005_epic4_rls_policies.sql`, `device_tokens_insert_own`, `device_tokens_update_own`, `notification_preferences_insert_own`, `notification_preferences_update_own`.

**Root cause:** every one of these four policies is exactly `using
(recipient_id = auth.uid())` / `with check (recipient_id = auth.uid())`. Per
§12, these tables are "CRUD (own, self-service)" for every role — the RPCs
(`register_device_token`, `update_notification_preferences`) correctly
derive `recipient_type` from the caller's own JWT role and `tenant_id` from
`current_tenant_id()` server-side, never trusting client input for either.
But because both tables also grant **direct** client `INSERT`/`UPDATE` via
RLS (not RPC-only, per §12's own "self-service" framing), a client bypassing
the RPC in favor of raw PostgREST access can set `recipient_type` and
`tenant_id` to **anything**, as long as `recipient_id` is their own
`auth.uid()`.

This is the same shape as `EPIC_3_REVIEW.md` C2 (RLS policies that don't
encode the invariants the RPC enforces, letting direct REST access bypass
them) and `EPIC_3_FIX_REPORT.md`'s own fix pattern for exactly this class of
gap (tighten `USING`/`WITH CHECK` to mirror the RPC's actual guarantee) was
not applied here.

**Risk:** a guardian could `INSERT` a `device_tokens` row with
`recipient_type = 'platform_admin'` (their own `recipient_id`, an
arbitrary/wrong `recipient_type`). `notification-dispatch`'s
`resolveRecipientContact` branches on `recipient_type` to pick which
`identity.*` table to query — a mismatched `recipient_type` causes silent
non-delivery (the wrong profile table is queried, likely finding no row) at
best, or, if the recipient_id UUID happens to coincidentally exist as a row
in a different profile table, cross-context contact resolution at worst. A
forged/blank `tenant_id` violates §2.2's own "zero exceptions" `tenant_id`
convention and would corrupt any future tenant-scoped device-token or
preference query (e.g. a support/ops tool listing "all tokens for tenant X"),
even though the current delivery has no such feature yet.

**Recommended fix:** add `recipient_type = <role-derived value>` and
`tenant_id = public.current_tenant_id()` (or `IS NULL` for platform_admin)
to all four `USING`/`WITH CHECK` clauses, computed the same way the RPCs
already compute it — the same "RLS must encode the RPC's own guarantee, not
just ownership" principle `EPIC_3_FIX_REPORT.md` applied to
`pickup_passes`/`trips`/`pickup_scan_events`.

---

### H3 — `send_message`/`broadcast_announcement` idempotency-key handling never implements §25.6's "different payload with the same key → `CONFLICT_IDEMPOTENCY_KEY_REUSED`" contract, silently replaying the wrong response instead

**Where:** `20260719000006_epic4_rpc_functions.sql`, both RPCs' `idempotency_replay`/`idempotency_store` usage.

**Root cause:** `public.idempotency_replay(p_key)` (Epic 1, frozen) returns
whatever `response_snapshot` was previously stored for that key, with no
comparison against the *current* call's parameters; `public.idempotency_store`
does `ON CONFLICT (key) DO NOTHING`. Neither Epic 4 RPC stores or compares a
hash/fingerprint of its own input alongside the key, so §25.6's explicit
contract — *"calling it with the same key but a different payload raises
`CONFLICT_IDEMPOTENCY_KEY_REUSED` rather than silently applying either
version"* — is not implemented for either RPC that actually needs it.

**Risk:** if a client reuses an idempotency key across two logically
different actions (a client-side bug generating a key once per session
instead of once per action, or a key-reuse bug in a retry wrapper), the
second call — e.g. a genuinely different chat message, or a genuinely
different announcement — is silently dropped: the caller receives the
*first* call's response back with `200`-equivalent success semantics, with
no indication their second, different action never happened. For
`broadcast_announcement` specifically, this could mean a manager believes a
second, corrected announcement went out when in fact the original
(potentially wrong) one was returned again and no new fan-out occurred.

**Recommended fix:** since Epic 1's `idempotency_replay`/`idempotency_store`
are frozen and cannot be modified, implement the comparison at the Epic 4
call site: store a hash of the normalized input parameters alongside (or
inside, via a JSON wrapper) the `response_snapshot`, and on replay compare
the current call's input hash against the stored one — raise
`CONFLICT_IDEMPOTENCY_KEY_REUSED` (already a defined `ErrorCode`, no new
code needed) on mismatch instead of unconditionally returning the stored
response.

---

### H4 — `broadcast_announcement`'s recipient fan-out is a per-row procedural loop, not set-based — a direct recurrence of the `EPIC_2_REVIEW.md` L2 / `EPIC_3_REVIEW.md` M2 defect class, here at genuinely large scale

**Where:** `20260719000006_epic4_rpc_functions.sql`, `broadcast_announcement`'s `for v_recipient in ... loop` (both the manager/tenant branch and the platform_admin/tenant branch).

**Root cause:** for every resolved recipient, the loop performs (a) one
`INSERT ... ON CONFLICT DO NOTHING` into `announcement_recipients`, (b) one
`comms.enqueue_notification(...)` function call (itself one `INSERT`), which
(c) fires the `trg_notifications_enqueue_dispatch` trigger, itself one more
`INSERT` into `jobs.background_job_queue`. That is a minimum of three
sequential writes per recipient, procedurally, exactly the shape
`EPIC_2_REVIEW.md` L2 (`mark_attendance`'s original per-record loop) and
`EPIC_3_REVIEW.md` M2 (`start_trip`'s original per-rider loop) already
identified and fixed with a set-based rewrite in this codebase — twice.
Unlike `escalate_conversation`'s analogous manager-notification loop (L1
below, where the recipient count is always tiny — a tenant's manager
headcount), `audience = 'all'`/`'parents'`/`platform_audience = 'all_schools'`
can plausibly resolve to hundreds of recipients (every guardian in a tenant,
or every tenant on the platform).

**Risk:** a large-audience broadcast (a real, expected use case — "all
parents" is literally one of five documented audience values) performs
hundreds of sequential round-trips within a single RPC call, all inside one
transaction — increasing lock hold time, transaction duration, and the
chance of a mid-broadcast failure leaving a partial fan-out (no
recipient-level idempotency exists within the loop itself, only at the
whole-RPC level via the idempotency key). This directly matches the
review's own "scalability issues" and "queue consistency" categories.

**Recommended fix:** replace the loop with set-based statements: one
`INSERT INTO announcement_recipients SELECT ... FROM <recipient CTE>`, and
one `INSERT INTO comms.notifications (...) SELECT ... FROM <recipient CTE>`
(bypassing per-row calls to `comms.enqueue_notification`, but keeping the
insert inside this same `SECURITY DEFINER` function body, which preserves
the "narrow write path" security property — the seam is "only a `SECURITY
DEFINER` function can write here," not "only via a function *call* rather
than a bulk statement"). The channel-fan-out `INSERT` into
`notification_deliveries` for non-`in_app` channels can similarly become one
set-based `INSERT ... SELECT` joining the newly-inserted notifications
against `unnest(p_channels)`.

---

## Medium

### M1 — No RLS restriction prevents a message's own sender from marking their own outbound message "read," corrupting the single-column read-receipt semantics

**Where:** `20260719000005_epic4_rls_policies.sql`, `messages_update_guardian`, `messages_update_staff`.

**Root cause:** both policies' `USING`/`WITH CHECK` clauses scope by
conversation participation (`conversation_id in (select id from
conversations where guardian_id = auth.uid())`) and by `read_at IS
NULL`/`IS NOT NULL`, but never exclude the caller's own sent messages
(`sender_id = auth.uid()`). `comms.messages.read_at` is a single column
(matching `BACKEND_ARCHITECTURE.md` §3.45's literal field list — this is a
schema characteristic, not something Epic 4 invented), so it can only ever
represent one fact; nothing stops a guardian from calling the mark-read path
on a message *they themselves* sent.

**Risk:** a chat UI convention (e.g. a "seen" checkmark, matching common
messaging-app UX) built on `read_at` would show a message as read by the
recipient before the recipient ever opened it, if the sender's own client
(accidentally, via a buggy "mark all read on conversation open" call, since
nothing scopes it to inbound-only) flips `read_at` on their own sent
message.

**Recommended fix:** add `sender_id <> auth.uid()` (or `sender_id IS
DISTINCT FROM auth.uid()`, null-safe) to both policies' `USING` clause — a
one-line, no-schema-change fix.

---

### M2 — The §16-documented "background job repeatedly failing" notification is never produced for any job, including notification-dispatch's own failures

**Where:** entire delivery (absence); `BACKEND_ARCHITECTURE.md` §16, row "Background job repeatedly failing (past retry cap) | Manager (tenant-scoped job) / Platform Admin (platform-scoped job) | in_app | system".

**Root cause:** `notification-dispatch/index.ts` correctly marks a job
`status = 'failed'` once `attempts >= max_attempts`, but nothing then
enqueues the documented alert notification — no call to
`comms.enqueue_notification` (or an equivalent path) exists anywhere in the
failure branch.

**Risk:** the one documented safety-net for "the notification pipeline
itself is broken" never fires — ironic and self-referential, since this is
the exact mechanism meant to catch failures in the system whose job is
catching failures. A systemic provider outage or a bug causing every
dispatch attempt to fail would silently accumulate `failed` rows in
`jobs.background_job_queue` with no operator ever being alerted through the
in-app channel the architecture specifically designed for this.

**Recommended fix:** on the `isExhausted` branch, resolve the job's
"scope" (tenant-specific — derivable from the underlying notification's
`tenant_id` — vs. platform-scoped) and call `comms.enqueue_notification` (or
`platform.notify_...`-style helper) targeting the relevant Manager(s) or
Platform Admin team with `category = 'system'`.

---

### M3 — Device-token invalidation (§27) has no implementation, not even a stub code path

**Where:** entire delivery (absence); `BACKEND_ARCHITECTURE.md` §27, row "Device token invalidation | Push provider reports a token as invalid/expired | Hard-delete the matching `device_tokens` row."

**Root cause:** `sendPush` (the stubbed provider) always returns `delivered:
true` and never a "token is invalid" signal; `ProviderSendResult` has no
field distinguishing "temporarily failed" from "permanently invalid,
please stop trying"; `deliverOnChannel`'s push branch has no code path that
would ever call a token-deletion helper even in principle.

**Risk:** low today (the stub never reports invalidity), but this means the
moment a real push provider is wired in, dead/uninstalled-app tokens will
never be cleaned up — every future dispatch attempt for that recipient will
keep querying and attempting delivery to a token that will never succeed
again, silently wasting provider quota/cost indefinitely with no self-healing
mechanism, contrary to the architecture's explicit design for this exact
scenario.

**Recommended fix:** extend `ProviderSendResult` with an `invalidToken:
boolean` field; when `sendPush` (once real) reports it, delete the
corresponding `comms.device_tokens` row inside `deliverOnChannel`'s push
branch. Not urgent to fix before a real provider exists, but should be
scaffolded now so it isn't forgotten when one is wired in.

---

### M4 — `notification-dispatch` processes its batch fully serially with no batching, a real scalability concern for a job whose own architecture doc calls out sustained volume

**Where:** `supabase/functions/notification-dispatch/index.ts`, the `for (const job of jobs ?? [])` loop and `processNotificationJob`/`resolveRecipientContact`/`resolvePreferences`.

**Root cause:** each of up to `BATCH_SIZE` (20) jobs is processed one at a
time, `await`ed in sequence; each job performs a minimum of 4 sequential
round-trips (notification fetch, pre-seeded-deliveries fetch, contact
resolve, preferences resolve) plus one more per channel attempted (push
additionally does a `device_tokens` fetch) — up to ~120 sequential
round-trips per invocation, none batched or parallelized.

**Risk:** `BACKEND_EXECUTION_PLAN.md` Epic 4 §11 describes this job as
"fully live for the first time — preference check, device-token resolution,
multi-channel fan-out," explicitly the first Epic where this pipeline
carries real load; §25's own risk framing for this Epic focuses entirely on
vendor integration risk, implicitly assuming the dispatch mechanism itself
scales. At any meaningful notification volume (e.g. a large broadcast, see
H4, landing 200+ jobs at once), serial processing at ~120 round-trips/job
batch means a single invocation could take many seconds to minutes,
risking Edge Function timeout and leaving jobs stuck mid-batch.

**Recommended fix:** batch the independent lookups across the whole job set
(one `IN (...)` query for all notifications in the batch, one for all
distinct recipients' contact info, one for all distinct preference rows)
instead of per-job round-trips; consider `Promise.all` for the
provider-send calls within a job once real (network-bound) providers exist.

---

## Low

### L1 — `escalate_conversation`'s manager-notification fan-out is also a per-row loop (same shape as H4, negligible impact here)

**Where:** `20260719000006_epic4_rpc_functions.sql`, `escalate_conversation`'s `for v_manager in ... loop`.

**Root cause/risk:** identical shape to H4, but bounded by a tenant's active
manager headcount, which is always small (typically 1-3). Included for
completeness since the review explicitly asks not to reintroduce this
defect class, but the practical impact is negligible unlike H4.

**Recommended fix:** low priority; could be folded into the same set-based
rewrite recommended for H4 if convenient, not worth a dedicated migration on
its own.

---

### L2 — New RLS policies for conversations/messages/notifications don't check the caller's own profile `deleted_at`, reintroducing the pre-fix version of the `EPIC_3_REVIEW.md` L2 defect class on a new set of tables

**Where:** `20260719000005_epic4_rls_policies.sql` — every policy keyed on `public.current_role() = '<role>' and <column> = auth.uid()` (no exceptions).

**Root cause:** `EPIC_3_REVIEW.md` L2 flagged, and `EPIC_3_FIX_REPORT.md`
fixed, `current_driver_bus_ids()` not checking `driver_profiles.deleted_at`
— a terminated account retains access for the remainder of its Auth session
lifetime. That fix was scoped to the one function it touched; the underlying
lesson ("a role claim in a JWT can outlive the profile row it's suppose to
represent") was not carried forward into Epic 4's entirely new RLS surface,
none of which checks `staff_profiles.deleted_at`/`guardian_profiles.deleted_at`/
`driver_profiles.deleted_at` anywhere.

**Risk:** same as the original L2 — bounded by JWT/session lifetime (~1h per
`BACKEND_ARCHITECTURE.md` §10.5), not a permanent access grant, so this is
correctly Low rather than High/Critical, but it is a real, currently-live
gap across every one of this Epic's new tables, not just one function.

**Recommended fix:** same as `EPIC_3_FIX_REPORT.md`'s L2 fix, applied
consistently — add a `deleted_at IS NULL` existence check against the
caller's own profile row inside the relevant policies (or, more
efficiently, formalize this as a single new shared helper,
`current_account_is_active()`, so future Epics don't need to remember to
special-case it per table).

---

### L3 — `comms.conversations.staff_id` (and, by extension, `classrooms.coordinator_staff_id`) is never validated to actually hold the `'teacher'` role

**Where:** `20260719000001_epic4_comms_schema_and_conversations.sql`, `check_conversation_consistency` (validates tenant membership, not role); inherited ambiguity from `academic.classrooms.coordinator_staff_id` (Epic 2, unconstrained by role there either).

**Root cause/risk:** if a classroom's `coordinator_staff_id` is ever a
manager or reception staff member rather than a teacher (nothing in Epic 2
or Epic 4 prevents this), `send_message`'s auto-created conversation would
target that non-teacher as `staff_id` — the `conversations_select_staff`/
`messages_*_staff` RLS policies restrict to `current_role() = 'teacher'`
specifically, so that staff member could never read the very conversation
they were assigned to, only a manager (via the escalated-only path, and only
after someone escalates it) could ever reach it. This is an inherited
data-modeling gap from Epic 2, not a new defect Epic 4 introduced, and
requires an unusual configuration (a non-teacher coordinator) to manifest.

**Recommended fix:** out of scope for a fix in this Epic (would touch Epic
2's `classrooms` table/RLS, which is frozen) — worth flagging for a future
Epic that revisits classroom-coordinator assignment validation, or for
`send_message`'s own classroom-coordinator lookup to additionally filter
`role = 'teacher'` so it simply doesn't resolve a non-teacher coordinator as
a valid message target in the first place (an Epic-4-side, fully additive
mitigation).

---

## Verification of freeze compliance

- **Epic 1 remains frozen**: `platform.notify_on_provisioning_event`'s
  trigger is the only new object attached to an Epic 1 table
  (`platform.audit_log`); it is a new `CREATE TRIGGER`/`CREATE FUNCTION` in
  a new Epic 4 migration file, not an edit to
  `20260714000004_epic1_audit_and_idempotency.sql`. No Epic 1 file's
  contents were changed.
- **Epic 2 remains frozen**: read-only cross-schema references only
  (`academic.children`, `academic.classrooms`, `academic.subjects`,
  `academic.child_guardian_links`) — no `ALTER`/`CREATE OR REPLACE` targets
  any Epic 2 object.
- **Epic 3 remains frozen**: `platform.drain_notification_outbox` performs
  normal DML (`SELECT`/`UPDATE`) against `platform.notification_outbox`, the
  table Epic 3's own fix pass built for exactly this future consumption — no
  Epic 3 migration file is touched.
- **No previous migration was modified**: confirmed by direct inspection —
  every Epic 4 migration file is new (`20260719*`), distinct from Epic 1
  (`20260714*`), Epic 2 (`20260715*`), and Epic 3 (`20260717*`) filenames;
  none of the eight Epic 4 files contains an `ALTER`/`DROP`/`CREATE OR
  REPLACE` statement targeting an object whose `CREATE TABLE`/original
  `CREATE FUNCTION` lives in an earlier Epic's migration file, with the two
  documented, intentional exceptions above (both purely additive: a new FK
  is not added here at all in Epic 4, unlike Epic 2/3's driver/classroom FK
  precedent — Epic 4 needed no such extension).
- **All Epic 4 changes are additive**: confirmed — every migration is
  `CREATE SCHEMA`/`CREATE TABLE`/`CREATE TYPE`/`CREATE POLICY`/`CREATE OR
  REPLACE FUNCTION` (new function names) throughout; `config.toml`'s one-line
  `schemas` list addition (`"comms"`) is the only edit to a pre-existing
  file, matching the identical pattern every prior Epic used.

---

## Cross-reference: recurring defect classes from Epic 2/3 reviews

| Prior finding | Epic 4 status |
|---|---|
| C1 (Epic 2) / C2 (Epic 3) — RLS doesn't encode the RPC's own invariant, enabling direct-REST bypass | **Recurred** — H2 (device_tokens/notification_preferences), and structurally the same root cause as C1 above (storage RLS granting a bypass no RPC would ever grant) |
| C4 (Epic 3) — a cross-cutting write seam over-exposed to `authenticated` | **Not recurred** — `comms.enqueue_notification` correctly `service_role`-only from the first draft |
| M1 (Epic 2) / M3 (Epic 3) — check-then-act instead of atomic claim | **Recurred, more severely** — C2 above (no claim mechanism at all, vs. the earlier findings' partial TOCTOU windows) |
| L2 (Epic 3) — RLS helper not checking the caller's own profile `deleted_at` | **Recurred** — L2 above, across an entirely new table set |
| L2 (Epic 2) / M2 (Epic 3) — per-row loop instead of set-based | **Recurred** — H4 (large-scale, `broadcast_announcement`) and L1 (small-scale, `escalate_conversation`) |
| H1 (Epic 3) — a documented, already-implementable requirement (audit logging) skipped and mis-bucketed as "deferred" | **Partially recurred** — M2 above (the §16 "job repeatedly failing" alert) is a documented, implementable requirement that was simply not built, though not mis-bucketed as deferred (it was not mentioned in `EPIC_4_COMPLETION_REPORT.md`'s Known Limitations at all) |

This repetition — most sharply visible in C2, where the correct pattern
(`FOR UPDATE SKIP LOCKED`) appears once in the *same delivery* but isn't
applied to the higher-stakes job queue — suggests the underlying lessons are
being learned locally (per-function) rather than durably (as a standing
checklist applied to every new piece of concurrent/RLS-sensitive code before
it ships). A pre-ship checklist derived from `EPIC_2_REVIEW.md`/`EPIC_3_REVIEW.md`'s
finding titles, checked against every new migration before a completion
report is written, would likely have caught C2, H2, H4, and L2 without
needing a second review pass to surface them.
