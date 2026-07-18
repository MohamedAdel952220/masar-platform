# Epic 7 Review — Media & Camera Architecture

Production-grade architecture and code review of Epic 7 as delivered in
`EPIC_7_COMPLETION_REPORT.md`: 5 migrations (`media` schema, 2 tables, 2
enums, 1 consistency trigger, 9 RLS policies, 1 scheduled-job function), 4
Edge Functions + 2 shared provider/utility files, 10 application-layer
files (plus 5 additive edits to shared plumbing), 6 test files. No code was
modified during this review. Every finding below was verified by direct
reading of the shipped migration/Edge Function/TS files
(`backend/supabase/migrations/20260725*.sql`,
`backend/supabase/functions/{camera-heartbeat,camera-stream-token,issue-service-account-key,revoke-service-account-key}/index.ts`,
`backend/supabase/functions/_shared/{mediaRelay,serviceAccountKey,cors,errors}.ts`,
`backend/src/**`, `backend/tests/**`), not by re-reading the completion
report's own claims.

**Executive summary**: the tenant-isolation and RBAC mechanics this Epic
set out to guarantee are, in isolation, correctly built — every RLS policy
uses the established single-equality-check baseline, the two
deliberately-non-obvious denies (Teacher gets zero Cameras access, Platform
Admin gets zero bypass on `cameras`/`camera_classroom_links`) are correctly
implemented and directly tested, the `camera_classroom_links` consistency
trigger correctly rejects cross-tenant links, and the heartbeat-sweep
scheduled job is genuinely set-based and idempotent under re-run. However,
one **Critical** defect defeats this Epic's own headline confidentiality
guarantee: `media.cameras` — a table whose `ip_address`/`stream_protocol`
columns `BACKEND_ARCHITECTURE.md` §17 explicitly and repeatedly states must
"never be sent to client apps" — is added to the `supabase_realtime`
publication that guardians are expected to subscribe to (§15's own channel
matrix names this exact channel for "Parent (linked classroom only)"), and
Supabase Realtime's `postgres_changes` broadcasts the full row (every
column, sourced from the WAL) to any subscriber whose RLS `SELECT` policy
permits the row, with no column-level filtering available. This is not a
theoretical or adversarial exposure — it fires automatically, several times
a minute per camera, as the direct and intended consequence of the
heartbeat mechanism this Epic itself builds. Two **High** findings compound
this: `camera-stream-token` never checks `cameras.online` before minting a
viewing token (only `admin_disabled`), so the "viewable iff `online=true`
AND `admin_disabled=false`" invariant §3.33 defines is not actually
enforced anywhere in code; and service-account keys are not bound to a
specific `camera_id`, so a single leaked or malicious on-prem agent key can
forge a heartbeat — and therefore a false "online" / real IP-broadcasting
event — for *any* camera in its tenant, not just the one it legitimately
operates. The remaining findings are real but narrower: a documented,
already-flagged column-exposure gap for direct REST access (correctly
called out in the completion report, not re-litigated here except where it
compounds with the Realtime finding above), a duplicated-logic maintenance
risk between the Deno and Node heartbeat-authorization implementations, a
missing purpose/scope cross-validation on key issuance, and a handful of
Low-severity gaps in indexing, pagination, and test coverage.

---

## Critical

### C1 — `media.cameras` is added to the Realtime publication guardians subscribe to, broadcasting `ip_address`/`stream_protocol` to every linked-classroom guardian on every heartbeat

