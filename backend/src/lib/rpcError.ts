// Fix for EPIC_2_REVIEW.md H1/M4: every Epic 2 RPC raises a PL/pgSQL
// exception with a structured DETAIL payload matching §25.2's contract
// ({code, human_message_en, human_message_ar}), but nothing in the
// TypeScript layer ever parsed it — repositories rethrow the raw
// PostgrestError untouched, and there is no RPC-side equivalent of
// supabase/functions/_shared/errors.ts's toErrorResponse/AppError reshaping.
// This is that missing layer: every repository wrapping an RPC call now
// routes its error through toAppError() instead of `if (error) throw error;`.
import { AppError, type ErrorCode } from './errors.js';

// PostgREST's error shape (mirrored by supabase-js's PostgrestError) — kept
// as a narrow local interface rather than importing @supabase/supabase-js's
// type, so this module has no hard dependency on that package's error class.
export interface PostgrestLikeError {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
}

const KNOWN_CODES = new Set<ErrorCode>([
  'AUTH_EXPIRED',
  'AUTH_INVALID_CREDENTIALS',
  'AUTH_MISSING_TOKEN',
  'PERM_TENANT_MISMATCH',
  'PERM_ROLE_DENIED',
  'VALIDATION_FAILED',
  'VALIDATION_DUPLICATE_PHONE',
  'VALIDATION_DUPLICATE_SLUG',
  'STATE_ALREADY_PROCESSED',
  'STATE_ACCOUNT_ALREADY_SUSPENDED',
  'STATE_ACCOUNT_NOT_SUSPENDED',
  'EXTERNAL_AUTH_ADMIN_FAILURE',
  'EXTERNAL_NOTIFICATION_DISPATCH_FAILURE',
  'EXTERNAL_PAYMENT_GATEWAY_TIMEOUT',
  'EXTERNAL_PAYMENT_GATEWAY_FAILURE',
  'EXTERNAL_MEDIA_RELAY_FAILURE',
  'EXTERNAL_AI_QUOTA_EXCEEDED',
  'CONFLICT_IDEMPOTENCY_KEY_REUSED',
  'NOT_FOUND',
]);

interface ParsedDetail {
  code: string;
  human_message_en?: string;
  human_message_ar?: string;
}

function tryParseDetail(details: string | null | undefined): ParsedDetail | null {
  if (!details) return null;
  try {
    const parsed = JSON.parse(details) as unknown;
    if (parsed && typeof parsed === 'object' && 'code' in parsed) {
      return parsed as ParsedDetail;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Converts a raw error thrown by a Supabase RPC call (a PostgrestError-like
 * object) into a clean, bilingual AppError, by parsing the structured
 * {code, human_message_en, human_message_ar} payload every Epic 1/Epic 2
 * RPC places in the Postgres exception's DETAIL clause (§25.2). Falls back
 * to a generic VALIDATION_FAILED-coded error if the payload can't be parsed
 * (e.g. an error that didn't originate from one of this codebase's own
 * RAISE EXCEPTION calls — a connection error, an unexpected constraint
 * violation, etc.) — never silently swallows the original message.
 */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  const pgErr = err as PostgrestLikeError;
  const parsed = tryParseDetail(pgErr?.details);

  if (parsed && KNOWN_CODES.has(parsed.code as ErrorCode)) {
    return new AppError(
      parsed.code as ErrorCode,
      parsed.human_message_en ?? pgErr.message ?? 'An unexpected error occurred.',
      parsed.human_message_ar ?? 'حدث خطأ غير متوقع.',
    );
  }

  // Fix for EPIC_3_REVIEW.md L4: a raw Postgres constraint-violation error
  // (e.g. from one of the TOCTOU races EPIC_3_REVIEW.md M3 otherwise
  // narrowed) has no structured DETAIL payload and previously fell through
  // to leak its raw, untranslated message (e.g. "duplicate key value
  // violates unique constraint \"trips_bus_leg_date_key\"") straight to the
  // end user. Constraint-violation codes (23xxx) get a clean, generic,
  // bilingual message instead — the raw message is not discarded, it is
  // still attached as `cause` for server-side logging, just never surfaced
  // as `human_message_en`/`human_message_ar`.
  const pgCode = pgErr?.code ?? '';
  if (pgCode.startsWith('23')) {
    const constraintError = new AppError(
      'VALIDATION_FAILED',
      'This action conflicts with an existing record. Please refresh and try again.',
      'يتعارض هذا الإجراء مع سجل موجود بالفعل. برجاء التحديث والمحاولة مرة أخرى.',
    );
    (constraintError as AppError & { cause?: unknown }).cause = pgErr;
    return constraintError;
  }

  // Unparseable or unrecognized — do not guess a specific code (that was
  // exactly M4's "fragile substring matching" problem); surface the
  // original Postgres message so it's still useful for debugging, under a
  // generic validation code rather than a misleading specific one.
  const rawMessage = pgErr?.message ?? (err instanceof Error ? err.message : String(err));
  return new AppError('VALIDATION_FAILED', rawMessage, 'حدث خطأ غير متوقع. برجاء المحاولة مرة أخرى.');
}
