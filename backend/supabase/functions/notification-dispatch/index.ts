// notification-dispatch — Edge Function
// Ref: BACKEND_ARCHITECTURE.md §26, §27; BACKEND_EXECUTION_PLAN.md Epic 4 §7, §11
//
// The central fan-out function every other Epic's stubbed/real notification
// events route through. Invoked by a scheduled poller (pg_cron webhook, per
// §26/§27 — actual cron registration is an infra/ops task outside this
// sandboxed delivery, same "staged structurally, not registered" precedent
// Epic 3 used for the GPS retention purge job) or manually by an operator.
// Authenticates via the service-role key in the Authorization header — this
// function has no human caller, matching the camera-heartbeat/scheduled-job
// authentication shape rather than requireCaller's JWT-based pattern.
//
// Per invocation: (1) drains platform.notification_outbox (Epic 3's
// retroactive-activation queue); (2) atomically claims a batch of due
// jobs.background_job_queue rows (EPIC_4_REVIEW.md C2 fix — see the claim
// call below) and processes them with batched lookups (EPIC_4_REVIEW.md M4
// fix) instead of per-job round-trips.
import { corsHeaders } from '../_shared/cors.ts';
import { toErrorResponse, AppError } from '../_shared/errors.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { sendPush, sendWhatsApp, sendSms, sendEmail } from '../_shared/notificationProviders.ts';

const BATCH_SIZE = 20;

// Default outbound-channel set per category, for notifications that don't
// already have pre-seeded notification_deliveries rows (broadcast_announcement
// pre-seeds its own selected channels — see migration 6). Covers exactly the
// categories this Epic's own RPCs/triggers produce (§16's full 25-row matrix
// spans categories that belong to not-yet-built Epics' own RPCs).
const DEFAULT_CHANNELS: Record<string, string[]> = {
  chat_message: ['push'],
  escalation: ['push'],
  account_activation: ['whatsapp', 'sms'],
  trip_update: ['push'],
};

interface NotificationRow {
  id: string;
  tenant_id: string | null;
  recipient_type: string;
  recipient_id: string;
  category: string;
  title: string;
  body: string;
  deep_link: string | null;
}

interface DeliveryRow {
  id: string;
  notification_id: string;
  channel: string;
  status: string;
}

interface JobRow {
  id: string;
  payload: { notificationId?: string };
  attempts: number;
  max_attempts: number;
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers });

  try {
    if (req.method !== 'POST') throw new AppError('VALIDATION_FAILED', 'POST required', 'مطلوب POST');

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!serviceRoleKey || authHeader !== `Bearer ${serviceRoleKey}`) {
      throw new AppError('AUTH_MISSING_TOKEN', 'This function is service-role only.', 'هذه الوظيفة مخصصة لدور الخدمة فقط.');
    }

    const admin = supabaseAdmin();

    const { data: drainedCount, error: drainErr } = await admin.rpc('drain_notification_outbox');
    if (drainErr) {
      console.error('drain_notification_outbox failed (non-fatal, retried next invocation):', drainErr);
    }

    // Fix for EPIC_4_REVIEW.md C2: previously a bare SELECT with no claim
    // step — two concurrent invocations could both select and both process
    // the same jobs, causing duplicate provider sends and a lost-update
    // race on `attempts`. jobs.claim_background_jobs (migration 4) atomically
    // flips queued -> processing using FOR UPDATE SKIP LOCKED, so only one
    // invocation can ever claim a given job.
    const { data: jobs, error: claimErr } = await admin
      .schema('jobs')
      .rpc('claim_background_jobs', { p_job_type: 'notification_dispatch', p_batch_size: BATCH_SIZE });
    if (claimErr) throw claimErr;

    const claimedJobs = (jobs ?? []) as JobRow[];
    const { succeeded, failed } = await processBatch(admin, claimedJobs);

    return new Response(
      JSON.stringify({ drained: drainedCount ?? 0, processed: claimedJobs.length, succeeded, failed }),
      { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return toErrorResponse(err, headers);
  }
});

