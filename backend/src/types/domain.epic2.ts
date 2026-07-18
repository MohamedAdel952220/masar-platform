// Epic 2 domain (camelCase) types + row<->domain mappers. Separate file from
// domain.ts (Epic 1), same reasoning as database.types.epic2.ts.
import type {
  ChildRow,
  MembershipStatus,
  DayPathStatus,
  PackageType,
  Gender,
  EvaluationRow,
  HomeworkStatus,
} from './database.types.epic2.js';
import type { GuardianProfileRow, Language } from './database.types.js';

export interface Child {
  id: string;
  tenantId: string;
  name: string;
  nameAr: string | null;
  dob: string;
  gender: Gender;
  classroomId: string;
  package: PackageType;
  membershipStatus: MembershipStatus;
  dayPathStatus: DayPathStatus;
  deletedAt: string | null;
}

export function childFromRow(row: ChildRow): Child {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    nameAr: row.name_ar,
    dob: row.dob,
    gender: row.gender,
    classroomId: row.classroom_id,
    package: row.package,
    membershipStatus: row.membership_status,
    dayPathStatus: row.day_path_status,
    deletedAt: row.deleted_at,
  };
}

export interface GuardianProfile {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  email: string | null;
  preferredLanguage: Language;
  deletedAt: string | null;
}

export function guardianProfileFromRow(row: GuardianProfileRow): GuardianProfile {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    preferredLanguage: row.preferred_language,
    deletedAt: row.deleted_at,
  };
}

export interface Evaluation {
  id: string;
  tenantId: string;
  childId: string;
  lessonId: string;
  understanding: number;
  participation: number;
  behavior: number;
  homework: HomeworkStatus;
  note: string | null;
}

export function evaluationFromRow(row: EvaluationRow): Evaluation {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    childId: row.child_id,
    lessonId: row.lesson_id,
    understanding: row.understanding,
    participation: row.participation,
    behavior: row.behavior,
    homework: row.homework,
    note: row.note,
  };
}

export interface AttendanceSummary {
  classroomId: string;
  date: string;
  presentCount: number;
  absentCount: number;
  total: number;
}
