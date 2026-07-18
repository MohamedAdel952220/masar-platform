-- ============================================================================
-- Epic 3 — Transport & Safety
-- Migration 1: schemas
-- Ref: BACKEND_ARCHITECTURE.md §2.1, §3.25-3.32
--
-- Epic 1 and Epic 2 are frozen (per the Epic 3 kickoff instruction): this
-- migration and every migration that follows in this Epic is purely additive
-- — no existing migration file, table, column, policy, or function from
-- Epic 1/2 is modified anywhere in Epic 3.
-- ============================================================================

create schema if not exists transport;
create schema if not exists safety;

comment on schema transport is 'Epic 3 — buses, riders, trips, stops, GPS pings (§2.1, §3.25-3.30).';
comment on schema safety is 'Epic 3 — pickup passes and scan events (§2.1, §3.31-3.32).';
