-- ============================================================================
-- Epic 6 — Billing & Payments
-- Migration 1: schema + enums
-- Ref: BACKEND_ARCHITECTURE.md §2.1, §3.36-3.43, §20
--
-- Epic 1, Epic 2, Epic 3, Epic 4, and Epic 5 are frozen (per the Epic 6
-- kickoff instruction): this migration and every migration that follows in
-- this Epic is purely additive — no existing migration file, table, column,
-- policy, or function from Epic 1-5 is modified anywhere in Epic 6.
--
-- Lessons applied proactively from the Epic 2-5 review/fix/audit cycle (not
-- retrofitted later — see each migration's own inline notes for the
-- specific application):
--   - Every RLS helper returns an array type, never SETOF
--     (EPIC_2_DEPLOYMENT_FIX.md).
--   - Cross-table tenant-consistency triggers from the first migration
--     (EPIC_2_REVIEW.md C1/H2).
--   - Capacity/uniqueness-critical inserts locked with SELECT ... FOR UPDATE
--     plus a DB-trigger backstop (EPIC_2_REVIEW.md C1, EPIC_3_REVIEW.md
--     C2/C3).
--   - Every trigger/function whose internal queries must see across an RLS
--     ownership boundary (e.g. counting/aggregating rows a narrowly-scoped
--     caller could not otherwise see) is SECURITY DEFINER from the start —
--     the single most expensive lesson of this entire project
--     (EPIC_5_REVIEW.md C1: a non-SECURITY-DEFINER capacity trigger invoked
--     by a per-owner-scoped role silently undercounted and bypassed
--     capacity enforcement entirely). Every trigger below was individually
--     checked against every role/path that can invoke it before deciding
--     its security context, not assumed safe by resemblance to an existing
--     trigger.
--   - RLS policies encode exactly the RPC's own invariant, never broader
--     (EPIC_3_REVIEW.md C2, EPIC_4_REVIEW.md H2) — no direct RLS write path
--     is ever granted alongside an RPC unless it cannot bypass anything the
--     RPC guarantees (EPIC_5_REVIEW.md H2).
--   - No manager hard-delete on a financial record, ever (EPIC_5_REVIEW.md
--     H1 generalized: even more strongly true here than for
--     approvals.events, since these rows are the reconciliation trail).
--   - Never grant Platform Admin a blanket cross-tenant RLS bypass on
--     tenant-operational data — a narrow, purpose-built SECURITY DEFINER
--     support-view function is used instead, exactly matching §13.6's own
--     "dedicated cross-tenant support views" language and the established
--     children_reception_safe()/children_driver_safe() column/row-narrowed
--     read-surface pattern (Epic 2/3) (EPIC_4_REVIEW.md C1).
--   - Idempotency-key + payload-hash envelope for every mutating RPC that
--     is not a natural upsert (EPIC_4_REVIEW.md H3); provider-reference
--     uniqueness is the payment-specific idempotency mechanism §20 itself
--     names, additionally guarded by an atomic UPDATE...WHERE status guard
--     on every settlement path so a duplicate webhook or a repeated manual
--     verification can never double-credit a ledger.
--   - Atomic UPDATE...WHERE for every state transition, disambiguated on
--     the (rare) 0-row path (EPIC_2_REVIEW.md M1, EPIC_3_REVIEW.md M3).
--   - Set-based SQL for the recurring-billing job — no per-row loop for a
--     tenant-wide, potentially large fan-out (EPIC_4_REVIEW.md H4).
--   - Single shared internal seam (settle_payment_transaction) for every
--     ledger-settlement write path (manual verify, gateway webhook,
--     refund) — avoids duplicating the same financial-correctness-critical
--     SQL three times, mirroring academic.set_child_day_path_status's
--     established "one internal SECURITY DEFINER seam, several public
--     callers" shape (Epic 3).
-- ============================================================================

create schema if not exists billing;

comment on schema billing is 'Epic 6 — fee configuration, per-child ledger, installment plans, invoices, payment transactions (§2.1, §3.36-3.43).';

create type billing.fee_cycle as enum ('monthly', 'per_term', 'once_per_year', 'one_time');
create type billing.fee_scope as enum ('all', 'optional');

-- Shared by billing_ledger_items AND installment_schedule_entries — §3.40's
-- own prose is explicit that the two are "handled identically... same enum
-- shape... kept in sync by the same job", even though the v0-draft inline
-- field list for installment_schedule_entries names a slightly different
-- label set ("pending" instead of "unbilled", no "partially_paid"). This is
-- read as a documentation inconsistency, not a deliberate divergence — the
-- prose's explicit unification intent is treated as authoritative (the same
-- resolution approach EPIC_5_REVIEW.md's own request/event type-mapping
-- ambiguity used): one shared enum type, used identically by both tables.
-- 'unbilled' is installment_schedule_entries' semantic equivalent of a v0
-- "pending" row (not yet due); 'partially_paid' is enum-present but not
-- exercised by v1 logic for a single fixed-amount installment entry (the
-- same "documented, forward-compatible, not-yet-reachable enum value"
-- precedent as approvals.trip_registration_status.registered, Epic 5).
create type billing.billing_status as enum ('unbilled', 'due', 'partially_paid', 'paid', 'overdue');

create type billing.invoice_status as enum ('unpaid', 'paid', 'void');
create type billing.payment_method as enum ('bank_transfer', 'instapay', 'wallet', 'fawry');
create type billing.payment_status as enum ('initiated', 'pending_verification', 'succeeded', 'failed', 'refunded');
