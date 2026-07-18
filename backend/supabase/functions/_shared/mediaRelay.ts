// Media relay provider port. STUBBED in Epic 7 by the same explicit pattern
// Epic 1 used for _shared/activation.ts, Epic 4 used for
// _shared/notificationProviders.ts, and Epic 6 used for
// _shared/paymentGateway.ts (BACKEND_EXECUTION_PLAN.md Epic 7 §13: "Media
// relay service — external infrastructure, coordinated with but not built
// by the backend team; this Epic's job is the metadata/auth contract the
// relay integrates against").
//
// mintStreamToken is the ONLY place that needs to change when a real relay
// vendor is wired up — camera-stream-token/index.ts is already written
// against this signature.
export interface StreamTokenResult {
  relayUrl: string;
  token: string;
  expiresAt: string;
}

// §17: "mints a scoped, time-limited token against the media relay's own
// auth system, (3) returns a relay URL + token, never the camera's real
// network address." The stub never receives or echoes ip_address/
// stream_protocol — callers must not pass them in, keeping the "never sent
// to a client app" invariant true even before a real relay exists.
export async function mintStreamToken(params: { cameraId: string; tenantId: string; ttlSeconds?: number }): Promise<StreamTokenResult> {
  console.info('[media-relay:mint-token:stub]', params);
  const ttl = params.ttlSeconds ?? 60;
  return {
    relayUrl: `https://relay.stub.masar.app/stream/${params.cameraId}`,
    token: `stub-token-${crypto.randomUUID()}`,
    expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
  };
}
