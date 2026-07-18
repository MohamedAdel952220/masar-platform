# pg_cron Architecture Decision

Answered exclusively from `BACKEND_ARCHITECTURE.md` and `BACKEND_EXECUTION_PLAN.md`. No source code inspected.

---

## 1. Is pg_cron required for production?

**Yes.**

- `BACKEND_ARCHITECTURE.md` §27 (Scheduled Jobs), opening line: *"Implementation: `pg_cron` (Supabase's built-in Postgres cron extension) triggering either a Postgres function directly (for pure-DB work) or a database webhook to an Edge Function (for anything needing external calls)."* This is stated as an unconditional fact about the system's implementation, not one option among several — the only "either/or" in that sentence is about the *target* of the cron tick (a Postgres function vs. an Edge Function webhook), not about *what does the scheduling*. Every one of the 16 jobs in §27's table (billing ledger generation, payment reminders, camera heartbeat sweep, service health check, trial expiry sweep, etc.) is implemented this way, with no per-job exception noted.
- §34 (Supabase Project Structure) — the section that specifically enumerates required production project configuration — states: *"**Database**: single Postgres instance, schemas per §2.1, `pg_cron` and `pg_net` extensions enabled for scheduled/webhook jobs, `pgcrypto`/uuid generation extension enabled, **point-in-time recovery enabled on production**."* `pg_cron` is listed in the same sentence, with the same unconditional "enabled" phrasing, as point-in-time recovery — which §34/§31 treat as a non-negotiable production requirement, not a discretionary choice. By contrast, where the architecture *does* intend to leave something as a deployment-time judgment call, it says so explicitly — e.g., the very next clause in the same bullet-group: *"Production's region is selected for lowest latency to Egypt-based users — the specific region is a deployment-time decision"* (§34, line above). No equivalent "this is a deployment-time decision" qualifier is ever attached to `pg_cron`.

**Conclusion: `pg_cron` is named as required baseline production infrastructure, with the same weight as PITR, not flagged anywhere as optional or environment-discretionary.**

---

## 2. Is pg_cron required before Epic 10?

**Yes — more specifically, it is required as part of Epic 9's own Definition of Done, and Epic 10 structurally assumes Epic 9 is already complete.**

`BACKEND_EXECUTION_PLAN.md`'s Epic 9 entry (§"Epic 9 — Platform Operations & Admin Console"):
- **§6 (Supabase Features Involved)**: *"`pg_cron` (health checks, tenant billing check, trial-expiry sweep), Realtime..."* — `pg_cron` is named as a feature **this Epic itself** brings live, not a future Epic's concern.
- **§12 (Scheduled Jobs Involved)**: *"Service health check, tenant billing check, trial expiry sweep, attendance non-marking alert."* — these are the same four jobs currently deployed as functions but with no cron trigger.
- **§19 (Acceptance Criteria)**: *"Service health status accurately reflects a simulated real outage of each tracked service **within one health-check interval**."* This criterion is only checkable against an actual, running, recurring interval — it cannot be satisfied by a function that exists but is never invoked on a schedule.

Epic 10's own entry (§"Epic 10 — Jobs, Performance & Production Hardening"), §12 (Scheduled Jobs Involved): *"Staff rating recomputation, GPS ping retention purge (activated for real), storage orphan cleanup (activated for real), idempotency key purge, failed-login/session-anomaly sweep — **every remaining job from §27 not already stood up in an earlier Epic**."* This list is explicit and exhaustive, and it **excludes** all four of Epic 9's jobs by name — confirming the plan's own internal accounting assumes those four are already "stood up" (registered, running) by the time Epic 10 begins, not carried forward as Epic 10 work.

Epic 10 §17 (Dependencies on Previous Epics): *"All of Epics 1–9 (this Epic hardens the complete system)."* Epic 9 being genuinely complete — not just "migrated" but meeting its own §19/§21 Definition of Done — is a stated precondition for Epic 10, and §27's health-check acceptance criterion cannot pass without `pg_cron` actually scheduling the job.

