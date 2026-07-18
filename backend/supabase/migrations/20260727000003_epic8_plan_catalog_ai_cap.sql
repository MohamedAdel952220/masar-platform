-- ============================================================================
-- Epic 8 — AI Report Architecture
-- Migration 3: additive column on tenancy.plan_catalog (frozen, Epic 1)
-- Ref: BACKEND_ARCHITECTURE.md §3.2, §3.20.1, §19
--
-- §3.20.1 states the daily AI-call cap check is against "the plan's daily
-- cap," implying the cap is plan-dependent — but Epic 1's own §3.2 field
-- list for tenancy.plan_catalog (frozen, migration 20260714000002) has no
-- such column. Per this task's own explicit instruction ("if any
-- requirement would require changing an existing migration, ... create a
-- new forward-only migration instead"), this migration adds the column via
-- a plain, additive `ALTER TABLE` rather than touching Epic 1's migration
-- file at all — the existing migration history is untouched; every
-- already-provisioned tenant row receives the column via its NOT NULL
-- DEFAULT, so this is a zero-downtime, backward-compatible change.
--
-- The specific default (50 calls/tenant/day) is a placeholder, not a
-- product-specified figure — no concrete number appears anywhere in
-- BACKEND_ARCHITECTURE.md or BACKEND_EXECUTION_PLAN.md. It is uniform
-- across all three plan codes at insert time; differentiating it per plan
-- tier (e.g., a higher cap for `premium`) is a pricing/product decision
-- explicitly out of this implementation's scope, exactly like Epic 6's PSP
-- selection and Epic 7's media-relay vendor selection were both deferred as
-- external, non-engineering decisions.
-- ============================================================================

alter table tenancy.plan_catalog
  add column ai_daily_call_cap int not null default 50 check (ai_daily_call_cap > 0);

comment on column tenancy.plan_catalog.ai_daily_call_cap is
  'Per-tenant daily cap on combined ai_polish_note/ai_draft_report Edge Function calls (§3.20.1, §19). Added additively in Epic 8 (migration 20260727000003) — Epic 1''s own plan_catalog migration is unmodified. Placeholder default (50); real per-plan-tier values are a pricing decision outside this implementation''s scope.';
