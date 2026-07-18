// camera-stream-token — Edge Function
// Ref: BACKEND_ARCHITECTURE.md §17; BACKEND_EXECUTION_PLAN.md Epic 7 §7
// Caller: guardian, own child's linked classroom(s) only.
//
// An Edge Function (not an RPC) because it calls an external service (the
// media relay, stubbed via _shared/mediaRelay.ts — see that file's header
// for why), matching §14.1's "use an Edge Function when the operation needs
// to call an external service" rule, exactly like Epic 6's initiate-payment.
//
// §17's defense-in-depth: RLS on media.cameras/camera_classroom_links
// (migration 3) already restricts a guardian's direct reads to their own
// child's linked classroom(s); this function re-derives and re-checks the
// identical ownership condition itself, server-side, before ever minting a
// token — never trusting the caller's own claim that a given cameraId is
// theirs to view (§14.3), since a stream token is a higher-stakes
// credential than a metadata read.
//
// Structurally never echoes ip_address/stream_protocol in any response —
// those two columns no longer even exist on media.cameras (fix for
// EPIC_7_REVIEW.md C1 moved them to media.camera_connections, a table this
// function never queries at all).
//
// Fix for EPIC_7_REVIEW.md L2: the authorization decision this function
// makes (classroom ownership + online/admin_disabled gating) is mirrored,
// as a pure/testable function, in
// backend/src/services/cameraStreamAuthorizationService.ts and covered by
// tests/unit/cameraStreamAuthorizationService.test.ts — this Edge Function
// itself still has no direct automated test (consistent with every other
// Edge Function in this codebase), but the decision logic it implements is
// no longer untested.
import { corsHeaders } from '../_shared/cors.ts';
import { toErrorResponse, AppError } from '../_shared/errors.ts';
import { requireCaller, requireRole } from '../_shared/auth.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { mintStreamToken } from '../_shared/mediaRelay.ts';

interface Body {
  cameraId: string;
}

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers });

  try {
    if (req.method !== 'POST') throw new AppError('VALIDATION_FAILED', 'POST required', 'مطلوب POST');

    const caller = await requireCaller(req);
    requireRole(caller, ['guardian']);
    if (!caller.tenantId) {
      throw new AppError('PERM_TENANT_MISMATCH', 'Your account is not scoped to a tenant.', 'حسابك غير مرتبط بمؤسسة.');
    }

    const body = (await req.json()) as Partial<Body>;
    if (!body.cameraId || !uuidRe.test(body.cameraId)) {
      throw new AppError('VALIDATION_FAILED', 'cameraId must be a valid UUID', 'يجب أن يكون cameraId معرّف UUID صحيحًا');
    }

    const admin = supabaseAdmin();

    // The guardian's own (non-withdrawn) children's classroom IDs — the
    // exact set public.current_guardian_classroom_ids() derives under RLS,
    // re-derived here explicitly server-side rather than trusted from the
    // client (§14.3).
    //
    // Fix for EPIC_7_REVIEW.md M4: also excludes a classroom that has
    // itself been soft-deleted (`deleted_at`), which the underlying
    // classroom rows are checked against below. This mirrors the identical
    // fix applied to cameras_select_guardian/camera_classroom_links_select_
    // guardian (migration 3) — the shared, frozen Epic 5 helper
    // (public.current_guardian_classroom_ids()) has this same latent gap
    // and is correctly left unmodified; every Epic-7-owned read path
    // re-checks it independently instead.
    const { data: children, error: childrenErr } = await admin
      .schema('academic')
      .from('child_guardian_links')
      .select('child_id, children!inner(classroom_id, deleted_at)')
      .eq('guardian_id', caller.userId)
      .eq('tenant_id', caller.tenantId);
    if (childrenErr) throw childrenErr;

    type ChildRow = { children: { classroom_id: string; deleted_at: string | null } };
    const candidateClassroomIds = Array.from(
      new Set(
        (children ?? [])
          .map((row) => (row as unknown as ChildRow).children)
          .filter((child) => child && child.deleted_at === null)
          .map((child) => child.classroom_id),
      ),
    );

    if (candidateClassroomIds.length === 0) {
      throw new AppError('PERM_ROLE_DENIED', 'This is not your child\'s camera.', 'هذه ليست كاميرا طفلك.');
    }

    // Fix for EPIC_7_REVIEW.md M4: a separate, explicit check that the
    // classroom itself is not soft-deleted — kept as its own query rather
    // than a nested embedded select for clarity and to avoid relying on
    // PostgREST's nested-alias embed resolution for a security-relevant
    // check.
    const { data: liveClassrooms, error: classroomsErr } = await admin
      .schema('academic')
      .from('classrooms')
      .select('id')
      .in('id', candidateClassroomIds)
      .is('deleted_at', null);
    if (classroomsErr) throw classroomsErr;

    const classroomIds = new Set((liveClassrooms ?? []).map((row) => (row as { id: string }).id));
    if (classroomIds.size === 0) {
      throw new AppError('PERM_ROLE_DENIED', 'This is not your child\'s camera.', 'هذه ليست كاميرا طفلك.');
    }

    // Fix for EPIC_7_REVIEW.md H1: `online` is now fetched and gated on,
    // not just `admin_disabled` — §3.33/§17's own compound rule ("viewable
    // iff online = true AND admin_disabled = false") was previously only
    // half-enforced here.
    const { data: camera, error: cameraErr } = await admin
      .schema('media')
      .from('cameras')
      .select('id, tenant_id, online, admin_disabled')
      .eq('id', body.cameraId)
      .eq('tenant_id', caller.tenantId)
      .is('deleted_at', null)
      .maybeSingle();
    if (cameraErr) throw cameraErr;
    if (!camera) {
      throw new AppError('NOT_FOUND', 'Camera not found.', 'لم يتم العثور على الكاميرا.');
    }

    const { data: link, error: linkErr } = await admin
      .schema('media')
      .from('camera_classroom_links')
      .select('classroom_id')
      .eq('camera_id', camera.id)
      .eq('tenant_id', caller.tenantId);
    if (linkErr) throw linkErr;

    const isLinkedToOwnChild = (link ?? []).some((row) => classroomIds.has((row as { classroom_id: string }).classroom_id));
    if (!isLinkedToOwnChild) {
      throw new AppError('PERM_ROLE_DENIED', 'This is not your child\'s camera.', 'هذه ليست كاميرا طفلك.');
    }

    // Fix for EPIC_7_REVIEW.md H1: both halves of §3.33's compound
    // viewability rule are now checked — previously only admin_disabled was.
    if (!camera.online || camera.admin_disabled) {
      throw new AppError('VALIDATION_FAILED', 'This camera is currently unavailable.', 'هذه الكاميرا غير متاحة حاليًا.');
    }

    let token;
    try {
      token = await mintStreamToken({ cameraId: camera.id, tenantId: caller.tenantId });
    } catch (err) {
      console.error('Media relay token mint failed:', err);
      throw new AppError('EXTERNAL_MEDIA_RELAY_FAILURE', 'Failed to start the camera stream.', 'فشل بدء بث الكاميرا.');
    }

    return new Response(JSON.stringify(token), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
  } catch (err) {
    return toErrorResponse(err, headers);
  }
});
