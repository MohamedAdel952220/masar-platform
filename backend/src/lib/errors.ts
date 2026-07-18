// Node-side mirror of supabase/functions/_shared/errors.ts — same taxonomy
// (§25.1), kept as a separate file because Edge Functions (Deno, URL
// imports) and this Node package cannot share a module without a bundler
// step neither runtime currently has configured.

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
  // codes ("EXTERNAL_PAYMENT_GATEWAY_TIMEOUT, EXTERNAL_AI_PROVIDER_UNAVAILABLE"
  // as illustrative EXTERNAL_* examples); this is the first Epic that
  // actually needs the payment-gateway one. Purely additive — no existing
  // code was removed or renamed.
  | 'EXTERNAL_PAYMENT_GATEWAY_TIMEOUT'
  | 'EXTERNAL_PAYMENT_GATEWAY_FAILURE'
  // Epic 7 addition — first Epic needing the media-relay code. Purely
  // additive.
  | 'EXTERNAL_MEDIA_RELAY_FAILURE'
  // Epic 8 addition — §19/§25.1's own named "EXTERNAL_AI_QUOTA_EXCEEDED"
  // error, the first Epic that needs it. Purely additive.
  | 'EXTERNAL_AI_QUOTA_EXCEEDED'
  | 'CONFLICT_IDEMPOTENCY_KEY_REUSED'
  | 'NOT_FOUND';

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public messageEn: string,
    public messageAr: string,
  ) {
    super(messageEn);
    this.name = 'AppError';
  }
}