**Conclusion: yes — not as a generic "before Epic 10" gate, but because `pg_cron` (at minimum, installed with Epic 9's four jobs registered) is explicitly named as part of Epic 9's own scope and acceptance criteria, and Epic 10 is defined as building on a complete Epic 9.**

---

## 3. Can scheduled jobs legally be executed by an external scheduler instead?

**Not as a documented, sanctioned alternative — the architecture is silent on this option, not permissive of it.**

Neither document ever names, describes, or endorses an external scheduler (a hosting platform's own cron, a third-party scheduling service, a VM crontab hitting an Edge Function endpoint, GitHub Actions on a schedule, etc.) anywhere. Compare this to §26 (Background Jobs), where the architecture *does* explicitly offer a real either/or: *"Implementation: Supabase's `pg_net`/database webhooks triggering Edge Functions, **or** the `jobs.background_job_queue` table... polled by a scheduled Edge Function."* That is what a genuine, textually-sanctioned alternative looks like in this document's own style — two named mechanisms, both described, with guidance on when to use each. §27 contains no equivalent second branch for the scheduler itself; its "either/or" is scoped only to what a `pg_cron` tick calls (Postgres function vs. Edge Function webhook), not to what performs the scheduling.

§34 reinforces this by listing `pg_cron`/`pg_net` as an "enabled extension" of the Supabase project itself — a statement about the chosen platform's own scheduling primitive, not about an interchangeable external service sitting outside it.

**Conclusion: no textual basis exists for treating an external scheduler as an architecturally-equivalent substitute. It is neither explicitly forbidden nor explicitly authorized — it is simply never discussed. Substituting one would be an undocumented deviation from the one implementation the architecture names, not a choice the documents "legally" grant. If an external scheduler were ever adopted, it would need its own explicit architecture decision (mirroring `EPIC_9_ARCHITECTURE_DECISION.md`'s own process for the read-access question), not silent substitution.**

---

## 4. Is the absence of pg_cron an architectural blocker or merely an operational deployment choice?

This is the one genuinely closer call, and it turns on a real distinction the documents themselves draw between two different kinds of gaps:

**Case for "architectural blocker"**: §1–2 above establish that `pg_cron` is named, specifically and repeatedly, as required production infrastructure and as an explicit Epic 9 deliverable whose absence leaves a named acceptance criterion (§19, the health-check interval test) unsatisfiable. That is a real, load-bearing requirement, not a nice-to-have.

**Case for "operational limitation," which is the stronger read**: Everything the architecture actually needed to *specify* about scheduled jobs is already fully specified and, per the live database audits performed earlier in this project, already correctly built — the run-history table, all four Epic 9 job functions, their advisory-lock concurrency guards, and the `jobs.scheduled_job_runs` schema are all deployed and correct. What's missing is not a design decision, a missing artifact, or an unresolved ambiguity in the documents (unlike the platform/jobs read-access question, which genuinely required producing a new architecture decision and a new migration to resolve) — it is a single, well-known, already-fully-documented infrastructure toggle (`CREATE EXTENSION pg_cron;`, a standard Supabase project setting) plus a set of `cron.schedule(...)` calls referencing functions that already exist and require no further code. There is no engineering work left to design; there is only an enablement step left to perform. This is the same category of gap `BACKEND_ARCHITECTURE.md` §34 itself treats as routine project provisioning (the same sentence that names `pg_cron` also names `pgcrypto` and PITR as "enabled" — standard checklist items for standing up an environment), not a structural property of the system's design.

**Conclusion: `pg_cron`'s absence is required-but-not-yet-performed infrastructure provisioning — the architecture fully and unambiguously specifies what must exist; nothing about the design is missing, contradictory, or undecided. This is an operational deployment step that has not yet been executed in this environment, not a gap in the architecture itself.**

---

## 5. A note outside the scope of this question, surfaced because it is directly relevant

While tracing §34 for this analysis, a passage was found that was **not** located during the earlier `EPIC_9_ARCHITECTURE_DECISION.md` research (that research's search terms matched "exposed"/"config.toml"/"api.schemas" and missed this passage's own wording). `BACKEND_ARCHITECTURE.md` §34, "API exposure" bullet, states:

> *"PostgREST auto-API is enabled on client-facing schemas (`academic`, `approvals`, `transport`, `safety`, `billing`, `comms`, `media` — read/write per RLS) and **disabled/excluded** on `platform`, `jobs`, and the machine-identity-relevant parts of `identity` (`service_accounts`) from the public API surface entirely (`db.schema` config), reachable only via `service_role`-executed Edge Functions/RPCs — an extra belt-and-suspenders layer beyond RLS for the most sensitive schemas."*

This directly and specifically states `platform`/`jobs` should be **excluded** from PostgREST's exposed schema list — the opposite of the conclusion `EPIC_9_ARCHITECTURE_DECISION.md` reached (Option A) and the opposite of what was deployed in `20260730000001_infra_platform_reads_authenticated_grants.sql` and the `config.toml` change immediately preceding this task. That prior analysis leaned on §12/§12.1/§13.6's RLS-bypass language and §14's "no read RPC anywhere in the catalog" pattern; this passage is more specific still — it is the one place in either document that names `platform`/`jobs` exposure by schema, explicitly, as a deliberate security-layering decision ("belt-and-suspenders... for the most sensitive schemas"), rather than requiring inference from adjacent sections.

This is flagged here, not resolved here — it is out of scope for the pg_cron question asked, and reconciling it against §12/§12.1/§13.6's own RLS-bypass language (which does still describe a real per-role SELECT-policy design on `platform.*` that would otherwise be inert) needs its own deliberate analysis before any further action is taken on already-deployed infrastructure. Raising it promptly, rather than waiting to be asked, given it bears on infrastructure already live in `masar-staging`.

---

## 6. Summary

| Question | Answer |
|---|---|
| Required for production? | Yes — named alongside PITR in §34 as required baseline project configuration |
| Required before Epic 10? | Yes — named as an Epic 9 "Supabase Feature Involved" and "Scheduled Job," with an Epic 9 acceptance criterion unsatisfiable without it; Epic 10's own job list explicitly excludes Epic 9's four jobs, confirming they're assumed already live |
| External scheduler as a legal substitute? | Not documented as sanctioned — the architecture is silent, not permissive; §27's only real either/or is the *target* of a `pg_cron` tick, not the scheduler itself |
| Blocker or operational choice? | **Operational** — the design is fully and unambiguously specified with nothing left undecided; only an enablement/registration step remains |

**OPERATIONAL LIMITATION**
