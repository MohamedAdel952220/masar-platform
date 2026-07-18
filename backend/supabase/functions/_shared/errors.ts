// Stable error-code taxonomy shared by every Edge Function (§25.1, §25.2).
// Every thrown AppError becomes a JSON body the client SDK can pattern-match
// on, with bilingual messages since the whole frontend is bilingual.

export type ErrorCode =
  | 'AUTH_EXPIRED'
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_MISSING_TOKEN'
  | 'PERM_TENANT_MISMATCH'
  | 'PERM_ROLE_DENIED'
  | 'VALIDATION_FAILED'
  | 'VALIDATION_DUPLICATE_PHONE'
  | 'VALIDATION_DUPLICATE_SLUG'
  | 'STATE_ALREADY_PROCESSED'
  | 'STATE_ACCOUNT_ALREADY_SUSPENDED'
  | 'STATE_ACCOUNT_NOT_SUSPENDED'
  | 'EXTERNAL_AUTH_ADMIN_FAILURE'
  | 'EXTERNAL_NOTIFICATION_DISPATCH_FAILURE'
  // Epic 6 addition — §25.1's own taxonomy table names these two exact
  // codes as illustrative EXTERNAL_* examples; this is the first Epic that
  // actually needs the payment-gateway one. Purely additive.
  | 'EXTERNAL_PAYMENT_GATEWAY_TIMEOUT'
  | 'EXTERNAL_PAYMENT_GATEWAY_FAILURE'
  // Epic 7 addition — same illustrative EXTERNAL_* pattern §25.1 already
  // names; this is the first Epic that needs the media-relay one. Purely
  // additive.
  | 'EXTERNAL_MEDIA_RELAY_FAILURE'
  // Epic 8 addition — §19/§25.1's own named "EXTERNAL_AI_QUOTA_EXCEEDED"
  // error, the first Epic that needs it. Purely additive.
  | 'EXTERNAL_AI_QUOTA_EXCEEDED'
  | 'CONFLICT_IDEMPOTENCY_KEY_REUSED'
  | 'NOT_FOUND';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  AUTH_EXPIRED: 401,
  AUTH_INVALID_CREDENTIALS: 401,
  AUTH_MISSING_TOKEN: 401,
  PERM_TENANT_MISMATCH: 403,
  PERM_ROLE_DENIED: 403,
  VALIDATION_FAILED: 422,
  VALIDATION_DUPLICATE_PHONE: 409,
  VALIDATION_DUPLICATE_SLUG: 409,
  STATE_ALREADY_PROCESSED: 409,
  STATE_ACCOUNT_ALREADY_SUSPENDED: 409,
  STATE_ACCOUNT_NOT_SUSPENDED: 409,
  EXTERNAL_AUTH_ADMIN_FAILURE: 502,
  EXTERNAL_NOTIFICATION_DISPATCH_FAILURE: 502,
  EXTERNAL_PAYMENT_GATEWAY_TIMEOUT: 504,
  EXTERNAL_PAYMENT_GATEWAY_FAILURE: 502,
  EXTERNAL_MEDIA_RELAY_FAILURE: 502,
  EXTERNAL_AI_QUOTA_EXCEEDED: 429,
  CONFLICT_IDEMPOTENCY_KEY_REUSED: 409,
  NOT_FOUND: 404,
};

export class AppError extends Error {
  code: ErrorCode;
  humanMessageEn: string;
  humanMessageAr: string;
  status: number;

  constructor(code: ErrorCode, humanMessageEn: string, humanMessageAr: string) {
    super(humanMessageEn);
    this.code = code;
    this.humanMessageEn = humanMessageEn;
    this.humanMessageAr = humanMessageAr;
    this.status = STATUS_BY_CODE[code];
  }

  toResponseBody() {
    return {
      error: {
        code: this.code,
        message_en: this.humanMessageEn,
        message_ar: this.humanMessageAr,
      },
    };
  }
}

export function toErrorResponse(err: unknown, headers: Record<string, string>): Response {
  if (err instanceof AppError) {
    return new Response(JSON.stringify(err.toResponseBody()), {
      status: err.status,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }
  console.error('Unhandled Edge Function error:', err);
  const fallback = new AppError(
    'EXTERNAL_AUTH_ADMIN_FAILURE',
    'Something went wrong. Please try again.',
    'حدث خطأ ما. برجاء المحاولة مرة أخرى.',
  );
  fallback.status = 500;
  return new Response(JSON.stringify(fallback.toResponseBody()), {
    status: 500,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}
