import type { AnySupabaseClient } from '../lib/supabaseClient.js';
import type { EventRow, EventRsvpRow, EventTripRegistrationRow } from '../types/database.types.epic5.js';
import {
  approvalEventFromRow,
  eventRsvpFromRow,
  eventTripRegistrationFromRow,
  type ApprovalEvent,
  type EventRsvp,
  type EventTripRegistration,
} from '../types/domain.epic5.js';
import type { UpdateRsvpInput } from '../validation/approvals.schema.js';
import { toAppError } from '../lib/rpcError.js';

export class EventRepository {
  constructor(private readonly client: AnySupabaseClient) {}

  async listForTenant(tenantId: string): Promise<ApprovalEvent[]> {
    const { data, error } = await this.client
      .schema('approvals')
      .from('events')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('event_date', { ascending: true });
    if (error) throw toAppError(error);
    return (data as EventRow[]).map(approvalEventFromRow);
  }

  // Wraps public.update_rsvp (§14.2, migration 5) — naturally idempotent
  // upsert on (event_id, child_id), no idempotency-key parameter (§14.3).
  async updateRsvp(input: UpdateRsvpInput): Promise<EventRsvp> {
    const { data, error } = await this.client.rpc('update_rsvp', {
      p_event_id: input.eventId,
      p_child_id: input.childId,
      p_attendee: input.attendee,
      p_extra_guest_name: input.extraGuestName ?? null,
      p_extra_guest_relation: input.extraGuestRelation ?? null,
      p_contact_phone: input.contactPhone ?? null,
    });
    if (error) throw toAppError(error);
    return eventRsvpFromRow(data as EventRsvpRow);
  }

  async listRsvpsForChild(childId: string): Promise<EventRsvp[]> {
    const { data, error } = await this.client
      .schema('approvals')
      .from('event_rsvps')
      .select('*')
      .eq('child_id', childId)
      .order('responded_at', { ascending: false });
    if (error) throw toAppError(error);
    return (data as EventRsvpRow[]).map(eventRsvpFromRow);
  }

  // Trip-registration creation goes through direct PostgREST INSERT under
  // RLS (event_trip_registrations_insert_guardian, migration 4), not a
  // bespoke RPC — the capacity/type/payment-consistency trigger (migration
  // 2) is the authoritative backstop regardless of write path, mirroring
  // transport.bus_riders' established pattern (Epic 3).
  async registerForTrip(eventId: string, childId: string, tenantId: string): Promise<EventTripRegistration> {
    const { data, error } = await this.client
      .schema('approvals')
      .from('event_trip_registrations')
      .insert({ event_id: eventId, child_id: childId, tenant_id: tenantId, status: 'open' })
      .select('*')
      .single();
    if (error) throw toAppError(error);
    return eventTripRegistrationFromRow(data as EventTripRegistrationRow);
  }

  // Wraps public.cancel_trip_registration (§14.2, migration 5) — atomic
  // UPDATE...WHERE, same pattern as revoke_pickup_pass/unassign_bus_rider.
  async cancelTripRegistration(registrationId: string): Promise<EventTripRegistration> {
    const { data, error } = await this.client.rpc('cancel_trip_registration', {
      p_registration_id: registrationId,
    });
    if (error) throw toAppError(error);
    return eventTripRegistrationFromRow(data as EventTripRegistrationRow);
  }

  async listTripRegistrationsForChild(childId: string): Promise<EventTripRegistration[]> {
    const { data, error } = await this.client
      .schema('approvals')
      .from('event_trip_registrations')
      .select('*')
      .eq('child_id', childId)
      .order('created_at', { ascending: false });
    if (error) throw toAppError(error);
    return (data as EventTripRegistrationRow[]).map(eventTripRegistrationFromRow);
  }
}
