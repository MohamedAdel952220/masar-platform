-- ============================================================================
-- Epic 4 — Communication & Notification Backbone
-- Migration 7: retroactive activation of Epic 1/3's previously-stubbed
--              notifications
-- Ref: BACKEND_EXECUTION_PLAN.md Epic 4 §1 ("retroactively activates every
--      stubbed notification from Epics 1-3 (activation links, trip/handover
--      alerts)")
--
-- Both mechanisms below are additive — a new function/RPC, and one new
-- trigger on an EXISTING Epic 1 table (platform.audit_log). Adding a
-- trigger to an existing table is a DDL statement in a NEW migration; it
-- does not edit Epic 1's migration file, its CREATE TABLE statement, or any
-- existing row/behavior of that table — the same additive pattern already
-- used throughout this project (e.g. Epic 2/3 adding FKs to Epic 1 columns,
-- Epic 3 adding a helper function to Epic 2's `academic` schema). No Epic 1
-- migration file is modified.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- platform.drain_notification_outbox — fix-forward for Epic 3's own
-- forward-compatible design: platform.notification_outbox
-- (EPIC_3_REVIEW.md H2 fix) was built specifically so "Epic 4 can drain it
-- into the real comms schema with zero data loss." This is that drain.
-- service_role only (matches the outbox table's own zero-RLS-policy design).
-- Idempotent by construction: every drained row gets dispatched_at set in
-- the same statement that reads it, via SELECT ... FOR UPDATE SKIP LOCKED,
-- so a concurrent/retried run never double-enqueues the same outbox row.
-- ---------------------------------------------------------------------------
create or replace function platform.drain_notification_outbox()
returns int
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_row     platform.notification_outbox;
  v_count   int := 0;
  v_recipient_type comms.notification_recipient_type;
begin
  for v_row in
    select * from platform.notification_outbox
    where dispatched_at is null
    order by created_at
    for update skip locked
  loop
    v_recipient_type := case v_row.recipient_type
      when 'guardian' then 'guardian'
      when 'staff' then 'staff'
      when 'driver' then 'driver'
      else null
    end;

    if v_recipient_type is not null then
      perform comms.enqueue_notification(
        v_row.tenant_id, v_recipient_type, v_row.recipient_id,
        coalesce(v_row.category, 'trip_update'),
        initcap(replace(coalesce(v_row.category, 'trip_update'), '_', ' ')),
        coalesce(v_row.payload->>'status', v_row.payload::text),
        null, 'info'
      );
    end if;

    update platform.notification_outbox set dispatched_at = now() where id = v_row.id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function platform.drain_notification_outbox is
  'Retroactively activates Epic 3''s previously-stubbed trip/handover notifications (BACKEND_EXECUTION_PLAN.md Epic 4 §1) by draining platform.notification_outbox (EPIC_3_REVIEW.md H2) into the real comms.notifications pipeline. Additive — reads/writes an existing Epic 3 table via normal DML, no Epic 3 migration file touched. Intended to be polled by the notification-dispatch Edge Function alongside its normal queue processing.';

revoke all on function platform.drain_notification_outbox from public;
grant execute on function platform.drain_notification_outbox to service_role;

-- ---------------------------------------------------------------------------
-- platform.notify_on_provisioning_event — retroactively activates Epic 1's
-- previously-stub-only "activation link sent" notifications (staff, driver,
-- tenant-manager, and enroll-child's guardian account creation) by watching
-- platform.audit_log (Epic 1, frozen) for the specific provisioning actions
-- each Epic already writes there, and enqueuing a real
-- comms.notifications row for the newly-created account.
--
-- This does NOT touch Epic 1/2/3's own activation-link dispatch code
-- (supabase/functions/_shared/activation.ts, src/services/
-- activationLinkPort.ts) — those files are frozen and are not modified.
-- What this DOES do is give the new notification pipeline visibility into
-- "an account was just provisioned," so the same event that already
-- triggers a stub WhatsApp/SMS log line also now produces a real, durable,
-- preference-respecting in-app notification + dispatch-queue entry — a
-- distinct, additive delivery path alongside (not replacing) the frozen one.
--
-- Wrapped in its own exception handler that only WARNs and never re-raises:
-- platform.audit_log is Epic 1's critical, append-only compliance trail
-- (§23) — a bug in this best-effort notification side-feature must never be
-- able to block or fail an audit_log write.
-- ---------------------------------------------------------------------------
create or replace function platform.notify_on_provisioning_event()
returns trigger
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_recipient_id uuid;
begin
  begin
    if new.action = 'added_staff' and new.target_type = 'staff_profiles' then
      perform comms.enqueue_notification(
        new.tenant_id, 'staff', new.target_id, 'account_activation',
        'Your account is ready', 'Your Masar staff account has been created. Check your phone for an activation link.'
      );
    elsif new.action = 'added_bus' and new.target_type = 'buses' then
      select driver_id into v_recipient_id from transport.buses where id = new.target_id;
      if v_recipient_id is not null then
        perform comms.enqueue_notification(
          new.tenant_id, 'driver', v_recipient_id, 'account_activation',
          'Your account is ready', 'Your Masar driver account has been created. Check your phone for an activation link.'
        );
      end if;
    elsif new.action = 'enrolled_child' and new.target_type = 'children' then
      for v_recipient_id in select guardian_id from academic.child_guardian_links where child_id = new.target_id
      loop
        perform comms.enqueue_notification(
          new.tenant_id, 'guardian', v_recipient_id, 'account_activation',
          'Your account is ready', 'Your Masar parent account has been created. Check your phone for an activation link.'
        );
      end loop;
    elsif new.action = 'provisioned_tenant' and new.target_type = 'tenant' then
      select id into v_recipient_id from identity.staff_profiles
      where tenant_id = new.target_id and role = 'manager' and deleted_at is null
      order by created_at desc limit 1;
      if v_recipient_id is not null then
        perform comms.enqueue_notification(
          new.tenant_id, 'staff', v_recipient_id, 'account_activation',
          'Your school is ready', 'Your Masar school account has been provisioned. Check your phone for an activation link.'
        );
      end if;
    elsif new.action = 'regenerated_activation_link' then
      perform comms.enqueue_notification(
        new.tenant_id, 'staff', new.target_id, 'account_activation',
        'New activation link sent', 'A new activation link was sent to your phone.'
      );
    end if;
  exception
    when others then
      raise warning 'notify_on_provisioning_event: non-fatal notification enqueue failure for audit_log id % (action=%): %', new.id, new.action, sqlerrm;
  end;

  return new;
end;
$$;

comment on function platform.notify_on_provisioning_event is
  'Retroactively activates Epic 1''s previously-stub-only provisioning notifications (BACKEND_EXECUTION_PLAN.md Epic 4 §1) by observing platform.audit_log (Epic 1, unmodified) for provisioning actions. Exceptions are caught and only warned on — never propagated — so this best-effort feature can never block or fail an audit_log write.';

create trigger trg_audit_log_notify_provisioning
  after insert on platform.audit_log
  for each row execute function platform.notify_on_provisioning_event();
