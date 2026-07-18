-- ============================================================================
-- Epic 5 — Approvals & Events
-- Migration 1: schema + enums
-- Ref: BACKEND_ARCHITECTURE.md §2.1, §3.21-3.24
--
-- Epic 1, Epic 2, Epic 3, and Epic 4 are frozen (per the Epic 5 kickoff
-- instruction): this migration and every migration that follows in this
-- Epic is purely additive — no existing migration file, table, column,
-- policy, or function from Epic 1/2/3/4 is modified anywhere in Epic 5.
--
-- Lessons applied proactively from the Epic 2/3/4 review/fix cycle (not
-- retrofitted later — see each migration's own inline notes for the
-- specific application):
--   - Cross-table tenant-consistency triggers from the first migration
--     (EPIC_2_REVIEW.md C1/H2).
--   - Capacity-constrained inserts locked with SELECT ... FOR UPDATE plus a
--     DB-trigger backstop that holds regardless of write path
--     (EPIC_2_REVIEW.md C1, EPIC_3_REVIEW.md C2/C3).
--   - "Type requires companion field" invariants enforced as CHECK
--     constraints from day one, not discovered later
--     (EPIC_4_REVIEW.md H1).
--   - Every RLS helper returns an array type, never SETOF
--     (EPIC_2_DEPLOYMENT_FIX.md).
--   - RLS policies encode exactly the RPC's own invariant, not just row
--     ownership (EPIC_3_REVIEW.md C2, EPIC_4_REVIEW.md H2) — direct REST
--     access can never do more than the corresponding RPC allows.
--   - SECURITY DEFINER used only where a controlled cross-table write
--     requires briefly stepping outside RLS, with the function's own
--     role/tenant checks as the sole authorization gate
--     (EPIC_3_REVIEW.md C4, EPIC_4_REVIEW.md H4).
--   - Idempotency-key + payload-hash envelope for every mutating RPC that
--     is not a natural upsert (EPIC_4_REVIEW.md H3).
--   - Set-based fan-out (chained CTEs), never a per-row loop, for
--     potentially-unbounded notification recipients (EPIC_4_REVIEW.md H4);
--     a small, bounded-N loop (e.g. notifying a tenant's few managers)
--     remains acceptable, per EPIC_3_REVIEW.md L1's own explicit reasoning.
-- ============================================================================

create schema if not exists approvals;

comment on schema approvals is 'Epic 5 — teacher request -> manager approval -> published event pipeline, RSVPs, trip registrations (§2.1, §3.21-3.24).';

create type approvals.request_type as enum ('event', 'trip', 'exam');
create type approvals.exam_kind as enum ('weekly', 'monthly');
create type approvals.request_status as enum ('pending', 'approved', 'rejected');

-- events.type uses 'celebration' where requests.type uses 'event' — this is
-- an intentional, documented mapping (BACKEND_ARCHITECTURE.md §3.21 vs
-- §3.22 name the two enums differently), not a typo: a request submitted as
-- type='event' (a teacher requesting a celebration) is promoted to an
-- events row with type='celebration' by review_request (migration 5). See
-- that function's comment for the full mapping.
create type approvals.event_type as enum ('exam', 'celebration', 'trip');

create type approvals.rsvp_attendee as enum ('child', 'father', 'mother', 'both');
create type approvals.trip_registration_status as enum ('open', 'registered', 'paid', 'cancelled');