**Location**: `backend/supabase/migrations/20260725000005_epic7_realtime.sql` (`alter publication supabase_realtime add table media.cameras;`), combined with `backend/supabase/migrations/20260725000002_epic7_camera_tables.sql` (`ip_address inet not null, stream_protocol text not null` as direct columns on the same table) and `backend/supabase/migrations/20260725000003_epic7_rls_policies.sql` (`cameras_select_guardian`, which legitimately grants a guardian row-level `SELECT` on exactly this table for their own child's linked classroom(s)).

**Root cause**: `BACKEND_ARCHITECTURE.md` §17 states, in the most direct
language used anywhere in that document for a confidentiality boundary:
*"Credential handling: raw camera IP/RTSP credentials (`cameras.ip_address`,
stream auth) are never sent to client apps."* This Epic's own TypeScript
layer takes that requirement seriously at the REST/repository level — the
`GuardianCamera` domain type structurally excludes both fields, and
`CameraRepository.listForGuardian()` selects an explicit, safe column list
(`GUARDIAN_SAFE_COLUMNS`). But §15's own Realtime Event Matrix separately
requires a `tenant:{id}:cameras` channel — *"cameras (UPDATE — online/
offline, heartbeat) — Dashboard, Parent (linked classroom only)"* — and
this migration satisfies that requirement the only way Postgres logical
replication supports: `alter publication supabase_realtime add table
media.cameras`. Supabase Realtime's `postgres_changes` feature evaluates a
subscriber's RLS `SELECT` policy to decide **whether** a given row's change
event is delivered to them, but it has no mechanism to filter **which
columns** are included in that event's `record`/`old_record` payload — the
full row, as captured from the WAL, is what gets sent. Since
`cameras_select_guardian` (migration 3) correctly and necessarily grants a
guardian row-level access to exactly the camera rows they're allowed to
view metadata for, and since `camera-heartbeat` (migration 2's own header
comment: *"online is written ONLY by the heartbeat path"*) updates
`online`/`last_heartbeat_at` on that same row roughly once a minute per
active camera, every one of those routine heartbeat-driven UPDATEs
broadcasts the camera's real `ip_address` and `stream_protocol` directly
into every subscribed guardian's client — with zero adversarial action
required. The completion report's own §7.2/§11.3 acknowledges a *narrower*
version of this risk ("a guardian's own Supabase client... **could in
principle** request `ip_address` via an explicit `?select=ip_address` REST
query **or** receive it in a Realtime payload") and frames it as a
secondary, crafted-request risk with REST as the primary concern — that
framing understates the actual severity: the REST exposure requires a
guardian to deliberately craft a non-default query, while the Realtime
exposure requires nothing but using the Parent App exactly as designed
(subscribing to the channel §15 itself specifies).

**Risk**: Every guardian with a child in a camera-linked classroom receives
that camera's real on-premise IP address (and RTSP/WebRTC protocol
identifier) continuously, for the lifetime of their Realtime subscription,
via the normal "is the classroom camera online" live-status feature. A
camera's `ip_address` is real network-reconnaissance information about a
nursery's on-premise infrastructure — combined with the fact that any
authenticated guardian in *any* tenant can, at minimum, learn this for
their own tenant's cameras, this is a direct, systemic violation of an
explicit, named architectural security invariant (§17), not a
crafted-attack edge case. It also undermines the entire stated purpose of
`camera-stream-token`'s existence: §17 introduces the token-minting
Edge-Function indirection specifically so raw connection details never
reach a client; the Realtime channel this same Epic wires up bypasses that
indirection entirely for the two fields it was built to protect.

**Recommended fix**: Do not put `ip_address`/`stream_protocol` on a table
any non-manager role has RLS `SELECT` access to combined with Realtime
publication membership. Two viable, architecture-compliant paths: (1)
Split the two sensitive columns into a separate `media.camera_connections`
(or similarly named) table — `camera_id primary key references
media.cameras(id)`, `ip_address`, `stream_protocol` — with **no** RLS
policy granting guardian access at all (manager-only `SELECT`/`INSERT`/
`UPDATE`) and **not** added to `supabase_realtime`; `media.cameras` itself
retains every other column (including `online`/`admin_disabled`) and stays
in the publication exactly as today. This is a schema change, but it is
purely additive to Epic 7's own (undeployed) migrations — no Epic 1-6 table
is touched, and per this task's own rules Epic 7 may still be corrected
in place since it has not yet been deployed. (2) If keeping the single-table
shape is preferred to stay literal to §3.33's field list, replace the
direct `alter publication ... add table media.cameras` with a `REPLICA
IDENTITY` + trigger-based `pg_notify`/`realtime.broadcast` pattern that
publishes a hand-curated payload (id, tenant_id, online, admin_disabled,
last_heartbeat_at only) via Realtime's `broadcast` channel type instead of
`postgres_changes` — broadcast channels are not sourced from the WAL and
never include columns the publishing code doesn't explicitly put in the
payload. Either fix should be paired with a live (not just static) check
against a real Supabase project confirming a guardian-subscribed Realtime
client's payload no longer contains `ip_address`/`stream_protocol`, since
this is exactly the kind of platform-behavior claim that cannot be fully
verified by static code reading alone.

---

## High

### H1 — `camera-stream-token` never checks `cameras.online` before minting a stream token, so the documented "viewable iff online AND !admin_disabled" rule is not enforced anywhere

**Location**: `backend/supabase/functions/camera-stream-token/index.ts`, lines 75-103 (the camera lookup `.select('id, tenant_id, admin_disabled')` and the single gating check `if (camera.admin_disabled) { throw ... }`).

