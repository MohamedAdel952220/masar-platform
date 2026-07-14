// Hand-authored Supabase-CLI-style database types for Epic 1's schema surface
// (tenancy + identity + the Epic-1 slice of platform/jobs). Once a live
// project exists, regenerate with:
//   supabase gen types typescript --local > src/types/database.types.ts
// and this file becomes the generated artifact instead of hand-maintained.

export type TenantStatus = 'trial' | 'active' | 'overdue' | 'suspended';
export type PlanCode = 'starter' | 'growth' | 'premium';
export type AppCode = 'dashboard' | 'parent' | 'teacher' | 'reception' | 'driver';
export type ProvisioningStep = 'created' | 'initial_manager_created' | 'plan_apps_provisioned' | 'welcome_sent' | 'complete';
export type PhoneAccountType = 'staff' | 'guardian' | 'driver';
export type StaffRole = 'manager' | 'teacher' | 'reception';
export type EmploymentStatus = 'active' | 'on_leave' | 'terminated';
export type Language = 'en' | 'ar';
export type PlatformAdminTier = 'owner' | 'admin' | 'support';
export type ServiceAccountPurpose = 'camera_agent' | 'integration_other';
export type ServiceAccountStatus = 'active' | 'revoked';
export type AuditActorType = 'platform_admin' | 'staff' | 'system';

export interface TenantRow {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  plan_id: string;
  status: TenantStatus;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  trial_ends_at: string | null;
  suspended_at: string | null;
  suspended_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlanCatalogRow {
  id: string;
  code: PlanCode;
  monthly_price: number;
  setup_fee: number;
  max_children: number | null;
  created_at: string;
  updated_at: string;
}

export interface PlanCatalogAppRow {
  plan_id: string;
  app_code: AppCode;
}

export interface TenantProvisioningStateRow {
  tenant_id: string;
  step: ProvisioningStep;
  last_error: string | null;
  updated_at: string;
}

export interface TenantPhoneRegistryRow {
  id: string;
  tenant_id: string;
  phone: string;
  account_type: PhoneAccountType;
  account_id: string;
  created_at: string;
}

export interface StaffProfileRow {
  id: string;
  tenant_id: string;
  role: StaffRole;
  name: string;
  name_ar: string | null;
  phone: string;
  email: string | null;
  photo_object_id: string | null;
  national_id: string | null;
  preferred_language: Language;
  join_date: string;
  employment_status: EmploymentStatus;
  primary_classroom_id: string | null;
  rating: number | null;
  created_by: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GuardianProfileRow {
  id: string;
  tenant_id: string;
  name: string;
  name_ar: string | null;
  phone: string;
  email: string | null;
  photo_object_id: string | null;
  national_id: string | null;
  preferred_language: Language;
  created_by: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DriverProfileRow {
  id: string;
  tenant_id: string;
  bus_id: string | null;
  name: string;
  name_ar: string | null;
  phone: string;
  photo_object_id: string | null;
  national_id: string | null;
  preferred_language: Language;
  created_by: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlatformAdminRow {
  id: string;
  name: string;
  email: string;
  role: PlatformAdminTier;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceAccountRow {
  id: string;
  tenant_id: string | null;
  name: string;
  purpose: ServiceAccountPurpose;
  api_key_hash: string;
  scopes: string[];
  status: ServiceAccountStatus;
  issued_by: string | null;
  issued_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
}

export interface AuditLogRow {
  id: string;
  tenant_id: string | null;
  actor_type: AuditActorType;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  ip_address: string | null;
  occurred_at: string;
}
