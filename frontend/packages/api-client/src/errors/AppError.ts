/**
 * Canonical backend error codes (BACKEND_ARCHITECTURE.md §25.2). Every RPC
 * raises with DETAIL carrying {code, human_message_en, human_message_ar}.
 */
export type AppErrorCode =
  | 'VALIDATION_FAILED'
  | 'PERM_ROLE_DENIED'
  | 'NOT_FOUND'
  | 'STATE_ALREADY_PROCESSED'
  | 'CONFLICT_IDEMPOTENCY_KEY_REUSED'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

export interface AppErrorInit {
  code: AppErrorCode;
  messageEn: string;
  messageAr: string;
  httpStatus?: number | undefined;
  retryable?: boolean;
  cause?: unknown;
}

/**
 * The only error type surfaced to UI code. Carries both locales because the
 * backend returns bilingual copy — error UX is never the untranslated surface
 * (FRONTEND_ARCHITECTURE.md §14).
 */
export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly messageEn: string;
  readonly messageAr: string;
  readonly httpStatus: number | undefined;
  readonly retryable: boolean;

  constructor(init: AppErrorInit) {
    super(init.messageEn);
    this.name = 'AppError';
    this.code = init.code;
    this.messageEn = init.messageEn;
    this.messageAr = init.messageAr;
    this.httpStatus = init.httpStatus;
    this.retryable = init.retryable ?? false;
    if (init.cause !== undefined) this.cause = init.cause;
  }

  /** Locale-aware message for display. */
  localized(locale: 'en' | 'ar'): string {
    return locale === 'ar' ? this.messageAr : this.messageEn;
  }
}
