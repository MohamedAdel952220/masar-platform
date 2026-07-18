// Notification provider ports — push/WhatsApp/SMS/email. STUBBED in Epic 4 by
// the same explicit pattern Epic 1 used for supabase/functions/_shared/
// activation.ts (BACKEND_EXECUTION_PLAN.md Epic 4 §13: "vendor contracting/
// sandbox access must be confirmed complete before this Epic starts" — not
// achievable in this sandboxed delivery). This is a NEW file, not an edit to
// Epic 1's activation.ts, which remains frozen and untouched — see
// EPIC_4_COMPLETION_REPORT.md for why the two coexist rather than one
// replacing the other.
//
// Each send function is the ONLY place that needs to change when a real
// FCM/APNs, WhatsApp Business API, SMS gateway, or email provider is wired
// up — every caller (notification-dispatch/index.ts) is already written
// against these signatures.

export interface ProviderSendResult {
  delivered: boolean;
  providerMessageId: string | null;
  failedReason: string | null;
  // Fix for EPIC_4_REVIEW.md M3: §27 "Device token invalidation" requires
  // hard-deleting a device_tokens row once the push provider reports it as
  // invalid/expired. This field is the signal a real provider integration
  // sets; notification-dispatch/index.ts already has the deletion call
  // wired to it (deliverOnChannel's push branch) — only push can ever set
  // this (WhatsApp/SMS/email have no equivalent "this token is dead" concept).
  invalidToken?: boolean;
}

export async function sendPush(params: { token: string; title: string; body: string; deepLink: string | null }): Promise<ProviderSendResult> {
  console.info('[notification-dispatch:push:stub]', { to: params.token, title: params.title });
  return { delivered: true, providerMessageId: `stub-push-${crypto.randomUUID()}`, failedReason: null, invalidToken: false };
}

export async function sendWhatsApp(params: { phone: string; title: string; body: string }): Promise<ProviderSendResult> {
  console.info('[notification-dispatch:whatsapp:stub]', { to: params.phone, title: params.title });
  return { delivered: true, providerMessageId: `stub-whatsapp-${crypto.randomUUID()}`, failedReason: null };
}

export async function sendSms(params: { phone: string; body: string }): Promise<ProviderSendResult> {
  console.info('[notification-dispatch:sms:stub]', { to: params.phone });
  return { delivered: true, providerMessageId: `stub-sms-${crypto.randomUUID()}`, failedReason: null };
}

export async function sendEmail(params: { email: string; title: string; body: string }): Promise<ProviderSendResult> {
  console.info('[notification-dispatch:email:stub]', { to: params.email, title: params.title });
  return { delivered: true, providerMessageId: `stub-email-${crypto.randomUUID()}`, failedReason: null };
}