**Root cause**: `BACKEND_ARCHITECTURE.md` §3.33 states plainly: *"A camera
is stream-viewable only when `online = true AND admin_disabled = false`."*
§17 repeats the same compound condition. `camera-stream-token` is the one
and only place in this codebase that decides whether to hand a guardian a
working, relay-scoped viewing credential — and its SQL `select` for the
camera row doesn't even fetch the `online` column, let alone gate on it.
The function will happily mint a fully valid stream token (relay URL +
token + expiry) for a camera that has never sent a heartbeat, or one that
went offline hours ago, as long as it isn't `admin_disabled`. `docs/
EPIC_7_COMPLETION_REPORT.md` §11.6 lists a scope decision about
`camera:*` wildcard scopes but never flags this specific gap; it is not a
documented, deliberate scope exclusion anywhere in the shipped artifacts —
it reads as an oversight, not a decision.

**Risk**: Functionally, a Parent App following this contract would request
a token for a camera showing `online=false` in its own metadata read and
still receive a "successful" token response, which is a confusing,
untested failure mode at best (the stub relay always succeeds regardless,
so this can't even be observed as a stub-environment error). More
significantly, this is the second of two conditions the architecture names
as jointly necessary for viewability — the review found (C1) that the
*other* half of this compound condition (whether `online` can be trusted
at all) is itself unenforced at the RLS layer. Together, C1 and H1 mean
neither half of §3.33's documented viewability rule is actually checked by
the one function whose entire purpose is enforcing it.

**Recommended fix**: Add `online` to the `select()` in
`camera-stream-token/index.ts` and gate identically to `admin_disabled`:
`if (!camera.online || camera.admin_disabled) { throw new AppError('VALIDATION_FAILED', 'This camera is currently unavailable.', ...) }`
(a single combined check, or two checks with the same error code, either is
fine). Add a corresponding RLS-suite/unit test asserting a token request
against an `online=false` camera is rejected, mirroring the existing
`admin_disabled` test already present in `EPIC_7_COMPLETION_REPORT.md`'s
own manual-QA checklist item for the disabled case.

### H2 — Service-account keys are not bound to a specific camera, enabling camera-heartbeat impersonation within a tenant

**Location**: `backend/supabase/migrations/20260714000003_epic1_identity_tables.sql` (`identity.service_accounts` — no `camera_id` column, frozen, not modifiable by this Epic), `backend/supabase/functions/camera-heartbeat/index.ts` lines 67-84 (the only binding check is `.eq('tenant_id', account.tenant_id)`), `backend/src/services/cameraHeartbeatService.ts` (identical binding in the Node mirror).

**Root cause**: `camera-heartbeat`'s request body is `{ cameraId: string }`
— any UUID the caller supplies. The only authorization check tying a
presented API key to a specific camera is that the target camera's
`tenant_id` matches the service account's own `tenant_id`; there is no
concept anywhere in the schema, the Edge Function, or the Node mirror of
"this service account may only heartbeat *this* camera." A tenant with,
say, ten cameras and ten separate on-prem agents (or one agent covering all
ten, the architecture doesn't distinguish) would — per how
`issue-service-account-key` is actually implemented — most naturally end up
either with one shared key for the whole fleet (in which case this is
inherent, not a bug) or with one key issued per agent/camera but with
**no code-level enforcement** that key #3 can only ever heartbeat camera
#3. `BACKEND_ARCHITECTURE.md` §10.7 describes "an on-prem camera relay
agent" (singular agent, plural implied cameras) without ever explicitly
ruling out per-camera binding, so this is a genuine design ambiguity the
architecture doc leaves open — but the *security* consequence is concrete
regardless of which interpretation was intended, because nothing in this
Epic's implementation closes it off even for the tenants that would want
per-camera isolation.

**Risk**: A single compromised or accidentally-leaked service-account key
(e.g., extracted from an insecurely-configured on-prem device, a
misconfigured agent, or a support technician's debugging session) can be
used to send fabricated heartbeats for **every** camera in that tenant, not
just the physical device the key was actually issued for — flipping
arbitrary cameras to `online=true` at will. Combined with H1 (no `online`
check before token issuance is at least consistent either way) and
especially with C1 (the same forged heartbeat also broadcasts that
camera's real `ip_address` to every subscribed guardian via Realtime, §17's
protection notwithstanding), a single leaked credential has blast radius
across an entire tenant's camera fleet rather than being contained to one
device. This also means the §19 Acceptance Criteria's implicit trust model
("a revoked key immediately stops working," verified and correct) doesn't
fully capture the risk window *before* revocation — there is no per-camera
containment even while the key is legitimately active.

**Recommended fix**: If per-agent-per-camera binding is the intended
model, add a nullable `camera_id uuid references media.cameras(id)` column
to a new Epic-7-owned join table (not to the frozen `identity.
service_accounts` row itself, to avoid ambiguity with the
`purpose=integration_other` non-camera case) — e.g. `media.
camera_service_account_links (camera_id, service_account_id, tenant_id)` —
and have `camera-heartbeat` additionally verify the presented key's
`service_account_id` is linked to the requested `cameraId` before writing.
If a single fleet-wide key per tenant is the intended, accepted model
instead, this should be an explicit, documented decision (in
`EPIC_7_COMPLETION_REPORT.md`'s Known Limitations, not silently assumed)
with a compensating control — e.g., a manager-visible list of "last
heartbeat per camera" so an anomalous or duplicate-source heartbeat pattern
is at least observable, and a recommendation that each physical relay
deployment get its own key so a compromise can be revoked without
disabling every camera in the tenant.

---

## Medium

### M1 — Duplicated, independently-maintained authorization logic between `camera-heartbeat/index.ts` (Deno) and `CameraHeartbeatService` (Node) for the codebase's least-battle-tested auth path

**Location**: `backend/supabase/functions/camera-heartbeat/index.ts` lines 46-84 vs. `backend/src/services/cameraHeartbeatService.ts` lines 25-44.

**Root cause**: This is the established, project-wide "Node-side testable
core mirrors the deployed Edge Function" pattern (`TenantProvisioningService`,
`StaffAccountService`, and now `CameraHeartbeatService`/`ServiceAccountService`),
not something Epic 7 invented — but Epic 7 is the first Epic to apply this
pattern to a genuinely novel, non-JWT, security-critical authentication
mechanism that `BACKEND_EXECUTION_PLAN.md` Epic 7 §25 itself names as "the
least battle-tested pattern in the plan." The Deno and Node implementations
of the API-key hash/status/scope check are two hand-written, independently
maintained copies of the same three-step authorization sequence
(hash-lookup → status check → scope check), with no shared source of truth
enforcing they stay in lockstep beyond `_shared/serviceAccountKey.ts` /
`src/lib/serviceAccountKey.ts`'s own byte-compatibility contract for the
hashing algorithm specifically (not the surrounding authorization logic).

**Risk**: A future security fix to one of the two checks (e.g., tightening
the scope-matching logic, adding a rate limit, adding the per-camera
binding H2 recommends) is only as good as the discipline of the engineer
applying it in both places. Nothing in the test suite (`tests/unit/
cameraHeartbeatService.test.ts` covers only the Node side) would catch a
divergence — the Deno function has zero automated test coverage of its own
(consistent with every other Edge Function in this codebase, a pre-existing,
project-wide limitation, not new to Epic 7, but worth naming here since
this is specifically the highest-novelty auth path in the whole system).

**Recommended fix**: At minimum, add a code comment cross-reference in
both files pointing at each other with an explicit "if you change the
authorization sequence here, change it there too" note (the current
comments describe the *pattern* but not this specific synchronization
obligation). If feasible within the project's Deno/Node split constraint, a
future refactor could extract the three-step check into a tiny, dependency-free
pure function duplicated verbatim (not just structurally mirrored) between
the two runtimes, making a textual diff between the two files a meaningful
drift-detection tool.

### M2 — Fire-and-forget `last_used_at` update in `camera-heartbeat/index.ts` uses `.then()` with no `.catch()`, risking an unhandled promise rejection

**Location**: `backend/supabase/functions/camera-heartbeat/index.ts`, lines 90-97.

**Root cause**: The Node-side mirror (`CameraHeartbeatService.recordHeartbeat`,
`cameraHeartbeatService.ts` line 49) correctly does
`this.serviceAccounts.touchLastUsed(account.id).catch((err) => { console.error(...) })`.
The Deno Edge Function's equivalent write is:
```ts
admin.schema('identity').from('service_accounts').update({ last_used_at: ... }).eq('id', account.id)
  .then(({ error }) => { if (error) console.error(...); });