// Fix for EPIC_4_REVIEW.md M4: previously every job in the batch performed
// 4-6+ sequential round-trips (notification fetch, pre-seeded-deliveries
// fetch, contact resolve, preferences resolve, plus a device-token fetch
// per push attempt) — up to ~120 round-trips for a full 20-job batch. Reads
// are now batched once per invocation (one query per lookup type, `IN`-ed
// across every notification in the batch) instead of once per job.
async function processBatch(admin: ReturnType<typeof supabaseAdmin>, jobs: JobRow[]): Promise<{ succeeded: number; failed: number }> {
  let succeeded = 0;
  let failed = 0;
  if (jobs.length === 0) return { succeeded, failed };

  const notificationIds = jobs.map((j) => j.payload?.notificationId).filter((id): id is string => Boolean(id));

  const { data: notifications, error: notifErr } = await admin
    .schema('comms')
    .from('notifications')
    .select('*')
    .in('id', notificationIds);
  if (notifErr) throw notifErr;
  const notificationById = new Map<string, NotificationRow>((notifications ?? []).map((n) => [n.id as string, n as NotificationRow]));

  const { data: preSeededRows, error: preSeededErr } = await admin
    .schema('comms')
    .from('notification_deliveries')
    .select('*')
    .in('notification_id', notificationIds)
    .eq('status', 'queued');
  if (preSeededErr) throw preSeededErr;
  const preSeededByNotification = new Map<string, DeliveryRow[]>();
  for (const row of (preSeededRows ?? []) as DeliveryRow[]) {
    const list = preSeededByNotification.get(row.notification_id) ?? [];
    list.push(row);
    preSeededByNotification.set(row.notification_id, list);
  }

  const recipients = [...notificationById.values()].map((n) => ({ type: n.recipient_type, id: n.recipient_id }));
  const contactByRecipient = await resolveRecipientContactsBatched(admin, recipients);
  const preferenceRows = await resolvePreferencesBatched(admin, recipients);

  const deliveryUpserts: Array<{ id: string | null; notification_id: string; channel: string; status: string; provider_message_id: string | null; failed_reason: string | null; sent_at: string | null }> = [];
  const jobUpdates: Array<{ id: string; status: string; attempts?: number; last_error?: string; next_attempt_at?: string; completed_at?: string }> = [];

  for (const job of jobs) {
    const notificationId = job.payload?.notificationId;
    const notification = notificationId ? notificationById.get(notificationId) : undefined;
    try {
      if (!notification) throw new Error(`notification ${notificationId ?? '(missing)'} not found`);

      const preSeeded = preSeededByNotification.get(notification.id) ?? [];
      const channels = preSeeded.length > 0 ? preSeeded.map((d) => d.channel) : DEFAULT_CHANNELS[notification.category] ?? [];
      const contact = contactByRecipient.get(`${notification.recipient_type}:${notification.recipient_id}`) ?? { phone: null, email: null };
      const prefs = preferenceRows.filter((p) => p.recipient_type === notification.recipient_type && p.recipient_id === notification.recipient_id && p.category === notification.category);

      for (const channel of channels) {
        const pref = prefs.find((p) => p.channel === channel);
        const enabled = pref ? pref.enabled : true; // default true (opt-out model, §16)
        const existing = preSeeded.find((d) => d.channel === channel) ?? null;

        if (!enabled) {
          deliveryUpserts.push({ id: existing?.id ?? null, notification_id: notification.id, channel, status: 'skipped_by_preference', provider_message_id: null, failed_reason: null, sent_at: null });
          continue;
        }

        try {
          const result = await deliverOnChannel(admin, channel, contact, notification);
          deliveryUpserts.push({
            id: existing?.id ?? null,
            notification_id: notification.id,
            channel,
            status: result.delivered ? 'sent' : 'failed',
            provider_message_id: result.providerMessageId,
            failed_reason: result.failedReason,
            sent_at: result.delivered ? new Date().toISOString() : null,
          });
        } catch (err) {
          deliveryUpserts.push({ id: existing?.id ?? null, notification_id: notification.id, channel, status: 'failed', provider_message_id: null, failed_reason: err instanceof Error ? err.message : String(err), sent_at: null });
        }
      }

      jobUpdates.push({ id: job.id, status: 'succeeded', completed_at: new Date().toISOString() });
      succeeded += 1;
    } catch (err) {
      const attempts = job.attempts + 1;
      const isExhausted = attempts >= job.max_attempts;
      jobUpdates.push({
        id: job.id,
        status: isExhausted ? 'failed' : 'queued',
        attempts,
        last_error: err instanceof Error ? err.message : String(err),
        next_attempt_at: new Date(Date.now() + Math.min(30_000 * 2 ** attempts, 30 * 60_000)).toISOString(),
      });
      failed += 1;
      console.error(`notification_dispatch job ${job.id} failed (attempt ${attempts}):`, err);

      // Fix for EPIC_4_REVIEW.md M2: §16 documents a "background job
      // repeatedly failing (past retry cap)" alert to Manager/Platform
      // Admin — previously nothing ever produced it, so the one safety net
      // for "the notification pipeline itself is broken" never fired.
      if (isExhausted) {
        await alertOnExhaustedJob(admin, notification ?? null).catch((alertErr) =>
          console.error(`Failed to enqueue job-repeatedly-failing alert for job ${job.id} (non-fatal):`, alertErr),
        );
      }
    }
  }

  for (const upsert of deliveryUpserts) {
    const { id, ...row } = upsert;
    if (id) {
      await admin.schema('comms').from('notification_deliveries').update(row).eq('id', id);
    } else {
      await admin.schema('comms').from('notification_deliveries').insert(row);
    }
  }

  for (const update of jobUpdates) {
    const { id, ...row } = update;
    await admin.schema('jobs').from('background_job_queue').update(row).eq('id', id);
  }

  return { succeeded, failed };
}

