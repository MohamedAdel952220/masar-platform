-- ============================================================================
-- Epic 6 — Billing & Payments
-- Migration 5: RPC functions
-- Ref: BACKEND_ARCHITECTURE.md §14.2, §20, §23, §25.1, §25.2, §25.6; §16
--      Notification Matrix ("Payment received/confirmed", "Manual payment
--      stuck in pending_verification past SLA")
--
-- Error codes reused from Epic 1's already-shipped taxonomy throughout — no
-- new error code is added, no Epic 1 file is touched.
--
-- billing.settle_payment_transaction is the single internal seam every
-- ledger-settlement write path (verify_payment, refund_payment, and the
-- payment-webhook Edge Function) calls — mirroring
-- academic.set_child_day_path_status's established "one narrow SECURITY
-- DEFINER seam, several public/service callers" shape (Epic 3), and
-- directly satisfying this task's "avoid duplicate logic" requirement: the
-- financial-correctness-critical ledger-reconciliation SQL exists in
-- exactly one place, not duplicated across three call sites.
--
-- Fix for EPIC_6_REVIEW.md C1: the original reconciliation matched "which
-- obligations does this payment cover" by fee_item_id alone — every
-- billing_ledger_items/installment_schedule_entries row for the same child
-- sharing that fee_item_id got marked paid, regardless of period, specific
-- installment, or amount. Any child with more than one outstanding period
-- or installment for the same recurring fee (the normal steady state) had
-- every one of those rows silently marked fully paid the moment ANY
-- invoice referencing that fee_item_id settled — and the identical
-- over-broad match ran in reverse on refund, incorrectly un-paying
-- obligations the refunded payment never touched (including ones settled
-- entirely separately via mark_ledger_item_paid_manual/
-- mark_installment_paid_manual cash payments). Settlement/reversal now use
-- the EXPLICIT billing.invoice_lines.ledger_item_id/installment_entry_id
-- references (migration 3) instead — only the specific rows an invoice's
-- lines actually name are ever touched, in either direction. An ad-hoc
-- invoice line (neither reference set) intentionally never touches the
-- ledger at all — this is now the documented, deliberate behavior for that
-- case, not an accidental side effect of an empty array.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- billing.settle_payment_transaction — internal, service_role only. Atomic
-- UPDATE...WHERE status guard (the same M1 pattern used throughout this
-- codebase) makes this idempotent under any retry/duplicate-delivery path:
-- a second call against an already-settled transaction finds 0 rows and
-- returns null rather than re-applying the ledger update, which is exactly
-- what closes the "duplicate webhook never double-credits a ledger"
-- Acceptance Criterion (§20's provider_reference uniqueness handles
-- duplicate-webhook-as-duplicate-INSERT; this status guard handles
-- duplicate-webhook-as-duplicate-UPDATE-of-the-same-row).
-- ---------------------------------------------------------------------------
create or replace function billing.settle_payment_transaction(
  p_payment_transaction_id  uuid,
  p_new_status              billing.payment_status,
  p_actor_staff_id          uuid default null
)
returns billing.payment_transactions
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_row                    billing.payment_transactions;
  v_from_statuses          billing.payment_status[];
  v_ledger_item_ids        uuid[];
  v_installment_entry_ids  uuid[];
  v_manager                record;
  v_previous_status        billing.payment_status;
begin
  v_from_statuses := case p_new_status
    when 'succeeded' then array['initiated', 'pending_verification']::billing.payment_status[]
    when 'failed'    then array['initiated', 'pending_verification']::billing.payment_status[]
    when 'refunded'  then array['succeeded']::billing.payment_status[]
    else array[]::billing.payment_status[]
  end;

  if array_length(v_from_statuses, 1) is null then
    raise exception 'Unsupported settlement status'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'Unsupported settlement status.', 'human_message_ar', 'حالة تسوية غير مدعومة.')::text;
  end if;

  update billing.payment_transactions
  set status = p_new_status, settled_at = coalesce(settled_at, now())
  where id = p_payment_transaction_id and status = any (v_from_statuses)
  returning * into v_row;

  if v_row.id is null then
    -- Fix for EPIC_6_REVIEW.md L3: previously a bare, unlogged no-op —
    -- indistinguishable from an ordinary duplicate-webhook replay even for
    -- a genuinely unusual transition attempt (e.g. a plausible real-world
    -- failed -> succeeded correction from a bank reversing an earlier
    -- decline). Still a safe no-op (never over-apply an unexpected
    -- transition) but now leaves a trace an operator can find.
    select status into v_previous_status from billing.payment_transactions where id = p_payment_transaction_id;
    if v_previous_status is not null then
      raise warning 'settle_payment_transaction: no-op — transaction % is % (not one of %), requested %',
        p_payment_transaction_id, v_previous_status, v_from_statuses, p_new_status;
    end if;
    return null;
  end if;

  if p_new_status = 'succeeded' and v_row.invoice_id is not null then
    -- Fix for EPIC_6_REVIEW.md C1: settle ONLY the specific obligations
    -- this invoice's lines explicitly reference — never a fee_item_id-wide
    -- match (see this function's own header comment for the full
    -- before/after reasoning).
    select coalesce(array_agg(ledger_item_id) filter (where ledger_item_id is not null), array[]::uuid[]),
           coalesce(array_agg(installment_entry_id) filter (where installment_entry_id is not null), array[]::uuid[])
    into v_ledger_item_ids, v_installment_entry_ids
    from billing.invoice_lines where invoice_id = v_row.invoice_id;

    update billing.invoices set status = 'paid' where id = v_row.invoice_id and status <> 'paid';

    update billing.billing_ledger_items
    set amount_paid = amount_due, status = 'paid'
    where id = any (v_ledger_item_ids) and status <> 'paid';

    update billing.installment_schedule_entries
    set paid = true, paid_at = now(), status = 'paid'
    where id = any (v_installment_entry_ids) and status <> 'paid';

    -- §16: "Payment received/confirmed -> Child's guardians, Manager".
    insert into comms.notifications (tenant_id, recipient_type, recipient_id, category, title, body, deep_link, severity)
    select v_row.tenant_id, 'guardian', cgl.guardian_id, 'payment', 'Payment received',
           'Your payment of ' || v_row.amount::text || ' has been confirmed.',
           'app://payments/' || v_row.id::text, 'info'
    from academic.child_guardian_links cgl
    join identity.guardian_profiles g on g.id = cgl.guardian_id
    where cgl.child_id = v_row.child_id and g.deleted_at is null;

    for v_manager in select id from identity.staff_profiles where tenant_id = v_row.tenant_id and role = 'manager' and deleted_at is null
    loop
      perform comms.enqueue_notification(
        v_row.tenant_id, 'staff', v_manager.id, 'payment', 'Payment received',
        'A payment of ' || v_row.amount::text || ' was confirmed.',
        'app://payments/' || v_row.id::text
      );
    end loop;
  elsif p_new_status = 'refunded' and v_row.invoice_id is not null then
    -- Fix for EPIC_6_REVIEW.md C1: reverse ONLY the specific obligations
    -- this SAME invoice's lines reference — never a fee_item_id-wide match
    -- that could un-pay an unrelated, separately-settled obligation
    -- (§20's own "refunds only reverse obligations originally settled by
    -- the same payment" requirement, satisfied precisely because the same
    -- explicit reference set is used in both directions).
    select coalesce(array_agg(ledger_item_id) filter (where ledger_item_id is not null), array[]::uuid[]),
           coalesce(array_agg(installment_entry_id) filter (where installment_entry_id is not null), array[]::uuid[])
    into v_ledger_item_ids, v_installment_entry_ids
    from billing.invoice_lines where invoice_id = v_row.invoice_id;

    update billing.invoices set status = 'unpaid' where id = v_row.invoice_id and status = 'paid';

    update billing.billing_ledger_items
    set amount_paid = 0, status = (case when due_date < current_date then 'overdue' else 'due' end)
    where id = any (v_ledger_item_ids) and status = 'paid';

    update billing.installment_schedule_entries
    set paid = false, paid_at = null, status = (case when due_date < current_date then 'overdue' else 'due' end)
    where id = any (v_installment_entry_ids) and status = 'paid';
  end if;

  -- §23: financial state changes are audit-worthy for every terminal
  -- status this function ever reaches. actor_type is 'system' when this
  -- was triggered by the payment-webhook Edge Function (no staff member
  -- involved — p_actor_staff_id is null in that call), 'staff' when a
  -- manager decided it via verify_payment/refund_payment.
  perform public.write_audit_log(
    v_row.tenant_id,
    (case when p_actor_staff_id is null then 'system' else 'staff' end)::platform.audit_actor_type,
    p_actor_staff_id,
    'payment_' || p_new_status::text, 'payment_transactions', v_row.id
  );

  return v_row;
