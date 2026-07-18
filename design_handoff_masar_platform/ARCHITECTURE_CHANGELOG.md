# Architecture Changelog

Documentation-only change. Source: `ARCHITECTURE_RECONCILIATION_REPORT.md`.

---

## What was corrected

`BACKEND_ARCHITECTURE.md` §34, "Supabase Project Structure" → "API exposure" bullet.

**Before**: stated that PostgREST's public API surface was "disabled/excluded" on the entire `platform` schema and the entire `jobs` schema, grouped with the machine-identity-relevant parts of `identity` (`service_accounts`), reachable "only via `service_role`-executed Edge Functions/RPCs."

**After**: states that PostgREST is enabled on `platform`/`jobs` specifically for the tables that §12/§12.1/§13.6 give a human-role RLS policy to — `platform.activity_log`, `platform.audit_log`, `platform.service_health_status`, `platform.support_tickets`, `platform.tenant_billing_transactions`, and `jobs.scheduled_job_runs` — read per RLS, the same model used by every other schema in the system. `service_accounts` and the two purely internal `jobs` tables (`background_job_queue`, `idempotency_keys`) remain excluded exactly as before — neither has ever carried a human-role RLS policy, so nothing about their access changes.

No other line in §34, and no other section of the document, was touched. Section numbering, headings, and every unrelated bullet in §34 (Auth configuration, Database, Storage, Realtime, Edge Functions, DNS/TLS) are unchanged.

---

## Why it was corrected

`ARCHITECTURE_RECONCILIATION_REPORT.md` identified a genuine internal contradiction between §34's blanket exclusion and §12/§12.1/§13.6's own detailed design:

- §12.1 explicitly requires Platform Admin tier enforcement to be *"an RLS policy branch... not an application-only check"* — a requirement a service-role-only access path cannot satisfy, since every RPC in this system (§14.3) authorizes callers via hand-written checks inside the function body, which is precisely the "application-only check" §12.1 rules out.
- §13.6 enumerates, table by table, exactly which `platform.*` tables carry a `platform_admin`/`manager`/`reception` RLS policy — detail that serves no purpose if those tables were never meant to be queried directly.
- §14's RPC/Edge Function catalog (§14.2) contains zero read operations anywhere in the entire system, for any schema — `platform` would have had to be a silent, undocumented exception, and Epic 9's own execution-plan entry describes itself as a "read-surface" Epic while naming no new Edge Functions to serve it.
- §12.1 and §13.8 both carry explicit "correction from v0 draft" markers, showing the Platform Admin RLS design was deliberately revised late in the document's life; §34's exclusion clause carried no such marker and was never reconciled against that later, more specific design.

The reconciliation concluded §34's blanket exclusion was a stale over-generalization — correct for `service_accounts` (a genuine machine-identity-only resource) but incorrectly extended to `platform` as a whole, which by the time of Epic 9 had 5 tables and 9 policies deliberately built for direct human-role reads.

---

## Which sections became authoritative

**§12 (Permission Matrix), §12.1 (Platform Admin sub-role matrix), and §13.6 (Platform Admin bypass scope)** — these govern `platform.*`/`jobs.scheduled_job_runs` read access going forward. §34 has been brought into agreement with them; it no longer states an independent, conflicting rule.

---

## Confirmation: no code or infrastructure changed

This update touched exactly one file: `design_handoff_masar_platform/BACKEND_ARCHITECTURE.md`, one bullet within §34. Nothing else in the repository was read for modification or written to. No SQL, migration, `config.toml`, Edge Function, source file, or test was changed as part of this task. The infrastructure that was already live and already found correct by `ARCHITECTURE_RECONCILIATION_REPORT.md` — `20260728000001_infra_schema_usage_grants.sql`, `20260730000001_infra_platform_reads_authenticated_grants.sql`, and the `config.toml` schema-exposure change — remains exactly as deployed, untouched by this task.

---

## Confirmation: documentation-only clarification

This is a correction to what the architecture document *says*, bringing a stale, unreconciled statement into agreement with the design's own authoritative sections and with the system's actual, already-verified-correct live behavior. It does not introduce, authorize, or imply any new technical behavior, access grant, schema change, or deployment action beyond what was already live and already audited as correct in `EPIC_9_DEPLOYMENT_AUDIT_FINAL.md` and `ARCHITECTURE_RECONCILIATION_REPORT.md`.
