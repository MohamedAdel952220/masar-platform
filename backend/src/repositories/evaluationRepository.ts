import type { AnySupabaseClient } from '../lib/supabaseClient.js';
import type { EvaluationRow } from '../types/database.types.epic2.js';
import { evaluationFromRow, type Evaluation } from '../types/domain.epic2.js';
import type { SubmitEvaluationInput } from '../validation/academic.schema.js';
import { toAppError } from '../lib/rpcError.js';

export class EvaluationRepository {
  constructor(private readonly client: AnySupabaseClient) {}

  // Wraps the public.submit_evaluation RPC — naturally idempotent via
  // evaluations' unique (child_id, lesson_id) (EPIC_2_ARCHITECTURE_REVIEW.md §14.5).
  async submit(input: SubmitEvaluationInput): Promise<Evaluation> {
    const { data, error } = await this.client.rpc('submit_evaluation', {
      p_child_id: input.childId,
      p_lesson_id: input.lessonId,
      p_understanding: input.understanding,
      p_participation: input.participation,
      p_behavior: input.behavior,
      p_homework: input.homework,
      p_note: input.note ?? null,
    });
    if (error) throw toAppError(error);
    return evaluationFromRow(data as EvaluationRow);
  }
}