end;
$$;

comment on function billing.settle_payment_transaction is
  'Internal, service_role only. Sole seam that ever moves a payment_transactions row to succeeded/failed/refunded — atomic UPDATE...WHERE status guard makes every caller (verify_payment, refund_payment, the payment-webhook Edge Function) idempotent under retry/duplicate delivery. On succeeded/refunded with an invoice_id, reconciles matching billing_ledger_items/installment_schedule_entries and the invoice itself in the same transaction (§20 Acceptance Criteria).';

revoke all on function billing.settle_payment_transaction from public;
grant execute on function billing.settle_payment_transaction to service_role;

-- ---------------------------------------------------------------------------
-- public.mark_installment_paid_manual — manager only. For in-person/cash
-- payments with no payment_transactions row at all (§20: "distinct from
-- verify_payment, which always reconciles an existing guardian-submitted
-- transaction"). Atomic UPDATE...WHERE (same M1 pattern).
-- ---------------------------------------------------------------------------
create or replace function public.mark_installment_paid_manual(
  p_installment_entry_id  uuid,
  p_note                  text default null
)
returns billing.installment_schedule_entries
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_row       billing.installment_schedule_entries;
  v_child_id  uuid;
  v_exists    boolean;
begin
  if public.current_role() <> 'manager' then
    raise exception 'Only a manager can mark an installment as manually paid'
      using errcode = 'P0001',
            detail = json_build_object('code', 'PERM_ROLE_DENIED', 'human_message_en', 'Only a manager can mark an installment as manually paid.', 'human_message_ar', 'فقط المدير يمكنه وضع علامة "مدفوع يدويًا" على القسط.')::text;
  end if;

  update billing.installment_schedule_entries se
  set paid = true, paid_at = now(), status = 'paid'
  from billing.installment_plans ip
  where se.id = p_installment_entry_id and se.plan_id = ip.id and ip.tenant_id = v_tenant_id and se.status <> 'paid'
  returning se.* into v_row;

  if v_row.id is null then
    select exists(
      select 1 from billing.installment_schedule_entries se
      join billing.installment_plans ip on ip.id = se.plan_id
      where se.id = p_installment_entry_id and ip.tenant_id = v_tenant_id
    ) into v_exists;

    if not v_exists then
      raise exception 'Installment entry not found for this tenant'
        using errcode = 'P0002',
              detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Installment entry not found.', 'human_message_ar', 'لم يتم العثور على القسط.')::text;
    else
      raise exception 'This installment is already paid'
        using errcode = 'P0001',
              detail = json_build_object('code', 'STATE_ALREADY_PROCESSED', 'human_message_en', 'This installment is already paid.', 'human_message_ar', 'تم دفع هذا القسط بالفعل.')::text;
    end if;
  end if;

  select ip.child_id into v_child_id from billing.installment_plans ip where ip.id = v_row.plan_id;

  -- §16: "Payment received/confirmed -> Child's guardians, Manager".
  insert into comms.notifications (tenant_id, recipient_type, recipient_id, category, title, body, deep_link, severity)
  select v_tenant_id, 'guardian', cgl.guardian_id, 'payment', 'Payment received',
         coalesce(p_note, 'Your installment payment has been recorded.'),
         'app://payments/installments/' || v_row.id::text, 'info'
  from academic.child_guardian_links cgl
  join identity.guardian_profiles g on g.id = cgl.guardian_id
  where cgl.child_id = v_child_id and g.deleted_at is null;

  -- §23: manual cash payments marked via mark_installment_paid_manual are
  -- explicitly named as audit-worthy.
  perform public.write_audit_log(v_tenant_id, 'staff', auth.uid(), 'installment_marked_paid_manual', 'installment_schedule_entries', v_row.id);

  return v_row;
end;
$$;

comment on function public.mark_installment_paid_manual is
  'Manager-only. For in-person/cash payments with no payment_transactions row (§20). Atomic UPDATE...WHERE. Notifies guardians (§16) and writes an audit_log entry (§23). SECURITY DEFINER to reach comms.enqueue_notification-equivalent write and write_audit_log.';

revoke all on function public.mark_installment_paid_manual from public;
grant execute on function public.mark_installment_paid_manual to authenticated;

-- ---------------------------------------------------------------------------
-- public.mark_ledger_item_paid_manual — fix for EPIC_6_REVIEW.md M2:
-- billing_ledger_items_update_manager (migration 4) is now narrowed to
-- status<>'paid' (mirroring installment_schedule_entries_update_manager's
-- own established shape), so this RPC is the only path from any status to
-- 'paid' — the same "no direct RLS write path that would silently skip the
-- RPC's own notification/audit side effects" lesson
-- (EPIC_5_REVIEW.md H2) applied to the one Epic 6 table that was still
-- missing it. Manager only, for in-person/cash payments against a
-- recurring ledger obligation with no payment_transactions row (§20),
-- symmetrical to mark_installment_paid_manual above.
-- ---------------------------------------------------------------------------
create or replace function public.mark_ledger_item_paid_manual(
  p_ledger_item_id  uuid,
  p_note            text default null
)
returns billing.billing_ledger_items
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_row       billing.billing_ledger_items;
  v_exists    boolean;
begin
  if public.current_role() <> 'manager' then
    raise exception 'Only a manager can mark a ledger item as manually paid'
      using errcode = 'P0001',
            detail = json_build_object('code', 'PERM_ROLE_DENIED', 'human_message_en', 'Only a manager can mark a ledger item as manually paid.', 'human_message_ar', 'فقط المدير يمكنه وضع علامة "مدفوع يدويًا" على بند السجل.')::text;
  end if;

  update billing.billing_ledger_items
  set amount_paid = amount_due, status = 'paid'
  where id = p_ledger_item_id and tenant_id = v_tenant_id and status <> 'paid'
  returning * into v_row;

  if v_row.id is null then
    select exists(select 1 from billing.billing_ledger_items where id = p_ledger_item_id and tenant_id = v_tenant_id) into v_exists;

    if not v_exists then
      raise exception 'Ledger item not found for this tenant'
        using errcode = 'P0002',
              detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Ledger item not found.', 'human_message_ar', 'لم يتم العثور على بند السجل.')::text;
    else
      raise exception 'This ledger item is already paid'
        using errcode = 'P0001',
              detail = json_build_object('code', 'STATE_ALREADY_PROCESSED', 'human_message_en', 'This ledger item is already paid.', 'human_message_ar', 'تم دفع بند السجل هذا بالفعل.')::text;
    end if;
  end if;

  -- §16: "Payment received/confirmed -> Child's guardians, Manager".
  insert into comms.notifications (tenant_id, recipient_type, recipient_id, category, title, body, deep_link, severity)
  select v_tenant_id, 'guardian', cgl.guardian_id, 'payment', 'Payment received',
         coalesce(p_note, 'Your payment has been recorded.'),
         'app://payments/ledger/' || v_row.id::text, 'info'
  from academic.child_guardian_links cgl
  join identity.guardian_profiles g on g.id = cgl.guardian_id
  where cgl.child_id = v_row.child_id and g.deleted_at is null;

  -- §23: financial state changes are audit-worthy.
  perform public.write_audit_log(v_tenant_id, 'staff', auth.uid(), 'ledger_item_marked_paid_manual', 'billing_ledger_items', v_row.id);

  return v_row;
end;
$$;

comment on function public.mark_ledger_item_paid_manual is
  'Manager-only. For in-person/cash payments with no payment_transactions row (§20), symmetrical to mark_installment_paid_manual. Atomic UPDATE...WHERE. Notifies guardians (§16) and writes an audit_log entry (§23). Fix for EPIC_6_REVIEW.md M2.';

revoke all on function public.mark_ledger_item_paid_manual from public;
grant execute on function public.mark_ledger_item_paid_manual to authenticated;

-- ---------------------------------------------------------------------------
-- public.generate_invoice — manager only. Locks (and lazily creates) this
-- tenant's invoice_number_counters row before computing the next
-- gapless-per-tenant invoice number, serializing concurrent
-- generate_invoice calls for the same tenant (§14.3's "SELECT...FOR UPDATE
-- on the relevant capacity-holding row" convention). Creates the invoice +
-- all invoice_lines in the same transaction. Idempotency-key + payload-hash
-- envelope (EPIC_4_REVIEW.md H3 pattern) — a retried call must not create
-- two invoices (and, since invoice_number is sequential, would otherwise
-- also burn a number on every retry).
-- ---------------------------------------------------------------------------
create or replace function public.generate_invoice(
  p_child_id          uuid,
  p_items             jsonb,
  p_idempotency_key   uuid default null
)
returns billing.invoices
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_tenant_id       uuid := public.current_tenant_id();
  v_child_tenant_id uuid;
  v_next_number     int;
  v_invoice_number  text;
  v_total           numeric(10,2);
  v_invoice         billing.invoices;
  v_replay          jsonb;
  v_input_hash      text;
  v_normalized_items text;
begin
  if public.current_role() <> 'manager' then
    raise exception 'Only a manager can generate an invoice'
      using errcode = 'P0001',
            detail = json_build_object('code', 'PERM_ROLE_DENIED', 'human_message_en', 'Only a manager can generate an invoice.', 'human_message_ar', 'فقط المدير يمكنه إصدار فاتورة.')::text;
  end if;

  select tenant_id into v_child_tenant_id from academic.children where id = p_child_id and deleted_at is null;
  if v_child_tenant_id is null or v_child_tenant_id <> v_tenant_id then
    raise exception 'Child not found for this tenant'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Child not found.', 'human_message_ar', 'لم يتم العثور على الطفل.')::text;
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'items must be a non-empty array'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'At least one invoice line is required.', 'human_message_ar', 'يلزم بند واحد على الأقل للفاتورة.')::text;
  end if;

  if p_idempotency_key is not null then
    -- Fix for EPIC_6_REVIEW.md L2: hashing p_items::text directly is
    -- sensitive to jsonb's object-key-order preservation from the original
    -- parse — two calls carrying logically identical lines but built with
    -- a different per-object key order could hash differently, risking a
    -- spurious (safe-direction, but still wrong) CONFLICT_IDEMPOTENCY_KEY_REUSED.
    -- Normalizing to one fixed field order per item before hashing removes
    -- that sensitivity.
    select string_agg(
             coalesce(item->>'description', '') || ':' || coalesce(item->>'feeItemId', '') || ':' ||
             coalesce(item->>'ledgerItemId', '') || ':' || coalesce(item->>'installmentEntryId', '') || ':' ||
             coalesce(item->>'amount', ''),
             '|' order by ordinality
           )
    into v_normalized_items
    from jsonb_array_elements(p_items) with ordinality as t(item, ordinality);

    v_input_hash := md5(p_child_id::text || '|' || coalesce(v_normalized_items, ''));
    select public.idempotency_replay(p_idempotency_key) into v_replay;
    if v_replay is not null then
      if v_replay->>'_inputHash' is distinct from v_input_hash then
        raise exception 'idempotency key reused with a different payload'
          using errcode = 'P0001',
                detail = json_build_object('code', 'CONFLICT_IDEMPOTENCY_KEY_REUSED', 'human_message_en', 'This idempotency key was already used for a different request.', 'human_message_ar', 'تم استخدام مفتاح التكرار هذا بالفعل لطلب مختلف.')::text;
      end if;
      select * into v_invoice from jsonb_populate_record(null::billing.invoices, v_replay->'data');
      return v_invoice;
    end if;
  end if;

  -- Fix for EPIC_6_REVIEW.md L1: keyed on (tenant_id, year) so the
  -- sequence restarts at 1 each calendar year instead of climbing forever.
  insert into billing.invoice_number_counters (tenant_id, year, next_number)
  values (v_tenant_id, extract(year from now())::int, 1)
  on conflict (tenant_id, year) do nothing;

  update billing.invoice_number_counters
  set next_number = next_number + 1
  where tenant_id = v_tenant_id and year = extract(year from now())::int
  returning next_number - 1 into v_next_number;

  v_invoice_number := 'INV-' || to_char(now(), 'YYYY') || '-' || lpad(v_next_number::text, 5, '0');

  select coalesce(sum((item->>'amount')::numeric(10,2)), 0)
  into v_total
  from jsonb_array_elements(p_items) as item;

  if v_total <= 0 then
    raise exception 'Invoice total must be greater than zero'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'Invoice total must be greater than zero.', 'human_message_ar', 'يجب أن يكون إجمالي الفاتورة أكبر من صفر.')::text;
  end if;

  insert into billing.invoices (tenant_id, child_id, invoice_number, total, status)
  values (v_tenant_id, p_child_id, v_invoice_number, v_total, 'unpaid')
  returning * into v_invoice;

  -- Set-based (this task's own "prefer set-based SQL over row-by-row
  -- operations" requirement, and EPIC_4_REVIEW.md H4's established lesson,
  -- applied even here where the row count is naturally small — an invoice
  -- typically has a handful of lines, not thousands, but there is no
  -- reason to use a loop when a single INSERT...SELECT does the same work).
  -- Fix for EPIC_6_REVIEW.md C1: ledger_item_id/installment_entry_id carry
  -- the explicit obligation this line pays down, when the caller supplies
  -- one — billing.check_invoice_line_consistency (migration 3) validates
  -- each reference belongs to this same child/tenant and isn't already
  -- paid before the row is allowed to exist at all.
  insert into billing.invoice_lines (invoice_id, tenant_id, description, fee_item_id, ledger_item_id, installment_entry_id, amount)
  select v_invoice.id, v_tenant_id,
         item->>'description',
         nullif(item->>'feeItemId', '')::uuid,
         nullif(item->>'ledgerItemId', '')::uuid,
         nullif(item->>'installmentEntryId', '')::uuid,
         (item->>'amount')::numeric(10,2)
  from jsonb_array_elements(p_items) as item;

  perform public.write_audit_log(v_tenant_id, 'staff', auth.uid(), 'invoice_generated', 'invoices', v_invoice.id);

  if p_idempotency_key is not null then
    perform public.idempotency_store(p_idempotency_key, v_tenant_id, auth.uid(), 'generate_invoice', jsonb_build_object('_inputHash', v_input_hash, 'data', to_jsonb(v_invoice)));
  end if;

  return v_invoice;
