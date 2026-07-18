-- ============================================================================
-- Epic 4 — Communication & Notification Backbone
-- Migration 1: comms schema + conversations, messages
-- Ref: BACKEND_ARCHITECTURE.md §2.1, §3.44-3.45, §4, §5, §6, §12
--
-- Epic 1, Epic 2, and Epic 3 are frozen: every migration in this Epic is
-- purely additive (new schema, new tables, new functions, new policies). No
-- existing migration file, table, column, policy, or function from Epic 1/2/3
-- is modified anywhere in Epic 4.
--
-- Every lesson from the Epic 2/3 review/fix cycles is applied proactively
-- here: cross-table tenant-consistency triggers exist from each table's
-- first migration, RLS helpers (where any are needed) are RETURNS <type>[]
-- never RETURNS SETOF, state-transition RPCs use atomic UPDATE...WHERE, and
-- direct-equality RLS checks are used wherever a table can carry its own
-- scoping column instead of a subquery.
-- ============================================================================

create schema if not exists comms;
comment on schema comms is 'Epic 4 — conversations, messages, announcements, notifications (§2.1, §3.44-3.49.2).';

create type comms.conversation_status as enum ('open', 'escalated', 'closed');
create type comms.message_sender_type as enum ('guardian', 'staff', 'system');

-- ---------------------------------------------------------------------------
-- comms.conversations  (§3.44) — one thread per guardian<->staff pair (about
-- a specific child, optionally a specific subject). staff_id is the CURRENT
-- assigned staff member (a teacher, or the manager once escalated) — not a
-- historical list; §12's "Conversations/Messages | CRU (own)" for both
-- guardian and teacher implies each side only ever sees threads they are a
-- named participant of.
-- ---------------------------------------------------------------------------
create table comms.conversations (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references tenancy.tenants(id) on delete restrict,
  guardian_id        uuid not null references identity.guardian_profiles(id) on delete restrict,
  child_id           uuid not null references academic.children(id) on delete restrict,
  subject_id         uuid null references academic.subjects(id) on delete set null,
  staff_id           uuid not null references identity.staff_profiles(id) on delete restrict,
  status             comms.conversation_status not null default 'open',
  escalated_at       timestamptz null,
  escalation_reason  text null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index conversations_tenant_idx on comms.conversations (tenant_id);
create index conversations_guardian_idx on comms.conversations (guardian_id);
create index conversations_staff_idx on comms.conversations (staff_id);
-- Fix-forward on the EPIC_2_REVIEW.md H3 lesson applied from the start:
-- manager's "R (escalated only)" read (§12) needs a fast tenant+status scan,
-- not a join — this composite index backs exactly that access path.
create index conversations_tenant_status_idx on comms.conversations (tenant_id, status);

create trigger trg_conversations_updated_at
  before update on comms.conversations
  for each row execute function public.set_updated_at();

comment on table comms.conversations is
  'One guardian<->staff thread, optionally scoped to a child/subject (§3.44). status escalated means Manager has taken over visibility (§12) — the guardian/teacher thread itself is untouched, escalation only adds a third reader.';

-- ---------------------------------------------------------------------------
-- Tenant-consistency trigger: guardian_id/child_id/staff_id/subject_id must
-- all belong to the conversation's own tenant, and child_id must actually be
-- linked to guardian_id (a guardian can't open a thread "about" a child that
-- isn't theirs) — applying the EPIC_2_REVIEW.md C1/H2 lesson from this
-- table's first migration.
-- ---------------------------------------------------------------------------
create or replace function comms.check_conversation_consistency()
returns trigger
language plpgsql
as $$
declare
  v_guardian_tenant_id  uuid;
  v_child_tenant_id     uuid;
  v_staff_tenant_id     uuid;
  v_subject_tenant_id   uuid;
  v_is_linked           boolean;
begin
  select tenant_id into v_guardian_tenant_id from identity.guardian_profiles where id = new.guardian_id and deleted_at is null;
  select tenant_id into v_child_tenant_id from academic.children where id = new.child_id and deleted_at is null;
  select tenant_id into v_staff_tenant_id from identity.staff_profiles where id = new.staff_id and deleted_at is null;

  if v_guardian_tenant_id is null or v_child_tenant_id is null or v_staff_tenant_id is null then
    raise exception 'Guardian, child, or staff member not found'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Guardian, child, or staff member not found.', 'human_message_ar', 'لم يتم العثور على ولي الأمر أو الطفل أو الموظف.')::text;
  end if;

  if v_guardian_tenant_id <> new.tenant_id or v_child_tenant_id <> new.tenant_id or v_staff_tenant_id <> new.tenant_id then
    raise exception 'guardian_id/child_id/staff_id do not all belong to the stated tenant'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'These participants do not all belong to your tenant.', 'human_message_ar', 'هؤلاء المشاركون لا ينتمون جميعًا إلى مؤسستك.')::text;
  end if;

  if new.subject_id is not null then
    select tenant_id into v_subject_tenant_id from academic.subjects where id = new.subject_id;
    if v_subject_tenant_id is null or v_subject_tenant_id <> new.tenant_id then
      raise exception 'subject_id does not belong to the stated tenant'
        using errcode = 'P0001',
              detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'This subject does not belong to your tenant.', 'human_message_ar', 'هذه المادة لا تنتمي إلى مؤسستك.')::text;
    end if;
  end if;

  select exists(
    select 1 from academic.child_guardian_links where child_id = new.child_id and guardian_id = new.guardian_id
  ) into v_is_linked;

  if not v_is_linked then
    raise exception 'This guardian is not linked to this child'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'This guardian is not linked to this child.', 'human_message_ar', 'ولي الأمر هذا غير مرتبط بهذا الطفل.')::text;
  end if;

  return new;
