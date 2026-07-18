-- ============================================================================
-- Epic 7 — Media & Camera Architecture
-- Migration 1: media schema + enums
-- Ref: BACKEND_ARCHITECTURE.md §3.33, §3.34, §17; BACKEND_EXECUTION_PLAN.md Epic 7
--
-- Scope note (documented, not implicit): BACKEND_EXECUTION_PLAN.md Epic 7 §5
-- names only `cameras`, `camera_classroom_links`, and `service_accounts`
-- (first real rows — the table itself already exists, created ahead of time
-- in Epic 1 migration 20260714000003 per that migration's own comment
-- "schema only in Epic 1, first rows in Epic 7"). `media.storage_objects`
-- (§3.35) and the generic request_upload/finalize_upload upload architecture
-- (§22) are NOT part of any Epic's own §5/§7/§8 execution-plan entries found
-- anywhere in BACKEND_EXECUTION_PLAN.md — every prior Epic's own
-- direct-RLS-bucket-write pattern (identity-documents, academic-attachments,
-- chat-attachments, payment-receipts) was each epic's own deliberate,
-- already-audited substitute for that generic architecture, not a
-- placeholder waiting on this Epic. This migration therefore creates the
-- `media` schema plus exactly the two new tables Epic 7's execution plan
-- names — no `storage_objects` table is created here. See
-- EPIC_7_COMPLETION_REPORT.md's Known Limitations for the full reasoning.
--
-- identity.service_accounts, identity.service_account_purpose, and
-- identity.service_account_status already exist (Epic 1, frozen) — this
-- migration does not touch them. Epic 7 is the first Epic to actually write
-- rows into that table (via the issue-service-account-key Edge Function).
-- ============================================================================

create schema if not exists media;

-- §3.33 — zone/resolution are closed enums matching the frontend's own
-- camera-registration form options.
create type media.camera_zone as enum ('classroom', 'outdoor', 'rest', 'entrance', 'common');
create type media.camera_resolution as enum ('720p', '1080p', '4k');

comment on schema media is
  'Camera registry, classroom linkage, and heartbeat/stream-token metadata (§17, §33). Video transport itself is explicitly out of this schema''s scope — see §17''s own "Postgres/Supabase stores camera metadata only" boundary.';