end;
$$;

comment on function public.generate_invoice is
  'Manager-only. Locks/creates this tenant''s invoice_number_counters row for a gapless-per-tenant sequential invoice_number, then creates the invoice + invoice_lines in one transaction. Idempotency-key + payload-hash envelope (§25.6). SECURITY DEFINER to reach write_audit_log and (for retries) idempotency_replay/idempotency_store.';

revoke all on function public.generate_invoice from public;
grant execute on function public.generate_invoice to authenticated;

-- ---------------------------------------------------------------------------
-- public.verify_payment — manager only, for manual methods only (a
-- gateway-backed payment is only ever settled by the payment-webhook Edge
-- Function). Validates the transaction is actually pending_verification for
-- this manager's own tenant before delegating to
-- billing.settle_payment_transaction — this pre-check is what lets this
-- RPC distinguish NOT_FOUND / already-settled / wrong-method with a clean
-- error, something settle_payment_transaction's own generic "0 rows =
-- silent no-op" contract deliberately does not attempt (its callers are
-- expected to do their own disambiguation first).
-- ---------------------------------------------------------------------------
create or replace function public.verify_payment(
  p_payment_transaction_id  uuid,
  p_decision                billing.payment_status,
  p_note                    text default null,
  p_idempotency_key         uuid default null
)
returns billing.payment_transactions
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_tenant_id  uuid := public.current_tenant_id();
  v_existing   billing.payment_transactions;
  v_row        billing.payment_transactions;
  v_replay     jsonb;
  v_input_hash text;
