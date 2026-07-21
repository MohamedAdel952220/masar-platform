import { getSupabaseClient } from '../client';
import type { Row } from '../types/helpers';

/**
 * REALTIME — the complete §15 channel matrix (FRONTEND_ARCHITECTURE.md §10).
 *
 * Channels are RLS-scoped, not separately authorized: subscribing to a trip
 * that does not carry your child simply yields no rows, because the underlying
 * SELECT policy already filters it.
 *
 * Rules encoded here:
 *  - Always the narrowest filter (trip_id / conversation_id / recipient_id),
 *    never a tenant-wide firehose.
 *  - One multiplexed socket per app; subscriptions are reference-counted so two
 *    components watching one trip share a single channel.
 *  - Every subscribe returns an unsubscribe function tied to component lifetime.
 *  - Realtime is an accelerator, never the sole source: every subscribed view
 *    must also render correctly from a plain fetch.
 */

export type ChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

/** A postgres_changes payload, typed to the row of the watched relation. */
export interface ChangePayload<TRow> {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: TRow | null;
  old: Partial<TRow> | null;
  schema: string;
  table: string;
}

interface ChannelSpec {
  schema: string;
  table: string;
  event: ChangeEvent;
  filter?: string;
}

/** Canonical channel names — the only place these strings are constructed. */
export const channelNames = {
  tripPosition: (tripId: string) => 'trip:' + tripId + ':position',
  tripStatus: (tripId: string) => 'trip:' + tripId + ':status',
  classroomDayPath: (classroomId: string) => 'classroom:' + classroomId + ':day_path',
  conversationMessages: (conversationId: string) => 'conversation:' + conversationId + ':messages',
  userNotifications: (recipientId: string) => 'user:' + recipientId + ':notifications',
  tenantCameras: (tenantId: string) => 'tenant:' + tenantId + ':cameras',
  tenantCamerasHeartbeat: (tenantId: string) => 'tenant:' + tenantId + ':cameras:heartbeat',
  tenantActivity: (tenantId: string) => 'tenant:' + tenantId + ':activity',
  tenantApprovals: (tenantId: string) => 'tenant:' + tenantId + ':approvals',
  platformServiceHealth: () => 'platform:service_health',
  platformTenants: () => 'platform:tenants',
  platformSupportTickets: () => 'platform:support_tickets',
} as const;

// ---------------------------------------------------------------------------
// Reference-counted channel registry — one socket, shared subscriptions.
// ---------------------------------------------------------------------------

type Channel = ReturnType<ReturnType<typeof getSupabaseClient>['channel']>;

interface Entry {
  channel: Channel;
  listeners: Set<(payload: unknown) => void>;
}

const registry = new Map<string, Entry>();

function subscribeRaw(
  channelName: string,
  specs: ChannelSpec[],
  handler: (payload: unknown) => void,
): () => void {
  const supabase = getSupabaseClient();
  let entry = registry.get(channelName);

  if (!entry) {
    const channel = supabase.channel(channelName);
    const listeners = new Set<(payload: unknown) => void>();
    for (const spec of specs) {
      channel.on(
        'postgres_changes' as never,
        {
          event: spec.event,
          schema: spec.schema,
          table: spec.table,
          ...(spec.filter ? { filter: spec.filter } : {}),
        } as never,
        (payload: unknown) => {
          for (const fn of listeners) fn(payload);
        },
      );
    }
    void channel.subscribe();
    entry = { channel, listeners };
    registry.set(channelName, entry);
  }

  entry.listeners.add(handler);

  return () => {
    const current = registry.get(channelName);
    if (!current) return;
    current.listeners.delete(handler);
    if (current.listeners.size === 0) {
      registry.delete(channelName);
      void getSupabaseClient().removeChannel(current.channel);
    }
  };
}

/** Tears down every channel — call on logout so no socket outlives a session. */
export function unsubscribeAllChannels(): void {
  const supabase = getSupabaseClient();
  for (const [name, entry] of registry) {
    registry.delete(name);
    void supabase.removeChannel(entry.channel);
  }
}

function makeSubscriber<TRow>(channelName: string, specs: ChannelSpec[]) {
  return (onChange: (payload: ChangePayload<TRow>) => void): (() => void) =>
    subscribeRaw(channelName, specs, (raw) => onChange(raw as ChangePayload<TRow>));
}

// ---------------------------------------------------------------------------
// The §15 channel subscriptions, each typed to the row it delivers.
// ---------------------------------------------------------------------------

