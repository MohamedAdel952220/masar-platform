/**
 * Typed PostgREST read builders for all 13 exposed schemas.
 *
 * `analytics` is intentionally absent — it is not PostgREST-exposed and carries
 * no client grant. Its aggregates are reachable only through the three
 * access-controlled views, which appear here under their owning schemas:
 *   academic.v_child_attendance_summary
 *   platform.v_tenant_billing_summary
 *   platform.v_tenant_health_summary
 */
export {
  DEFAULT_PAGE_SIZE,
  unwrap,
  unwrapMaybe,
  type KeysetOptions,
  type Page,
  type PostgrestLike,
} from './factory';

export { academic, ACADEMIC_RELATIONS, type AcademicRelation, type AcademicRow } from './academic';
export { approvals, APPROVALS_RELATIONS, type ApprovalsRelation, type ApprovalsRow } from './approvals';
export { billing, BILLING_RELATIONS, type BillingRelation, type BillingRow } from './billing';
export { comms, COMMS_RELATIONS, type CommsRelation, type CommsRow } from './comms';
export { identity, IDENTITY_RELATIONS, type IdentityRelation, type IdentityRow } from './identity';
export { jobs, JOBS_RELATIONS, type JobsRelation, type JobsRow } from './jobs';
export { media, MEDIA_RELATIONS, type MediaRelation, type MediaRow } from './media';
export { platform, PLATFORM_RELATIONS, type PlatformRelation, type PlatformRow } from './platform';
export { PUBLIC_RELATIONS, type PublicRelation } from './public';
export { reports, REPORTS_RELATIONS, type ReportsRelation, type ReportsRow } from './reports';
export { safety, SAFETY_RELATIONS, type SafetyRelation, type SafetyRow } from './safety';
export { tenancy, TENANCY_RELATIONS, type TenancyRelation, type TenancyRow } from './tenancy';
export { transport, TRANSPORT_RELATIONS, type TransportRelation, type TransportRow } from './transport';