begin
  if public.current_role() <> 'manager' then
    raise exception 'Only a manager can verify a payment'
      using errcode = 'P0001',
            detail = json_build_object('code', 'PERM_ROLE_DENIED', 'human_message_en', 'Only a manager can verify a payment.', 'human_message_ar', 'فقط المدير يمكنه التحقق من الدفعة.')::text;
  end if;

  if p_decision not in ('succeeded', 'failed') then
    raise exception 'decision must be succeeded or failed'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'Decision must be succeeded or failed.', 'human_message_ar', 'يجب أن يكون القرار بالنجاح أو الفشل.')::text;
  end if;

  if p_idempotency_key is not null then
    v_input_hash := md5(coalesce(p_payment_transaction_id::text, '') || '|' || coalesce(p_decision::text, '') || '|' || coalesce(p_note, ''));
    select public.idempotency_replay(p_idempotency_key) into v_replay;
    if v_replay is not null then
      if v_replay->>'_inputHash' is distinct from v_input_hash then
        raise exception 'idempotency key reused with a different payload'
          using errcode = 'P0001',
                detail = json_build_object('code', 'CONFLICT_IDEMPOTENCY_KEY_REUSED', 'human_message_en', 'This idempotency key was already used for a different request.', 'human_message_ar', 'تم استخدام مفتاح التكرار هذا بالفعل لطلب مختلف.')::text;
      end if;
      select * into v_row from jsonb_populate_record(null::billing.payment_transactions, v_replay->'data');
      return v_row;
    end if;
  end if;

  select * into v_existing from billing.payment_transactions where id = p_payment_transaction_id and tenant_id = v_tenant_id;

  if v_existing.id is null then
    raise exception 'Payment transaction not found for this tenant'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Payment transaction not found.', 'human_message_ar', 'لم يتم العثور على معاملة الدفع.')::text;
  end if;

  if v_existing.status <> 'pending_verification' then
    raise exception 'This payment is not awaiting verification'
      using errcode = 'P0001',
            detail = json_build_object('code', 'STATE_ALREADY_PROCESSED', 'human_message_en', 'This payment is not awaiting verification.', 'human_message_ar', 'هذه الدفعة ليست بانتظار التحقق.')::text;
  end if;

  v_row := billing.settle_payment_transaction(p_payment_transaction_id, p_decision, auth.uid());

  if v_row.id is null then
    -- Lost a race against a concurrent verification of the same
    -- transaction — the pre-check above passed, but settle's own atomic
    -- guard found the row already moved. Report it the same way any other
    -- already-processed race is reported elsewhere in this codebase.
    raise exception 'This payment has already been settled'
      using errcode = 'P0001',
            detail = json_build_object('code', 'STATE_ALREADY_PROCESSED', 'human_message_en', 'This payment has already been settled.', 'human_message_ar', 'تمت تسوية هذه الدفعة بالفعل.')::text;
  end if;

  if p_idempotency_key is not null then
    perform public.idempotency_store(p_idempotency_key, v_tenant_id, auth.uid(), 'verify_payment', jsonb_build_object('_inputHash', v_input_hash, 'data', to_jsonb(v_row)));
  end if;

  return v_row;
