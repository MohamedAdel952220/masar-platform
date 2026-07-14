// Node-side mirror of supabase/functions/_shared/activation.ts.
// STUBBED in Epic 1 by explicit architecture decision — see that file's
// header comment for the full rationale. This interface is what Epic 4 will
// implement for real (WhatsApp/SMS dispatch) without any caller here changing.

export interface ActivationLinkResult {
  delivered: boolean;
  channel: 'whatsapp_stub' | 'sms_stub';
  activationUrl: string;
}

export interface ActivationLinkPort {
  send(params: { phone: string; name: string; appLabel: string; userId: string }): Promise<ActivationLinkResult>;
}

export class StubActivationLinkPort implements ActivationLinkPort {
  constructor(private readonly baseUrl = 'https://app.masar.app/activate') {}

  async send(params: { phone: string; name: string; appLabel: string; userId: string }): Promise<ActivationLinkResult> {
    const activationUrl = `${this.baseUrl}/${params.userId}?token=${crypto.randomUUID()}`;
    console.info('[activation-link:stub]', { to: params.phone, name: params.name, app: params.appLabel, activationUrl });
    return { delivered: true, channel: 'whatsapp_stub', activationUrl };
  }
}
