import type { AnySupabaseClient } from '../lib/supabaseClient.js';
import type { ChildRow, GuardianRelation } from '../types/database.types.epic2.js';
import { childFromRow, type Child } from '../types/domain.epic2.js';
import type { ChildFieldsInput } from '../validation/academic.schema.js';
import { toAppError } from '../lib/rpcError.js';

export class ChildRepository {
  constructor(private readonly client: AnySupabaseClient) {}

  async findById(id: string): Promise<Child | null> {
    const { data, error } = await this.client
      .schema('academic')
      .from('children')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw toAppError(error);
    return data ? childFromRow(data as ChildRow) : null;
  }

  // Wraps the capacity-locked public.enroll_child_row RPC (§2.2/§5) —
  // service_role only at the DB layer; kept for backward compatibility
  // (EPIC_2_FIX_REPORT.md — "keep all APIs stable"). Prefer enrollWithGuardian
  // for new callers: calling this and linkGuardian() as two separate calls
  // is exactly the non-atomic pattern that caused EPIC_2_REVIEW.md C3.
  async enroll(input: { tenantId: string; classroomId: string; child: ChildFieldsInput; createdBy: string }): Promise<Child> {
    const { data, error } = await this.client.rpc('enroll_child_row', {
      p_tenant_id: input.tenantId,
      p_classroom_id: input.classroomId,
      p_child: input.child,
      p_created_by: input.createdBy,
    });
    if (error) throw toAppError(error);
    return childFromRow(data as ChildRow);
  }

  // Kept for backward compatibility — see enroll()'s comment above.
  async linkGuardian(input: { childId: string; guardianId: string; tenantId: string; relation: GuardianRelation; isPrimaryContact?: boolean }): Promise<void> {
    const { error } = await this.client.rpc('link_child_guardian', {
      p_child_id: input.childId,
      p_guardian_id: input.guardianId,
      p_tenant_id: input.tenantId,
      p_relation: input.relation,
      p_is_primary_contact: input.isPrimaryContact ?? true,
    });
    if (error) throw toAppError(error);
  }

  // Fix for EPIC_2_REVIEW.md C3: wraps the new public.enroll_child_with_guardian
  // RPC (migration 7), which performs the capacity-locked child insert AND
  // the guardian link insert in ONE transaction. This is what
  // ChildEnrollmentService now calls instead of enroll() + linkGuardian(),
  // so a link failure can never leave an orphaned child or, on retry,
  // create a duplicate one.
  async enrollWithGuardian(input: {
    tenantId: string;
    classroomId: string;
    child: ChildFieldsInput;
    createdBy: string;
    guardianId: string;
    relation: GuardianRelation;
    isPrimaryContact?: boolean;
  }): Promise<Child> {
    const { data, error } = await this.client.rpc('enroll_child_with_guardian', {
      p_tenant_id: input.tenantId,
      p_classroom_id: input.classroomId,
      p_child: input.child,
      p_created_by: input.createdBy,
      p_guardian_id: input.guardianId,
      p_relation: input.relation,
      p_is_primary_contact: input.isPrimaryContact ?? true,
    });
    if (error) throw toAppError(error);
    return childFromRow(data as ChildRow);
  }

  async withdraw(childId: string, reason?: string | null): Promise<Child> {
    const { data, error } = await this.client.rpc('withdraw_child', { p_child_id: childId, p_reason: reason ?? null });
    if (error) throw toAppError(error);
    return childFromRow(data as ChildRow);
  }

  async suspend(childId: string, reason?: string | null): Promise<Child> {
    const { data, error } = await this.client.rpc('suspend_child', { p_child_id: childId, p_reason: reason ?? null });
    if (error) throw toAppError(error);
    return childFromRow(data as ChildRow);
  }

  async reactivate(childId: string): Promise<Child> {
    const { data, error } = await this.client.rpc('reactivate_child', { p_child_id: childId });
    if (error) throw toAppError(error);
    return childFromRow(data as ChildRow);
  }
}
