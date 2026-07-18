-- ============================================================================
-- Epic 8 — AI Report Architecture
-- Migration 1: reports schema + enums
-- Ref: BACKEND_ARCHITECTURE.md §3.19, §3.20, §3.20.1, §19; BACKEND_EXECUTION_PLAN.md Epic 8
-- ============================================================================

create schema if not exists reports;

-- §3.19 — ai_report_batches.type
create type reports.report_type as enum ('monthly_progress', 'subject_report', 'behavior_social', 'attendance_summary');

-- §3.19 — ai_report_batches.scope
create type reports.report_scope as enum ('classroom', 'children');

-- §3.20 — ai_report_drafts.status. §19: "No AI-authored content is ever
-- auto-sent without a human decision point" — 'ready'/'sent' only ever
-- reached via an explicit staff action (migration 5's RPCs), never a raw
-- RLS UPDATE (migration 4 deliberately narrows the one RLS UPDATE policy
-- that exists to exclude these two values, mirroring the established
-- EPIC_6_REVIEW.md M2 "narrow the UPDATE policy to exclude the
-- RPC-owned terminal states" pattern).
create type reports.report_draft_status as enum ('draft', 'ready', 'scheduled', 'sent');

-- §3.20 — ai_report_drafts.delivery_channels "text[] (subset of: app,
-- whatsapp, email)" — implemented as a closed enum array rather than a
-- free-text array so an invalid channel value is a constraint violation,
-- not a silently-accepted typo (matches this codebase's general preference
-- for enums over free text wherever the doc names a closed set).
create type reports.delivery_channel as enum ('app', 'whatsapp', 'email');

comment on schema reports is
  'AI-assisted report drafting, human-in-the-loop review/send, and the per-tenant daily AI usage cap (§19, §33). The LLM itself never has write access to any table in this schema — every status transition beyond draft/ready is staff-initiated (migration 5).';
