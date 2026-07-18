-- ============================================================================
-- Epic 2 — Core Academic Data
-- Migration 1: academic schema
-- Ref: BACKEND_ARCHITECTURE.md §2.1, §33; EPIC_2_ARCHITECTURE_REVIEW.md §2
--
-- Note: staff_subjects / staff_leave_records / staff_feedback belong to the
-- `identity` schema (owned by the Identity module per §33) even though they
-- ship in this Epic — see migration 4. This migration only introduces the
-- new `academic` schema itself and does not touch any Epic 1 schema/table
-- definition (Epic 1 is never modified — this is a pure addition).
-- ============================================================================

create schema if not exists academic;

comment on schema academic is
  'Epic 2 — classrooms, children, guardianship links, attendance, lessons, evaluations, concerns.';
