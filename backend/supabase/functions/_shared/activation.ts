// Activation-link dispatch — STUBBED in Epic 1 by explicit architecture
// decision (BACKEND_EXECUTION_PLAN.md Epic 1 Risk: "Vendor lead time risk...
// mitigated by stubbing activation-link dispatch to a logged/manual-copy
// fallback for this Epic only, explicitly not shipped to production until
// Epic 4 replaces the stub").
//
// This function is the ONLY place that will need to change when Epic 4 wires
// up the real WhatsApp/SMS notification-dispatch pipeline — everything that
// calls it today (provision-tenant) is already written against the same
// signature Epic 4's real implementation will have.

export interface ActivationLinkResult {
  delivered: boolean;
  channel: 'whatsapp_stub' | 'sms_stub';
  activationUrl: string;
}

function buildActivationUrl(userId: string): string {
  const base = Deno.env.get('ACTIVATION_LINK_BASE_URL') ?? 'https://app.masar.app/activate';
  const token = crypto.randomUUID();
  return `${base}/${userId}?token=${token}`;
}

export async function sendActivationLink(params: {
  phone: string;
  name: string;
  appLabel: string;
  userId: string;
}): Promise<ActivationLinkResult> {
  const activationUrl = buildActivationUrl(params.userId);

  // Epic 1 stub: log intent instead of calling a real provider. Structured
  // so Epic 4 can swap this block for a real WhatsApp/SMS API call without
  // touching any caller.
  console.info('[activation-link:stub]', {
    to: params.phone,
    name: params.name,
    app: params.appLabel,
    activationUrl,
  });

  return { delivered: true, channel: 'whatsapp_stub', activationUrl };
}
