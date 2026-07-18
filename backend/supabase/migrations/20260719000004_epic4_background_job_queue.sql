-- ============================================================================
-- Epic 4 — Communication & Notification Backbone
-- Migration 4: jobs.background_job_queue
-- Ref: BACKEND_ARCHITECTURE.md §3.53.3, §26, §33
--
-- Additive extension of Epic 1's already-existing `jobs` schema (Epic 1's own
-- migration 1 comment: "Epic 1 introduces idempotency_keys only") — the same
-- cross-epic schema-accretion pattern already used repeatedly (Epic 2 adding
-- to `identity`/`academic`, Epic 3 adding to `academic`/`platform`). No Epic 1
-- migration file is modified; this is a new table in an existing schema.
-- ============================================================================

create type jobs.background_job_status as enum ('queued', 'processing', 'succeeded', 'failed');

-- ---------------------------------------------------------------------------
-- jobs.background_job_queue  (§3.53.3) — the polling-queue table for
-- event-triggered background jobs needing at-least-once + ordered retry
-- guarantees beyond a bare database webhook (§26) — notification dispatch is
-- this table's first real consumer.
-- ---------------------------------------------------------------------------
create table jobs.background_job_queue (
  id              uuid primary key default gen_random_uuid(),
  job_type        text not null check (btrim(job_type) <> ''),
  payload         jsonb not null default '{}'::jsonb,
  status          jobs.background_job_status not null default 'queued',
  attempts        int not null default 0,
  max_attempts    int not null default 5,
  next_attempt_at timestamptz not null default now(),
  last_error      text null,
  created_at      timestamptz not null default now(),
  completed_at    timestamptz null
);

-- Backs the dispatch Edge Function's own poll query exactly: "give me queued
-- (or due-for-retry) jobs of a given type, oldest first."
create index background_job_queue_poll_idx on jobs.background_job_queue (job_type, next_attempt_at) where status in ('queued', 'processing');
create index background_job_queue_status_idx on jobs.background_job_queue (status);

comment on table jobs.background_job_queue is
  '§3.53.3 — the operational queue itself (not just metadata about it, per the v0-draft naming correction the architecture doc already made). No RLS policy for any client role (migration 5) — service_role only, polled exclusively by the notification-dispatch Edge Function and any future Epic''s background job.';

-- ---------------------------------------------------------------------------
-- jobs.claim_background_jobs — fix for EPIC_4_REVIEW.md C2: the original
-- notification-dispatch Edge Function SELECTed a batch of queued/due jobs
-- and only updated their status AFTER processing, with no atomic claim step
-- — two concurrent invocations (overlapping cron fires, a manual invocation
-- racing a scheduled one, or a caller retry while the first invocation is
-- still in flight) would both SELECT the identical batch and both process
-- every job in it, causing duplicate real-world provider sends and a
-- lost-update race on the `attempts` counter. This RPC is that atomic claim
-- — `SELECT ... FOR UPDATE SKIP LOCKED` wrapped in an `UPDATE ... WHERE id
-- IN (...)` so the row-lock and the status flip to 'processing' happen in
-- one statement, the same technique `platform.drain_notification_outbox`
-- (Epic 3/4 boundary, migration 7) already used correctly — applied here to
-- the higher-traffic queue it was missing from. Two concurrent callers can
-- now never claim the same row: the second caller's SKIP LOCKED simply
-- excludes whatever the first has already locked.
-- ---------------------------------------------------------------------------
create or replace function jobs.claim_background_jobs(
  p_job_type    text,
  p_batch_size  int default 20
)
returns setof jobs.background_job_queue
security definer
set search_path = ''
language plpgsql
as $$
begin
  return query
  update jobs.background_job_queue q
  set status = 'processing'
  from (
    select id from jobs.background_job_queue
    where job_type = p_job_type
      and status = 'queued'
      and next_attempt_at <= now()
    order by created_at
    limit p_batch_size
    for update skip locked
  ) claimed
  where q.id = claimed.id
  returning q.*;
end;
$$;

comment on function jobs.claim_background_jobs is
  'Fix for EPIC_4_REVIEW.md C2 — atomically claims a batch of due jobs (queued -> processing) using FOR UPDATE SKIP LOCKED, so concurrent notification-dispatch invocations can never both process the same job. service_role only.';

revoke all on function jobs.claim_background_jobs from public;
grant execute on function jobs.claim_background_jobs to service_role;
