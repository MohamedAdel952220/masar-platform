// Fix for EPIC_2_REVIEW.md H1/M4 — Deno-side counterpart of
// src/lib/rpcError.ts. Parses the structured {code, human_message_en,
// human_message_ar} payload every Epic 1/Epic 2 RPC places in its Postgres
// exception's DETAIL clause (§25.2) into a clean AppError, instead of the
// fragile substring-matching previously used in enroll-child/index.ts
// (`if (detail.includes('full capacity'))...`), which silently misclassified
// any other RPC failure as EXTERNAL_AUTH_ADMIN_FAILURE — a code whose name
// specifically implies an Auth Admin API problem.
//
// New file — does not modify _shared/errors.ts (Epic 1), only imports from it.
import { AppError, type ErrorCode } from './errors.ts';

interface PostgrestLikeError {
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
  // Additive extensions (Epic 6/7/8) — same pattern already applied to
  // _shared/errors.ts and src/lib/rpcError.ts in each of those Epics' own
  // fix/completion reports. This file's own parsing LOGIC is unchanged;
  // only the recognized-code whitelist grows, exactly like every other
  // shared taxonomy list in this codebase.
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
    if (parsed && typeof parsed === 'object' && 'code' in (parsed as Record<string, unknown>)) {
      return parsed as ParsedDetail;
    }
    return null;
  } catch {
    return null;
  }
}

export function toAppError(err: unknown, fallbackEn = 'Something went wrong. Please try again.', fallbackAr = 'حدث خطأ ما. برجاء المحاولة مرة أخرى.'): AppError {
  if (err instanceof AppError) return err;

  const pgErr = err as PostgrestLikeError;
  const parsed = tryParseDetail(pgErr?.details);

  if (parsed && KNOWN_CODES.has(parsed.code as ErrorCode)) {
    return new AppError(
      parsed.code as ErrorCode,
      parsed.human_message_en ?? pgErr.message ?? fallbackEn,
      parsed.human_message_ar ?? fallbackAr,
    );
  }

  // Unparseable/unrecognized — no guessing at a specific code (that was
  // M4's fragile-substring-matching problem); a generic, honestly-labeled
  // fallback with the real Postgres message preserved for server-side logs.
  console.error('Unparsed RPC error (no matching structured DETAIL payload):', pgErr?.message ?? err);
  return new AppError('VALIDATION_FAILED', pgErr?.message ?? fallbackEn, fallbackAr);
}
