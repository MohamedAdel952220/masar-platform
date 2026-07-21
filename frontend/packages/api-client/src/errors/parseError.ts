import { AppError, type AppErrorCode } from './AppError';

/** Shape PostgREST surfaces for a raised Postgres exception. */
interface PostgrestLikeError {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string;
  status?: number;
}

const KNOWN_CODES: readonly AppErrorCode[] = [
  'VALIDATION_FAILED',
  'PERM_ROLE_DENIED',
  'NOT_FOUND',
  'STATE_ALREADY_PROCESSED',
  'CONFLICT_IDEMPOTENCY_KEY_REUSED',
  'RATE_LIMITED',
];

function isKnownCode(value: unknown): value is AppErrorCode {
  return typeof value === 'string' && (KNOWN_CODES as readonly string[]).includes(value);
}

/**
 * Parses the §25.2 RPC error contract. The backend puts a JSON payload
 * {code, human_message_en, human_message_ar} in DETAIL; anything that does not
 * match falls back to a generic UNKNOWN rather than leaking raw Postgres text
 * to a user (FRONTEND_ARCHITECTURE.md §14).
 */
export function parseBackendError(raw: unknown): AppError {
  const err = (raw ?? {}) as PostgrestLikeError;

  if (typeof err.details === 'string' && err.details.trim().startsWith('{')) {
    try {
      const detail = JSON.parse(err.details) as Record<string, unknown>;
      const code = isKnownCode(detail['code']) ? detail['code'] : 'UNKNOWN';
      return new AppError({
        code,
        messageEn: String(detail['human_message_en'] ?? 'Something went wrong.'),
        messageAr: String(detail['human_message_ar'] ?? 'حدث خطأ ما.'),
        httpStatus: err.status,
        retryable: false,
        cause: raw,
      });
    } catch {
      // fall through to the generic mapping below
    }
  }

  // PostgREST schema-not-exposed: a developer error, never a user-facing one.
  if (err.code === 'PGRST106') {
    return new AppError({
      code: 'UNKNOWN',
      messageEn: 'This data source is not available.',
      messageAr: 'مصدر البيانات هذا غير متاح.',
      httpStatus: err.status,
      retryable: false,
      cause: raw,
    });
  }

  const status = err.status ?? 0;
  const retryable = status === 0 || status >= 500;
  return new AppError({
    code: retryable ? 'NETWORK_ERROR' : 'UNKNOWN',
    messageEn: retryable ? 'Connection problem. Please try again.' : 'Something went wrong.',
    messageAr: retryable ? 'مشكلة في الاتصال. حاول مرة أخرى.' : 'حدث خطأ ما.',
    httpStatus: err.status,
    retryable,
    cause: raw,
  });
}
