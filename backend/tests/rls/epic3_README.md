# Epic 3 RLS adversarial test suite

Companion to `README.md` (Epic 1) / `epic2_README.md` (Epic 2) — kept as a
separate file, same reasoning: neither earlier file is modified.

These SQL scripts verify the Row Level Security policies created in
`supabase/migrations/20260717000005_epic3_rls_policies.sql` and the RPCs in
`20260717000006_epic3_rpc_functions.sql` actually hold, with particular
emphasis on the pickup-pass token lookup pattern (§13.4), which
`BACKEND_ARCHITECTURE.md` explicitly calls out as needing to be
"specifically adversarially tested."

## Why these are not executed as part of this delivery

Same reason as Epic 1/2's suites: running them requires a live Postgres
instance with every migration through Epic 3 applied (`supabase start` +
Docker, or a real provisioned project), neither of which is available in
this sandbox. See `EPIC_3_COMPLETION_REPORT.md` for the full list of what
was and wasn't executed and why.

## How to run them

```bash
supabase start                       # requires Docker
supabase db reset                    # applies every migration (Epic 1 + 2 + 3) + seed.sql
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2)" -f tests/rls/epic1_rls_adversarial.sql
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2)" -f tests/rls/epic2_rls_adversarial.sql
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2)" -f tests/rls/epic3_rls_adversarial.sql
```

Run Epic 1 and Epic 2's suites first, matching the actual migration/test
order this codebase expects — Epic 3's fixtures do not depend on either
earlier suite's leftover rows (each script wraps its own fixtures in
`begin ... rollback`).

## What is covered

1. Cross-tenant isolation on `transport.buses` — a manager from Tenant B can
   never see Tenant A's bus (Test 1).
2. Driver own-bus scoping holds across tenants — a driver in Tenant B sees
   zero of Tenant A's buses/riders even with matching row shapes (Test 2),
   and a driver correctly sees their own bus/riders (Test 3).
3. Capacity lock on `transport.bus_riders` — both `assign_bus_rider` (Test
   4) and a direct `INSERT` bypassing it (Test 5, the DB-level trigger
   backstop) reject assignment past a bus's capacity.
4. `start_trip` correctly snapshots a bus's active riders, and guardian
   visibility into the resulting trip/GPS pings is scoped to guardians whose
   own child is actually on that bus (Test 6/7) — "live only" per §12.
5. `scan_pickup_pass` (§13.4) — an unknown token never leaks pass existence,
   an expired pass is correctly flagged and lazily transitioned, a revoked
   pass is correctly flagged, a valid pass succeeds, and every attempt
   (including the three invalid ones) is logged to
   `safety.pickup_scan_events` (Test 8).
6. Cross-tenant token guessing — even the exact correct token string from
   Tenant A cannot be scanned by Tenant B's reception account; it reports
   `invalid_unknown`, never leaking that the token exists in another tenant
   (Test 9).
7. `confirm_handover` cannot be called twice on the same scan event — the
   second call is rejected as already-processed (Test 10), the same
   atomic-UPDATE...WHERE pattern Epic 2's M1 fix established.