type GpsPing = Row<'transport', 'gps_pings'>;
type Trip = Row<'transport', 'trips'>;
type TripChildStatus = Row<'transport', 'trip_child_status'>;
type DayPathEvent = Row<'academic', 'day_path_events'>;
type Message = Row<'comms', 'messages'>;
type Notification = Row<'comms', 'notifications'>;
type Camera = Row<'media', 'cameras'>;
type ActivityLog = Row<'platform', 'activity_log'>;
type ApprovalRequest = Row<'approvals', 'requests'>;
type ServiceHealth = Row<'platform', 'service_health_status'>;
type Tenant = Row<'tenancy', 'tenants'>;
type SupportTicket = Row<'platform', 'support_tickets'>;

export const realtime = {
  /** trip:{id}:position — GPS inserts. Throttle UI to <=1 render/s (§15). */
  tripPosition: (tripId: string) =>
    makeSubscriber<GpsPing>(channelNames.tripPosition(tripId), [
      { schema: 'transport', table: 'gps_pings', event: 'INSERT', filter: 'trip_id=eq.' + tripId },
    ]),

  /** trip:{id}:status — trip and per-child status updates. */
  tripStatus: (tripId: string) =>
    makeSubscriber<Trip | TripChildStatus>(channelNames.tripStatus(tripId), [
      { schema: 'transport', table: 'trips', event: 'UPDATE', filter: 'id=eq.' + tripId },
      { schema: 'transport', table: 'trip_child_status', event: 'UPDATE', filter: 'trip_id=eq.' + tripId },
    ]),

  /** classroom:{id}:day_path — day-path events for one classroom. */
  classroomDayPath: (classroomId: string) =>
    makeSubscriber<DayPathEvent>(channelNames.classroomDayPath(classroomId), [
      {
        schema: 'academic',
        table: 'day_path_events',
        event: 'INSERT',
        filter: 'classroom_id=eq.' + classroomId,
      },
    ]),

  /** conversation:{id}:messages — new chat messages. */
  conversationMessages: (conversationId: string) =>
    makeSubscriber<Message>(channelNames.conversationMessages(conversationId), [
      {
        schema: 'comms',
        table: 'messages',
        event: 'INSERT',
        filter: 'conversation_id=eq.' + conversationId,
      },
    ]),

  /** user:{id}:notifications — own feed, including read-state updates. */
  userNotifications: (recipientId: string) =>
    makeSubscriber<Notification>(channelNames.userNotifications(recipientId), [
      { schema: 'comms', table: 'notifications', event: '*', filter: 'recipient_id=eq.' + recipientId },
    ]),

  /** tenant:{id}:cameras — heartbeat-driven online/offline changes. */
  tenantCameras: (tenantId: string) =>
    makeSubscriber<Camera>(channelNames.tenantCameras(tenantId), [
      { schema: 'media', table: 'cameras', event: 'UPDATE', filter: 'tenant_id=eq.' + tenantId },
    ]),

  /**
   * tenant:{id}:cameras:heartbeat — the admin_disabled subset, kept as its own
   * channel so the Dashboard can distinguish "I just disabled this" from "it
   * went offline" (§17). Same table, distinct channel and consumer.
   */
  tenantCamerasHeartbeat: (tenantId: string) =>
    makeSubscriber<Camera>(channelNames.tenantCamerasHeartbeat(tenantId), [
      { schema: 'media', table: 'cameras', event: 'UPDATE', filter: 'tenant_id=eq.' + tenantId },
    ]),

  /** tenant:{id}:activity — operational activity feed. */
  tenantActivity: (tenantId: string) =>
    makeSubscriber<ActivityLog>(channelNames.tenantActivity(tenantId), [
      { schema: 'platform', table: 'activity_log', event: 'INSERT', filter: 'tenant_id=eq.' + tenantId },
    ]),

  /** tenant:{id}:approvals — new and updated approval requests. */
  tenantApprovals: (tenantId: string) =>
    makeSubscriber<ApprovalRequest>(channelNames.tenantApprovals(tenantId), [
      { schema: 'approvals', table: 'requests', event: '*', filter: 'tenant_id=eq.' + tenantId },
    ]),

  /** platform:service_health — Platform Admin only. */
  platformServiceHealth: () =>
    makeSubscriber<ServiceHealth>(channelNames.platformServiceHealth(), [
      { schema: 'platform', table: 'service_health_status', event: 'UPDATE' },
    ]),

  /** platform:tenants — tenant status changes. */
  platformTenants: () =>
    makeSubscriber<Tenant>(channelNames.platformTenants(), [
      { schema: 'tenancy', table: 'tenants', event: 'UPDATE' },
    ]),

  /** platform:support_tickets — new and updated tickets (all admin tiers). */
  platformSupportTickets: () =>
    makeSubscriber<SupportTicket>(channelNames.platformSupportTickets(), [
      { schema: 'platform', table: 'support_tickets', event: '*' },
    ]),
} as const;

export type Realtime = typeof realtime;