// Fix for EPIC_4_REVIEW.md M2 — see the call site above.
async function alertOnExhaustedJob(admin: ReturnType<typeof supabaseAdmin>, notification: NotificationRow | null) {
  if (notification?.tenant_id) {
    const { data: managers } = await admin
      .schema('identity')
      .from('staff_profiles')
      .select('id')
      .eq('tenant_id', notification.tenant_id)
      .eq('role', 'manager')
      .is('deleted_at', null);
    for (const manager of managers ?? []) {
      await admin.schema('comms').rpc('enqueue_notification', {
        p_tenant_id: notification.tenant_id,
        p_recipient_type: 'staff',
        p_recipient_id: manager.id,
        p_category: 'system',
        p_title: 'A background job is repeatedly failing',
        p_body: 'A notification dispatch job exceeded its retry limit and needs attention.',
        p_severity: 'attention',
      });
    }
    return;
  }

  const { data: platformAdmins } = await admin.schema('identity').from('platform_admins').select('id').is('deleted_at', null);
  for (const admin_ of platformAdmins ?? []) {
    await admin.schema('comms').rpc('enqueue_notification', {
      p_tenant_id: null,
      p_recipient_type: 'platform_admin',
      p_recipient_id: admin_.id,
      p_category: 'system',
      p_title: 'A background job is repeatedly failing',
      p_body: 'A platform-scoped notification dispatch job exceeded its retry limit and needs attention.',
      p_severity: 'attention',
    });
  }
}