end;
$$;

comment on function public.verify_payment is
  'Manager-only. For manual-method payments in pending_verification only. Delegates the actual settlement to billing.settle_payment_transaction (sole reconciliation seam). Idempotency-key + payload-hash envelope (§25.6). SECURITY DEFINER to reach that internal, service_role-only function.';

revoke all on function public.verify_payment from public;
grant execute on function public.verify_payment to authenticated;

-- ---------------------------------------------------------------------------
-- public.refund_payment — manager only. Same pre-check + delegate shape as
-- verify_payment, for the succeeded -> refunded transition (§20: "a
-- distinct terminal state with its own ledger-reversal RPC").
-- ---------------------------------------------------------------------------
create or replace function public.refund_payment(
  p_payment_transaction_id  uuid,
  p_reason                  text default null,
  p_idempotency_key         uuid default null
)
returns billing.payment_transactions
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_tenant_id  uuid := public.current_tenant_id();
  v_existing   billing.payment_transactions;
  v_row        billing.payment_transactions;
  v_replay     jsonb;
  v_input_hash text;
begin
  if public.current_role() <> 'manager' then
    raise exception 'Only a manager can refund a payment'
      using errcode = 'P0001',
            detail = json_build_object('code', 'PERM_ROLE_DENIED', 'human_message_en', 'Only a manager can refund a payment.', 'human_message_ar', 'فقط المدير يمكنه استرداد الدفعة.')::text;
  end if;

  if p_idempotency_key is not null then
    v_input_hash := md5(coalesce(p_payment_transaction_id::text, '') || '|' || coalesce(p_reason, ''));
    select public.idempotency_replay(p_idempotency_key) into v_replay;
    if v_replay is not null then
      if v_replay->>'_inputHash' is distinct from v_input_hash then
        raise exception 'idempotency key reused with a different payload'
          using errcode = 'P0001',
                detail = json_build_object('code', 'CONFLICT_IDEMPOTENCY_KEY_REUSED', 'human_message_en', 'This idempotency key was already used for a different request.', 'human_message_ar', 'تم استخدام مفتاح التكرار هذا بالفعل لطلب مختلف.')::text;
      end if;
      select * into v_row from jsonb_populate_record(null::billing.payment_transactions, v_replay->'data');
      return v_row;
    end if;
  end if;

  select * into v_existing from billing.payment_transactions where id = p_payment_transaction_id and tenant_id = v_tenant_id;

  if v_existing.id is null then
    raise exception 'Payment transaction not found for this tenant'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Payment transaction not found.', 'human_message_ar', 'لم يتم العثور على معاملة الدفع.')::text;
  end if;

  if v_existing.status <> 'succeeded' then
    raise exception 'Only a succeeded payment can be refunded'
      using errcode = 'P0001',
            detail = json_build_object('code', 'STATE_ALREADY_PROCESSED', 'human_message_en', 'Only a succeeded payment can be refunded.', 'human_message_ar', 'يمكن استرداد الدفعات الناجحة فقط.')::text;
  end if;

  v_row := billing.settle_payment_transaction(p_payment_transaction_id, 'refunded', auth.uid());

  if v_row.id is null then
    raise exception 'This payment has already been settled'
      using errcode = 'P0001',
            detail = json_build_object('code', 'STATE_ALREADY_PROCESSED', 'human_message_en', 'This payment has already been settled.', 'human_message_ar', 'تمت تسوية هذه الدفعة بالفعل.')::text;
  end if;

  if p_idempotency_key is not null then
    perform public.idempotency_store(p_idempotency_key, v_tenant_id, auth.uid(), 'refund_payment', jsonb_build_object('_inputHash', v_input_hash, 'data', to_jsonb(v_row)));
  end if;

  return v_row;
end;
$$;

comment on function public.refund_payment is
  'Manager-only. succeeded -> refunded only. Delegates to billing.settle_payment_transaction, which reverses the matching ledger/installment/invoice rows in the same transaction. Idempotency-key + payload-hash envelope (§25.6).';

revoke all on function public.refund_payment from public;
grant execute on function public.refund_payment to authenticated;

-- ---------------------------------------------------------------------------
-- Audit hook for the one direct-RLS write path this Epic grants
-- (invoices_update_manager_void, migration 4): fires regardless of write
-- path, exactly mirroring comms.notifications' dispatch-enqueue trigger
-- (Epic 4) and platform.notify_on_provisioning_event (Epic 4) — a trigger,
-- not inline RPC logic, so "invoice voided" (§23) is audited even though
-- there is deliberately no bespoke void_invoice RPC for this single narrow
-- transition.
-- ---------------------------------------------------------------------------
create or replace function billing.audit_invoice_voided()
returns trigger
language plpgsql
as $$
begin
  perform public.write_audit_log(new.tenant_id, 'staff', auth.uid(), 'invoice_voided', 'invoices', new.id);
  return new;
end;
$$;

create trigger trg_invoices_audit_void
  after update of status on billing.invoices
  for each row
  when (old.status is distinct from new.status and new.status = 'void')
  execute function billing.audit_invoice_voided();
