-- ============================================================================
-- Epic 1 seed data — reference data only.
--
-- Tenant / staff / platform-admin seed rows are intentionally NOT created
-- here: every human identity in this system must be created through the
-- Supabase Auth Admin API (never a raw `insert into auth.users`, §10.3) so
-- that password/activation state is set up correctly by GoTrue itself.
-- See scripts/seed-dev-data.mjs for the equivalent "seed a demo tenant +
-- owner + manager" flow, implemented by calling the same service layer the
-- provision-tenant Edge Function uses.
-- ============================================================================

insert into tenancy.plan_catalog (code, monthly_price, setup_fee, max_children)
values
  ('starter', 4000.00, 8000.00, 40),
  ('growth',  7500.00, 12000.00, 100),
  ('premium', 11000.00, 18000.00, null)
on conflict (code) do nothing;

insert into tenancy.plan_catalog_apps (plan_id, app_code)
select p.id, a.app_code
from tenancy.plan_catalog p
cross join (values
  ('starter', 'dashboard'::tenancy.app_code),
  ('starter', 'parent'),
  ('growth',  'dashboard'),
  ('growth',  'parent'),
  ('growth',  'teacher'),
  ('growth',  'reception'),
  ('premium', 'dashboard'),
  ('premium', 'parent'),
  ('premium', 'teacher'),
  ('premium', 'reception'),
  ('premium', 'driver')
) as a(plan_code, app_code)
where p.code::text = a.plan_code
on conflict do nothing;