end;
$$;

create trigger trg_conversations_consistency
  before insert or update of guardian_id, child_id, staff_id, subject_id, tenant_id on comms.conversations
  for each row execute function comms.check_conversation_consistency();

-- ---------------------------------------------------------------------------
-- comms.messages  (§3.45) — sender_id is nullable because sender_type can be
-- 'system' (e.g. an automated escalation notice), matching the precedent
-- already set by academic.day_path_events.actor_id (Epic 2) for the same
-- "not every row has a human actor" reason.
-- ---------------------------------------------------------------------------
create table comms.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references comms.conversations(id) on delete cascade,
  tenant_id        uuid not null references tenancy.tenants(id) on delete restrict,
  sender_type      comms.message_sender_type not null,
  sender_id        uuid null,
  body             text not null check (btrim(body) <> ''),
  sent_at          timestamptz not null default now(),
  read_at          timestamptz null
);

create index messages_conversation_idx on comms.messages (conversation_id, sent_at desc);
create index messages_tenant_idx on comms.messages (tenant_id);

comment on table comms.messages is
  'Append-only within a conversation (no updated_at — only read_at ever changes after insert, via a narrow mark-as-read path). sender_id is null only for sender_type=system (e.g. an automated escalation notice), same precedent as academic.day_path_events.actor_id (Epic 2).';

-- ---------------------------------------------------------------------------
-- Tenant-consistency trigger: conversation_id must belong to the stated
-- tenant, and a non-system sender_id must actually be one of that
-- conversation's two named participants (guardian_id or staff_id) — closing
-- the same "RPC-only convenience isn't a DB-level guarantee" gap
-- EPIC_2_REVIEW.md C1 and EPIC_3_REVIEW.md C3 both fixed elsewhere, applied
-- here from the start.
-- ---------------------------------------------------------------------------
create or replace function comms.check_message_consistency()
returns trigger
language plpgsql
as $$
declare
  v_conv_tenant_id  uuid;
  v_guardian_id     uuid;
  v_staff_id        uuid;
begin
  select tenant_id, guardian_id, staff_id into v_conv_tenant_id, v_guardian_id, v_staff_id
  from comms.conversations where id = new.conversation_id;

  if v_conv_tenant_id is null then
    raise exception 'Conversation not found'
      using errcode = 'P0002',
            detail = json_build_object('code', 'NOT_FOUND', 'human_message_en', 'Conversation not found.', 'human_message_ar', 'لم يتم العثور على المحادثة.')::text;
  end if;

  if v_conv_tenant_id <> new.tenant_id then
    raise exception 'conversation_id does not belong to the stated tenant'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'This conversation does not belong to your tenant.', 'human_message_ar', 'هذه المحادثة لا تنتمي إلى مؤسستك.')::text;
  end if;

  if new.sender_type <> 'system' and new.sender_id is distinct from v_guardian_id and new.sender_id is distinct from v_staff_id then
    raise exception 'sender_id is not a participant in this conversation'
      using errcode = 'P0001',
            detail = json_build_object('code', 'VALIDATION_FAILED', 'human_message_en', 'The sender is not a participant in this conversation.', 'human_message_ar', 'المُرسِل ليس طرفًا في هذه المحادثة.')::text;
  end if;

  return new;
end;
$$;

create trigger trg_messages_consistency
  before insert on comms.messages
  for each row execute function comms.check_message_consistency();
