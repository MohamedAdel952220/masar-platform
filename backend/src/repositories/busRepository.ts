import type { AnySupabaseClient } from '../lib/supabaseClient.js';
import type { BusRow, BusRiderRow } from '../types/database.types.epic3.js';
import { busFromRow, busRiderFromRow, type Bus, type BusRider } from '../types/domain.epic3.js';
import { toAppError } from '../lib/rpcError.js';

export class BusRepository {
  constructor(private readonly client: AnySupabaseClient) {}

  async findById(id: string): Promise<Bus | null> {
    const { data, error } = await this.client
      .schema('transport')
      .from('buses')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw toAppError(error);
    return data ? busFromRow(data as BusRow) : null;
  }

  // DB half of the add-bus saga (§25.3) — service_role only at the DB
  // layer. Atomic by construction (mirrors enroll_child_with_guardian's
  // atomicity, without needing a second RPC to compose — see migration 6's
  // comment on create_bus_with_driver_row).
  async createWithDriver(input: { tenantId: string; number: string; plate: string; capacity: number; serviceArea?: string | null; driverId: string }): Promise<Bus> {
    const { data, error } = await this.client.rpc('create_bus_with_driver_row', {
      p_tenant_id: input.tenantId,
      p_number: input.number,
      p_plate: input.plate,
      p_capacity: input.capacity,
      p_service_area: input.serviceArea ?? null,
      p_driver_id: input.driverId,
    });
    if (error) throw toAppError(error);
    return busFromRow(data as BusRow);
  }

  // Wraps the capacity-locked public.assign_bus_rider RPC (§2.2/§5, migration 6).
  async assignRider(input: { busId: string; childId: string; pickupAddressOverride?: string | null }): Promise<BusRider> {
    const { data, error } = await this.client.rpc('assign_bus_rider', {
      p_bus_id: input.busId,
      p_child_id: input.childId,
      p_pickup_address_override: input.pickupAddressOverride ?? null,
    });
    if (error) throw toAppError(error);
    return busRiderFromRow(data as BusRiderRow);
  }

  async unassignRider(busRiderId: string): Promise<BusRider> {
    const { data, error } = await this.client.rpc('unassign_bus_rider', { p_bus_rider_id: busRiderId });
    if (error) throw toAppError(error);
    return busRiderFromRow(data as BusRiderRow);
  }
}