```
`.then()` with only a success-handler catches a Postgrest-level error
returned *inside* a resolved response, but does **not** catch the promise
*rejecting* outright (e.g., a network-level fetch failure, a DNS error, or
any exception the underlying `fetch` call throws before a response is ever
parsed). This is exactly the class of bug the Node-side mirror's own
`.catch()` demonstrates awareness of — the two files diverge on this one
specific point despite the surrounding comment in both explicitly citing
the same "secondary bookkeeping write is non-fatal" convention.

**Risk**: Low in isolation (this is a best-effort bookkeeping write, not a
security or correctness-critical one, and Deno Deploy's isolate model is
generally tolerant of unhandled rejections in fire-and-forget contexts) —
but an unhandled promise rejection is still an unhandled promise rejection,
and in some Deno runtime configurations this can surface as isolate-level
warnings/noise in logs, or in a worst case affect isolate stability under
load. It is a straightforward, zero-risk fix.

**Recommended fix**: Change `.then(({ error }) => { ... })` to
`.then(({ error }) => { if (error) console.error(...); }).catch((err) => { console.error('service_accounts.last_used_at update failed (network):', err); });`
in `camera-heartbeat/index.ts`, matching the Node mirror's own pattern
exactly.

### M3 — `issue-service-account-key` does not cross-validate `purpose` against `scopes`, allowing a mismatched key to be issued and accepted

**Location**: `backend/supabase/functions/issue-service-account-key/index.ts`, `validate()` function, lines 35-44; `backend/src/validation/media.schema.ts`, `issueServiceAccountKeySchema`, lines 56-61.

**Root cause**: `purpose` (`camera_agent` | `integration_other`) and
`scopes` (an arbitrary array of `resource:action` strings) are validated
entirely independently — nothing checks that a `purpose=camera_agent` key
actually carries (only) camera-related scopes, or that a
`purpose=integration_other` key does *not* carry `camera:heartbeat`. Since
`camera-heartbeat`'s own authorization check (both Deno and Node) only ever
inspects `scopes.includes('camera:heartbeat')` and never looks at
`purpose` at all, a manager who issues an `integration_other`-purpose key
with `scopes: ["camera:heartbeat"]` (whether by mistake, by copy-paste, or
by a future integration's key template being reused) would find it
functions identically to a real `camera_agent` key for heartbeat purposes,
undermining `purpose`'s value as an audit/inventory signal (§3.9.1 lists
`purpose` as part of the row's own identity, presumably for exactly this
kind of "what can this key actually do" clarity).

**Risk**: Low-to-Medium — this does not cross any tenant or role boundary
(it's the tenant's own manager issuing a key against their own tenant's
resources either way), so it is not a privilege-escalation vector. It is
primarily a data-integrity / operational-clarity gap: `purpose` becomes an
unreliable signal for "what is this key actually capable of," which
matters when a manager is later auditing `listServiceAccountsRoute`'s
output to decide which keys are safe to leave active vs. revoke.

**Recommended fix**: Add a cross-field check to both `issue-service-account-key/index.ts`'s `validate()` and `issueServiceAccountKeySchema`'s Zod schema (via `.refine()`, mirroring the mutual-exclusivity refine pattern already used elsewhere in this codebase, e.g. Epic 6's `generateInvoiceItemSchema`): if `purpose === 'camera_agent'`, every scope must match `/^camera:/`; if `purpose === 'integration_other'`, no scope may match `/^camera:/`. This keeps the scope format itself open-ended (not prematurely closing off future non-camera scopes) while ensuring `purpose` and `scopes` can never silently disagree.

### M4 — `current_guardian_classroom_ids()` (inherited from Epic 5) does not exclude soft-deleted classrooms, and this Epic newly relies on it for a higher-stakes authorization decision

**Location**: `backend/supabase/migrations/20260721000003_epic5_rls_helpers.sql` (frozen, not modified by this Epic — reused as-is by `backend/supabase/migrations/20260725000003_epic7_rls_policies.sql`'s `cameras_select_guardian`/`camera_classroom_links_select_guardian`, and independently re-derived by `backend/supabase/functions/camera-stream-token/index.ts` lines 56-69 via a hand-rolled equivalent query against `child_guardian_links`/`children`).

**Root cause**: `current_guardian_classroom_ids()`'s own query is `select
distinct c.classroom_id from academic.children c where c.id = any
(current_guardian_child_ids()) and c.deleted_at is null` — it filters
soft-deleted *children* but never joins to `academic.classrooms` to also
filter `classrooms.deleted_at is null`. This is a pre-existing Epic 5
function, correctly out of scope for this Epic to modify (frozen), and in
Epic 5's own original context (event/classroom-wide visibility) the
practical impact of a stale, soft-deleted classroom ID briefly remaining in
this set was low. Epic 7 is the first Epic to reuse this exact helper for
a *camera-viewing* authorization decision — and `camera-stream-token`'s own
hand-written equivalent (lines 56-69) has the identical gap: it filters
`children!inner(classroom_id, deleted_at).deleted_at === null` (the
child's own `deleted_at`) but never checks whether the *classroom* itself
was soft-deleted.

**Risk**: Low in practice — a classroom is soft-deleted only as part of a
deliberate manager action, and a child pointing at a soft-deleted classroom
without having been reassigned is itself an unusual, likely-transient data
state (most reassignment flows would move the child first). But the
consequence, if it occurs, is a guardian retaining camera-viewing
capability (including a live stream token) for a classroom the tenant has
explicitly decommissioned, for as long as the stale reference persists —
a new, camera-specific consequence this Epic introduces on top of an
old, previously lower-stakes gap.

**Recommended fix**: Out of scope to fix inside the frozen
`current_guardian_classroom_ids()` itself. `camera-stream-token`'s own
hand-rolled query (which this Epic *does* own) should add an explicit
`academic.classrooms` join with `deleted_at is null` as defense-in-depth,
independent of whatever the shared helper does — matching this codebase's
own established "the higher-stakes Edge Function re-derives and re-checks
independently rather than trusting a shared helper's exact semantics"
principle (already applied once in this same function for the
ownership check itself, §14.3). Flag the shared helper's own gap as a
cross-Epic follow-up item for whichever future Epic next touches
`current_guardian_classroom_ids()`.

---

## Low

### L1 — `ServiceAccountRepository.findActiveByKeyHash`'s name promises a filter it doesn't perform

**Location**: `backend/src/repositories/serviceAccountRepository.ts`, lines 42-53.

**Root cause**: The method name and its own doc-comment ("Used only by
CameraHeartbeatService — filters ON api_key_hash... status/scopes are the
only fields the heartbeat authorization check needs") both imply an
`active`-scoped lookup, but the actual query is
`.eq('api_key_hash', keyHash).maybeSingle()` with no `.eq('status',
'active')` filter at all — it returns a revoked account's row exactly as
readily as an active one. The real enforcement happens correctly, one
layer up, in `CameraHeartbeatService.recordHeartbeat`'s own explicit
`account.status !== 'active'` check — so this is not a live vulnerability
today.

**Risk**: A future caller of this repository method (or a future
refactor of `CameraHeartbeatService` that trusts the method name at face
value) could reasonably assume the status filter already happened and skip
re-checking it, silently reintroducing the exact "revoked key still
accepted" defect §19's own Acceptance Criteria explicitly guards against.

**Recommended fix**: Rename to `findByKeyHash` (dropping "Active" from the
name) to accurately describe its actual behavior, or add the `.eq('status',
'active')` filter to the query itself and rename nothing — either resolves
the name/behavior mismatch. If the filter is added to the query, the
downstream `account.status !== 'active'` check in `CameraHeartbeatService`
becomes redundant but should be kept regardless, as defense-in-depth
consistent with this codebase's own established double-checking discipline
elsewhere (e.g. `verify_payment`'s own belt-and-suspenders status recheck,
Epic 6).

### L2 — `camera-stream-token` has zero automated test coverage of its own authorization re-derivation logic

**Location**: `backend/supabase/functions/camera-stream-token/index.ts` (no corresponding `tests/unit/*.test.ts` file exists); `EPIC_7_COMPLETION_REPORT.md` §7 documents this as a deliberate scope decision mirroring `PaymentService`'s own precedent of not wrapping `initiate-payment`.

**Root cause**: Consistent with the established, documented "no Node-side
mirror for a function whose core purpose is calling an external service"
convention — but the *consequence* here is that the two findings this
review identified in this exact function (H1's missing `online` check, M4's
missing classroom-`deleted_at` check) are precisely the kind of logic error
automated coverage would have caught, and none exists anywhere for this
function's actual decision logic. The RLS adversarial suite's own coverage
(`tests/rls/epic7_rls_adversarial.sql`) tests the underlying RLS policies
`camera-stream-token` also re-derives, but never invokes the Edge Function
itself (not possible from a plain SQL test).

**Risk**: Real but bounded — this mirrors an already-accepted, project-wide
gap (no Edge Function in this codebase has direct unit coverage), not a
new pattern Epic 7 invented. Flagged because this specific function is
where two of this review's own findings originate, illustrating the
practical cost of the gap concretely rather than abstractly.

**Recommended fix**: Consider a narrow exception to the "no TS mirror for
external-service-calling functions" rule specifically for the
*authorization* portion of `camera-stream-token` (the classroom-ownership
re-derivation and the `online`/`admin_disabled` gate), factored into a
small, independently testable pure function the Edge Function calls before
ever reaching `mintStreamToken` — this keeps the external-call boundary
untested-by-design (consistent with `initiate-payment`) while closing the
coverage gap on the part that is pure, deterministic authorization logic
and therefore fully mockable.

### L3 — `cameras_viewable_idx` is not used by any query path this Epic actually implements

**Location**: `backend/supabase/migrations/20260725000002_epic7_camera_tables.sql`, line 56.

**Root cause**: The index's own comment states it matches "the exact
predicate used" by stream-token requests, but `camera-stream-token/
index.ts`'s actual camera lookup filters by `id`/`tenant_id`/`deleted_at`
only (line 75-82) — it never queries by `online`/`admin_disabled` as a
search predicate (it fetches one specific row by primary key, then checks
those fields in application code, per H1's own finding that `online`
isn't even fetched). No other implemented query in this Epic filters by
this composite predicate either.

**Risk**: None functionally — an unused index costs write-amplification
(every `cameras` UPDATE, including every heartbeat, must maintain it) and
storage, with zero read benefit today. Not a correctness issue.

**Recommended fix**: Either remove the index until a real "list viewable
cameras" query exists that would use it, or (preferable, since a future
Dashboard "show only live cameras" list view is a plausible near-term
need) leave it in place but correct the comment to say "anticipates a
future list-viewable-cameras query; not yet exercised by any Epic 7 code
path" rather than implying current usage.

### L4 — No pagination on `CameraRepository.listForManager`/`listForGuardian`

**Location**: `backend/src/repositories/cameraRepository.ts`, lines 25-34 and 53-61.

**Root cause**: Both methods `select()` every matching row with no
`.range()`/`.limit()`, relying entirely on PostgREST's project-wide
`max_rows = 1000` default (`supabase/config.toml`) as the only cap.

**Risk**: Very low given realistic camera counts per nursery tenant (tens,
not thousands) — flagged only because scalability was explicitly in this
review's scope. Not a near-term concern.

**Recommended fix**: No action needed at current scale; if a future large
multi-campus tenant scenario emerges, add standard offset/cursor pagination
matching whatever convention a later Epic establishes for other
high-cardinality list endpoints.

### L5 — No `CHECK`/constraint prevents duplicate `ip_address` values within a tenant

**Location**: `backend/supabase/migrations/20260725000002_epic7_camera_tables.sql`, `media.cameras` table definition.

**Root cause**: `ip_address inet not null` has no uniqueness constraint,
tenant-scoped or otherwise. Two cameras in the same tenant (or the same
physical network) could be registered with identical IPs — most likely
from a data-entry mistake — with no system-level signal.

**Risk**: Cosmetic/operational only — this would cause both cameras'
`camera-heartbeat` calls to legitimately succeed independently (heartbeats
are scoped by `cameraId`, not `ip_address`, so there is no functional
collision), but a duplicate-IP registration likely indicates a
misconfigured camera or a copy-paste error a manager would want to be
warned about.

**Recommended fix**: Optional; a partial unique index
`create unique index cameras_tenant_ip_key on media.cameras (tenant_id, ip_address) where deleted_at is null;`
would catch the common mistake without being a hard architectural
requirement. Not blocking.

### L6 — `CameraRepository.update()`/`softDelete()` do not exclude already-soft-deleted rows

**Location**: `backend/src/repositories/cameraRepository.ts`, lines 89-124.

**Root cause**: Neither method filters `deleted_at is null` in its
`WHERE`-equivalent chain — a manager could technically update fields on
(or re-soft-delete) an already-deleted camera. RLS still correctly scopes
the operation to the manager's own tenant either way, so this has no
cross-tenant or cross-role consequence.

**Risk**: Cosmetic — no security impact, only a minor "should this even be
allowed" UX/data-hygiene question (e.g., editing the name of a
already-removed camera).

**Recommended fix**: Optional; add `.is('deleted_at', null)` to both
methods' filter chains if "cannot edit a deleted camera" is a desired
product rule. Not blocking.

---

## Findings by review category (cross-reference)

| Category (from the review brief) | Findings |
|---|---|
| Realtime information leakage | **C1** |
| Stream token vulnerabilities | H1, L2 |
| Camera impersonation / Machine authentication | H2 |
| Security / API key leakage | H2, M1, M3, L1 (none found: the raw key itself is never logged, stored, or re-returned anywhere in either runtime — this specific check passed cleanly) |
| JWT bypasses | None found — `camera-heartbeat` is the only function without JWT verification, and this is a documented, correct, architecture-mandated exception (§10.7), not a bypass |
| RLS bypasses | None found — every policy correctly scopes by `tenant_id` and role; the one gap found (C1) is a Realtime-layer issue, not an RLS policy defect, since RLS itself is working exactly as designed for row-level access |
| Tenant isolation issues | None found — independently re-verified for both new tables and the reused `service_accounts` table; RLS Test 1/4 in `epic7_rls_adversarial.sql` directly exercise this |
| Authorization issues | H1 (viewability rule not enforced), M3 (purpose/scope mismatch) |
| Race conditions | None found — the heartbeat sweep's `UPDATE...WHERE online=true` is safe under concurrent invocation by ordinary MVCC row-locking (a second concurrent sweep sees zero matching rows once the first commits); `revoke-service-account-key`'s guarded `UPDATE...WHERE status='active'` is atomic by construction |
| Performance problems / Scalability issues | L3 (unused index), L4 (no pagination) — both low-impact at realistic scale |
| Missing indexes | None found beyond L3's unused-rather-than-missing observation |
| Missing constraints | L5 |
| Missing validation | M3, H1 (a missing runtime check, not a missing input-validation rule) |
| Code duplication | M1 |
| Architecture violations | **C1** (direct violation of §17's named "never sent to client apps" requirement), H1 (§3.33's viewability rule unenforced) |
| Test coverage | L2 |

---

## Verdict

Epic 7 is **not production-ready as delivered**. One Critical finding (C1)
defeats this Epic's own headline confidentiality guarantee: adding
`media.cameras` to the Realtime publication guardians are architecturally
required to subscribe to (§15) broadcasts `ip_address`/`stream_protocol` —
columns §17 names, twice, as data that must "never be sent to client
apps" — to every linked-classroom guardian automatically, on every
heartbeat, as the ordinary and intended operation of the live camera-status
feature this Epic builds, not as a crafted or adversarial access path. This
must be fixed — by relocating the two sensitive columns off the
Realtime-published table (recommended) or by replacing `postgres_changes`
with a hand-curated `broadcast` channel for this table — before this
Epic's Realtime integration can be considered safe to expose to real
guardians. Two High findings compound the same underlying gap in the
authorization layer: `camera-stream-token` never checks `online` before
minting a viewing token, so neither half of §3.33's own documented
viewability rule (`online=true AND admin_disabled=false`) is actually
enforced anywhere in code; and service-account keys carry no per-camera
binding, so one leaked on-prem credential can forge heartbeats — and
trigger the C1 broadcast — for every camera in its tenant, not just the
device it was issued for. The Medium findings are real, narrower gaps
(duplicated machine-auth logic across the Deno/Node split with no
drift-detection mechanism, a missing purpose/scope cross-check on key
issuance, and a higher-stakes reuse of a pre-existing Epic 5 helper's
already-latent soft-delete gap) that should be fixed but do not on their
own cross a tenant or role boundary. The Low findings are cosmetic,
performance-at-scale, or test-coverage observations, none blocking.

Every lesson from the Epic 2-6 review cycle that this review specifically
checked for recurrence — `uuid[]`-returning RLS helpers (not `SETOF`),
`SET search_path = ''` + full schema-qualification on the one new
`SECURITY DEFINER` function, set-based scheduled-job SQL with no per-row
loops, no manager hard-delete on a historical record (only a correctly-
scoped pure-link-table exception mirroring `child_guardian_links`), the M1
atomic-guarded-UPDATE pattern for state transitions, `tenant_id` on every
tenant-scoped table including pure link tables with zero exceptions, and a
dedicated narrower-surface type/projection instead of a blanket
`select('*')` for the guardian-facing REST path specifically — was
correctly applied with no recurrence found anywhere in this Epic's own
code. The one genuinely new defect class this Epic introduces (C1, and its
compounding H1/H2) is a class none of Epic 1-6 could have surfaced, since
Epic 7 is the first Epic to combine a Realtime-published table with a
column the architecture doc treats as more sensitive than ordinary
row-level tenant/ownership data — this is a novel gap in this project's own
established defense-in-depth discipline, not a repeat of a previously-fixed
one. No Epic 1, Epic 2, Epic 3, Epic 4, Epic 5, or Epic 6 migration file
was modified — freeze compliance is confirmed (`git status --porcelain`
shows only the five new `20260725*` migration files, four new Edge
Function directories plus two new `_shared/` files, ten new `backend/src/`
files, and six new test files as untracked; `backend/src/lib/errors.ts`,
`backend/src/types/domain.ts`, `backend/supabase/config.toml`,
`backend/supabase/functions/_shared/cors.ts`, and `backend/supabase/
functions/_shared/errors.ts` show only additive extensions, matching every
prior Epic's identical pattern; `git diff --stat` against every
`20260714*`-`20260723*` migration file returns empty). Stopping here per
this task's instruction — no code was changed as part of this review.