async function deliverOnChannel(
  admin: ReturnType<typeof supabaseAdmin>,
  channel: string,
  contact: { phone: string | null; email: string | null },
  notification: NotificationRow,
) {
  if (channel === 'push') {
    const { data: tokens } = await admin
      .schema('comms')
      .from('device_tokens')
      .select('id, token')
      .eq('recipient_type', notification.recipient_type)
      .eq('recipient_id', notification.recipient_id);
    if (!tokens || tokens.length === 0) {
      return { delivered: false, providerMessageId: null, failedReason: 'no_device_token' };
    }
    // Best-of-N: at least one token accepting delivery counts as delivered.
    let delivered = false;
    let messageId: string | null = null;
    for (const t of tokens) {
      const result = await sendPush({ token: t.token as string, title: notification.title, body: notification.body, deepLink: notification.deep_link });
      if (result.delivered) {
        delivered = true;
        messageId = result.providerMessageId;
      } else if (result.invalidToken) {
        // Fix for EPIC_4_REVIEW.md M3: §27 "Device token invalidation" —
        // previously no code path ever removed a token the provider
        // reported as dead; scaffolded here so it's not forgotten once a
        // real push provider (which can actually report this) is wired in.
        await admin.schema('comms').from('device_tokens').delete().eq('id', t.id as string);
      }
    }
    return { delivered, providerMessageId: messageId, failedReason: delivered ? null : 'all_tokens_failed' };
  }

  if (channel === 'whatsapp') {
    if (!contact.phone) return { delivered: false, providerMessageId: null, failedReason: 'no_phone_on_file' };
    return sendWhatsApp({ phone: contact.phone, title: notification.title, body: notification.body });
  }

  if (channel === 'sms') {
    if (!contact.phone) return { delivered: false, providerMessageId: null, failedReason: 'no_phone_on_file' };
    return sendSms({ phone: contact.phone, body: notification.body });
  }

  if (channel === 'email') {
    if (!contact.email) return { delivered: false, providerMessageId: null, failedReason: 'no_email_on_file' };
    return sendEmail({ email: contact.email, title: notification.title, body: notification.body });
  }

  return { delivered: false, providerMessageId: null, failedReason: `unsupported_channel:${channel}` };
}

async function resolveRecipientContactsBatched(
  admin: ReturnType<typeof supabaseAdmin>,
  recipients: Array<{ type: string; id: string }>,
): Promise<Map<string, { phone: string | null; email: string | null }>> {
  const result = new Map<string, { phone: string | null; email: string | null }>();
  const idsByType: Record<string, Set<string>> = { guardian: new Set(), staff: new Set(), driver: new Set(), platform_admin: new Set() };
  for (const r of recipients) idsByType[r.type]?.add(r.id);

  if (idsByType.guardian.size > 0) {
    const { data } = await admin.schema('identity').from('guardian_profiles').select('id, phone, email').in('id', [...idsByType.guardian]);
    for (const row of data ?? []) result.set(`guardian:${row.id}`, { phone: (row.phone as string | undefined) ?? null, email: (row.email as string | undefined) ?? null });
  }
  if (idsByType.staff.size > 0) {
    const { data } = await admin.schema('identity').from('staff_profiles').select('id, phone, email').in('id', [...idsByType.staff]);
    for (const row of data ?? []) result.set(`staff:${row.id}`, { phone: (row.phone as string | undefined) ?? null, email: (row.email as string | undefined) ?? null });
  }
  if (idsByType.driver.size > 0) {
    // identity.driver_profiles has no `email` column (Epic 1) — phone only.
    const { data } = await admin.schema('identity').from('driver_profiles').select('id, phone').in('id', [...idsByType.driver]);
    for (const row of data ?? []) result.set(`driver:${row.id}`, { phone: (row.phone as string | undefined) ?? null, email: null });
  }
  if (idsByType.platform_admin.size > 0) {
    // identity.platform_admins has no `phone` column (Epic 1) — email only.
    const { data } = await admin.schema('identity').from('platform_admins').select('id, email').in('id', [...idsByType.platform_admin]);
    for (const row of data ?? []) result.set(`platform_admin:${row.id}`, { phone: null, email: (row.email as string | undefined) ?? null });
  }

  return result;
}

async function resolvePreferencesBatched(
  admin: ReturnType<typeof supabaseAdmin>,
  recipients: Array<{ type: string; id: string }>,
): Promise<Array<{ recipient_type: string; recipient_id: string; category: string; channel: string; enabled: boolean }>> {
  const uniqueIds = [...new Set(recipients.map((r) => r.id))];
  if (uniqueIds.length === 0) return [];
  const { data } = await admin.schema('comms').from('notification_preferences').select('recipient_type, recipient_id, category, channel, enabled').in('recipient_id', uniqueIds);
  return (data ?? []) as Array<{ recipient_type: string; recipient_id: string; category: string; channel: string; enabled: boolean }>;
}
