-- ============================================================================
-- Epic 7 — Media & Camera Architecture
-- Migration 6: public.create_camera — fix for EPIC_7_REVIEW.md C1
-- Ref: BACKEND_ARCHITECTURE.md §2.2, §14.1, §17
--
-- Added by the EPIC_7_REVIEW.md fix pass, not part of the original Epic 7
-- delivery — BACKEND_EXECUTION_PLAN.md Epic 7 §8's "no RPC beyond Edge
-- Functions' internal calls" applied when media.cameras was a single table
-- a manager could insert with one direct RLS-governed statement. Splitting
-- ip_address/stream_protocol into media.camera_connections (migration 2,
-- C1's own fix) means creating a camera is now a two-table write that a
-- bare client-side sequence of two separate .insert() calls cannot make
-- atomic (a failure between the two would leave an orphaned camera with no
-- connection row, or vice versa) — this RPC is the minimal, narrowly-scoped
-- exception to the "no bespoke RPC for CRUD" default, existing solely to
-- provide single-transaction atomicity across the two tables.
--
-- Deliberately NOT `security definer` — this function runs as the calling
-- manager (the Postgres default, SECURITY INVOKER), so both INSERT
-- statements inside it are still individually gated by
-- cameras_insert_manager and camera_connections_insert_manager (migration
-- 3) exactly as if the caller had run them directly. The only thing this
-- function adds is transactional atomicity, not elevated privilege —
-- least-privilege by construction, not by convention.
-- ---------------------------------------------------------------------------
create or replace function public.create_camera(
  p_name            text,
  p_zone            media.camera_zone,
  p_ip_address      inet,
  p_stream_protocol text,
  p_resolution      media.camera_resolution,
  p_has_audio       boolean default false
)
returns media.cameras
language plpgsql
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_camera    media.cameras;
begin
  if public.current_role() <> 'manager' then
    raise exception 'Only a manager can add a camera'
      using errcode = 'P0001',
            detail = json_build_object('code', 'PERM_ROLE_DENIED', 'human_message_en', 'Only a manager can add a camera.', 'human_message_ar', 'فقط المدير يمكنه إضافة كاميرا.')::text;
  end if;

  insert into media.cameras (tenant_id, name, zone, resolution, has_audio)
  values (v_tenant_id, p_name, p_zone, p_resolution, p_has_audio)
  returning * into v_camera;

  insert into media.camera_connections (camera_id, tenant_id, ip_address, stream_protocol)
  values (v_camera.id, v_tenant_id, p_ip_address, p_stream_protocol);

  return v_camera;
end;
$$;

comment on function public.create_camera is
  'Atomically creates a media.cameras row and its media.camera_connections row together (fix for EPIC_7_REVIEW.md C1''s schema split). SECURITY INVOKER — relies on cameras_insert_manager/camera_connections_insert_manager RLS for authorization, not elevated privilege.';

revoke all on function public.create_camera from public;
grant execute on function public.create_camera to authenticated;
