// Domain (camelCase) types + row<->domain mappers, kept separate from the
// snake_case database types so repositories are the only place that ever
// sees a raw DB row shape.
import type {
  TenantRow,
  PlanCatalogRow,
  StaffProfileRow,
  PlatformAdminRow,
  TenantStatus,
  PlanCode,
  StaffRole,
  EmploymentStatus,
  PlatformAdminTier,
} from './database.types.js';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  planId: string;
  status: TenantStatus;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  trialEndsAt: string | null;
  suspendedAt: string | null;
  suspendedReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export function tenantFromRow(row: TenantRow): Tenant {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    city: row.city,
    planId: row.plan_id,
    status: row.status,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    trialEndsAt: row.trial_ends_at,
    suspendedAt: row.suspended_at,
    suspendedReason: row.suspended_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface PlanCatalog {
  id: string;
  code: PlanCode;
  monthlyPrice: number;
  setupFee: number;
  maxChildren: number | null;
}

export function planCatalogFromRow(row: PlanCatalogRow): PlanCatalog {
  return {
    id: row.id,
    code: row.code,
    monthlyPrice: Number(row.monthly_price),
    setupFee: Number(row.setup_fee),
    maxChildren: row.max_children,
  };
}

export interface StaffProfile {
  id: string;
  tenantId: string;
  role: StaffRole;
  name: string;
  nameAr: string | null;
  phone: string;
  email: string | null;
  employmentStatus: EmploymentStatus;
  deletedAt: string | null;
}

export function staffProfileFromRow(row: StaffProfileRow): StaffProfile {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    role: row.role,
    name: row.name,
    nameAr: row.name_ar,
    phone: row.phone,
    email: row.email,
    employmentStatus: row.employment_status,
    deletedAt: row.deleted_at,
  };
}

export interface PlatformAdmin {
  id: string;
  name: string;
  email: string;
  tier: PlatformAdminTier;
}

export function platformAdminFromRow(row: PlatformAdminRow): PlatformAdmin {
  return { id: row.id, name: row.name, email: row.email, tier: row.role };
}

export interface CallerContext {
  userId: string;
  tenantId: string | null;
  role: 'guardian' | 'teacher' | 'reception' | 'manager' | 'driver' | 'platform_admin' | null;
  platformAdminTier: PlatformAdminTier | null;
}
