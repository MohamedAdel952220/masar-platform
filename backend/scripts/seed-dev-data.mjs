#!/usr/bin/env node
// Seeds a demo tenant + owner platform admin + manager account against a
// REAL, already-migrated Supabase project — via the Auth Admin API, exactly
// like the provision-tenant Edge Function does (§10.3). Never inserts
// directly into auth.users.
//
// Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the environment
// (see ../.env.example). Not run as part of this delivery — no live project
// is available in this sandbox; see EPIC_1_COMPLETION_REPORT.md.
//
// Usage: node scripts/seed-dev-data.mjs

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. Copy .env.example to .env.local and fill it in.');
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  console.log('Seeding platform admin (owner)...');
  const { data: paUser, error: paErr } = await admin.auth.admin.createUser({
    email: 'owner@masar.app',
    email_confirm: true,
    app_metadata: { role: 'platform_admin' },
    user_metadata: { name: 'Demo Owner' },
  });
  if (paErr) throw paErr;

  const { error: paProfileErr } = await admin
    .schema('identity')
    .from('platform_admins')
    .insert({ id: paUser.user.id, name: 'Demo Owner', email: 'owner@masar.app', role: 'owner' });
  if (paProfileErr) throw paProfileErr;
  console.log('  -> platform admin created:', paUser.user.id);

  console.log('Seeding demo tenant "Sunrise Nursery" via provision-tenant Edge Function...');
  const { data: sessionData, error: signInErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: 'owner@masar.app',
  });
  if (signInErr) console.warn('  (magic link generation for local testing failed, non-fatal):', signInErr.message);

  const res = await fetch(`${url}/functions/v1/provision-tenant`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceRoleKey}`, // local/dev convenience only — production callers use a real user JWT
    },
    body: JSON.stringify({
      name: 'Sunrise Nursery',
      slug: 'sunrise-dev',
      planCode: 'growth',
      contactName: 'Nadia Fouad',
      contactEmail: 'admin@sunrise.masar.app',
      ownerName: 'Nadia Fouad',
      ownerPhone: '+201002223344',
    }),
  });

  if (!res.ok) {
    console.error('provision-tenant call failed:', res.status, await res.text());
    process.exit(1);
  }

  const result = await res.json();
  console.log('  -> tenant provisioned:', result.tenant.slug, result.tenant.id);
  console.log('  -> manager account:', result.manager.name, '(activation link sent:', result.manager.activationSent, ')');
  console.log('\nSeed complete.');
}

main().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
