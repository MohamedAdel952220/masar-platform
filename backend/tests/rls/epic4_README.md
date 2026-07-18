# Epic 4 RLS adversarial test suite

Companion to `README.md` (Epic 1) / `epic2_README.md` / `epic3_README.md` —
kept as a separate file, same reasoning: no earlier file is modified.

These SQL scripts verify the Row Level Security policies created in
`supabase/migrations/20260719000005_epic4_rls_policies.sql` and the RPCs in
`20260719000006_epic4_rpc_functions.sql`/`20260719000007_epic4_retroactive_activation.sql`
actually hold.

## Why these are not executed as part of this delivery

Same reason as every prior Epic's suite: running them requires a live
Postgres instance with every migration through Epic 4 applied (`supabase
start` + Docker, or a real provisioned project), neither of which is
available in this sandbox.

## How to run them

```bash
supabase start                       # requires Docker
supabase db reset                    # applies every migration (Epic 1-4) + seed.sql
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2)" -f tests/rls/epic1_rls_adversarial.sql
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2)" -f tests/rls/epic2_rls_adversarial.sql
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2)" -f tests/rls/epic3_rls_adversarial.sql
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2)" -f tests/rls/epic4_rls_adversarial.sql
```

## What is covered

1. Cross-tenant isolation on `comms.conversations`/`messages` — a manager
   from Tenant B can never see Tenant A's escalated conversation.
2. A guardian/teacher who is not a named participant in a conversation
   cannot read or post to it, even within their own tenant.
3. Manager visibility is correctly scoped to `status = 'escalated'` only —
   an open (non-escalated) conversation is invisible to the manager.
4. `escalate_conversation` correctly flips status exactly once (a second
   call is cleanly rejected) and inserts a system message.
5. Announcement targeting — a guardian who was not fanned into
   `announcement_recipients` cannot see the announcement, even in their own
   tenant; a targeted guardian can.
6. `comms.notifications`/`comms.announcement_recipients` have no client
   `INSERT` policy — a direct attempt to insert a notification for oneself
   (forging an event) is rejected by RLS.
7. `comms.device_tokens`/`comms.notification_preferences` full self-service
   CRUD works for the owner and is denied for any other caller, including
   another account in the same tenant.
8. `platform.drain_notification_outbox()` correctly enqueues a
   `comms.notifications` row from an Epic 3 `notification_outbox` row and
   marks it dispatched exactly once (a second call is a no-op, not a
   duplicate notification).
9. `platform.notify_on_provisioning_event()`'s trigger never blocks or
   fails the underlying `platform.audit_log` insert, even when the
   notification enqueue path itself would error (verified by inserting an
   audit_log row referencing a nonexistent target).
