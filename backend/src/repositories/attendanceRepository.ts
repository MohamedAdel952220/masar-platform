import type { AnySupabaseClient } from '../lib/supabaseClient.js';
import type { AttendanceSummary } from '../types/domain.epic2.js';
import type { MarkAttendanceInput } from '../validation/academic.schema.js';
import { toAppError } from '../lib/rpcError.js';

export class AttendanceRepository {
  constructor(private readonly client: AnySupabaseClient) {}

  // Wraps the public.mark_attendance RPC (§14.2) — naturally idempotent via
  // attendance_records' unique (child_id, date), so no idempotency-key
  // plumbing is needed here (EPIC_2_ARCHITECTURE_REVIEW.md §6).
  async mark(input: MarkAttendanceInput): Promise<AttendanceSummary> {
    const { data, error } = await this.client.rpc('mark_attendance', {
      p_classroom_id: input.classroomId,
      p_date: input.date,
      p_records: input.records.map((r) => ({ childId: r.childId, present: r.present })),
    });
    if (error) throw toAppError(error);
    return {
      classroomId: data.classroomId as string,
      date: data.date as string,
      presentCount: data.presentCount as number,
      absentCount: data.absentCount as number,
      total: data.total as number,
    };
  }
}
