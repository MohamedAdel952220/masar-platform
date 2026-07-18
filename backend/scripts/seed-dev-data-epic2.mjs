#!/usr/bin/env node
// Continues seed-dev-data.mjs (Epic 1): seeds a classroom, a teacher/reception
// staff pair (via add-staff), and one enrolled child + guardian (via
// enroll-child) against the SAME demo tenant that script creates.
//
// Kept as a separate script rather than appended to seed-dev-data.mjs so
// that Epic 1 file is never modified. Run seed-dev-data.mjs first.
//
// Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + SUPABASE_ANON_KEY in
// the environment. Not run as part of this delivery — no live project is
// available in this sandbox; see EPIC_2_COMPLETION_REPORT.md / EPIC_2_FIX_REPORT.md.
//
// Usage: node scripts/seed-dev-data-epic2.mjs

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!url || !serviceRoleKey || !anonKey) {
  console.error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_ANON_KEY must be set. Copy .env.example to .env.local and fill it in.');
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

// Fix for EPIC_2_REVIEW.md L6: the previous version of this script sent the
// service_role key itself as the `Authorization: Bearer` header on calls to
// add-staff/enroll-child. That is not a user JWT — requireCaller()'s
// `client.auth.getUser()` call would not resolve a user from it in a real
// environment (this only went unnoticed because the script was never run
// against a live project). This mints a REAL manager session instead: set a
// one-time temporary password on the seed manager account (an account
// normally has none — activation-link-only per §10.3), sign in with it via
// an anon-key client to obtain a real access token, then use that token.
async function getManagerAccessToken(managerId, managerPhone) {
  const tempPassword = `seed-${crypto.randomUUID()}`;
  const { error: pwErr } = await admin.auth.admin.updateUserById(managerId, { password: tempPassword });
  if (pwErr) throw new Error(`Failed to set temporary seed password on manager account: ${pwErr.message}`);

  const anonClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: signInData, error: signInErr } = await anonClient.auth.signInWithPassword({ phone: managerPhone, password: tempPassword });
  if (signInErr || !signInData.session) {
    throw new Error(`Failed to sign in as seed manager: ${signInErr?.message ?? 'no session returned'}`);
  }
  return signInData.session.access_token;
}

async function main() {
  console.log('Looking up demo tenant "sunrise-dev" (created by seed-dev-data.mjs)...');
  const { data: tenant, error: tenantErr } = await admin.schema('tenancy').from('tenants').select('id').eq('slug', 'sunrise-dev').single();
  if (tenantErr || !tenant) {
    console.error('Demo tenant not found — run scripts/seed-dev-data.mjs first.', tenantErr);
    process.exit(1);
  }

  const { data: manager, error: managerErr } = await admin
    .schema('identity')
    .from('staff_profiles')
    .select('id, phone')
    .eq('tenant_id', tenant.id)
    .eq('role', 'manager')
    .is('deleted_at', null)
    .limit(1)
    .single();
  if (managerErr || !manager) {
    console.error('Demo manager not found — run scripts/seed-dev-data.mjs first.', managerErr);
    process.exit(1);
  }

  console.log('Minting a real manager session (fix for EPIC_2_REVIEW.md L6)...');
  const managerAccessToken = await getManagerAccessToken(manager.id, manager.phone);

  console.log('Seeding a demo classroom...');
  const { data: classroom, error: classroomErr } = await admin
    .schema('academic')
    .from('classrooms')
    .insert({ tenant_id: tenant.id, name: 'KG1 - Sunshine Room', grade: 'kg1', age_min_months: 36, age_max_months: 48, capacity: 20, color_tag: 'teal' })
    .select('id')
    .single();
  if (classroomErr) throw classroomErr;
  console.log('  -> classroom created:', classroom.id);

  console.log('Adding a demo teacher via add-staff Edge Function...');
  const staffRes = await fetch(`${url}/functions/v1/add-staff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${managerAccessToken}` },
    body: JSON.stringify({ role: 'teacher', name: 'Sara Mahmoud', phone: '+201009998888' }),
  });
  if (!staffRes.ok) {
    console.error('add-staff call failed:', staffRes.status, await staffRes.text());
    process.exit(1);
  }
  const staffResult = await staffRes.json();
  console.log('  -> teacher added:', staffResult.staff.name, '(activation link sent:', staffResult.staff.activationSent, ')');

  console.log('Enrolling a demo child via enroll-child Edge Function...');
  const childRes = await fetch(`${url}/functions/v1/enroll-child`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${managerAccessToken}` },
    body: JSON.stringify({
      classroomId: classroom.id,
      // Guardian phone deliberately distinct from the manager's own
      // (+201002223344, set in seed-dev-data.mjs) — the two scripts
      // previously collided on the same phone number, which would have
      // made this call fail with VALIDATION_DUPLICATE_PHONE the first time
      // this script was ever actually run.
      child: { name: 'Yousef Adel', dob: '2020-05-14', gender: 'male', package: 'full_day' },
      guardian: { name: 'Mona Adel', phone: '+201005556677', relation: 'mother' },
    }),
  });
  if (!childRes.ok) {
    console.error('enroll-child call failed:', childRes.status, await childRes.text());
    process.exit(1);
  }
  const childResult = await childRes.json();
  console.log('  -> child enrolled:', childResult.child.name, '/ guardian:', childResult.guardian.name, '(new guardian:', childResult.guardian.isNew, ')');

  console.log('\nSeed complete.');
}

main().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
