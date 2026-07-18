// Epic 2 database row types (academic schema + the identity-schema staff
// extension tables). Kept in a separate file from database.types.ts (Epic 1)
// rather than appended to it, so Epic 1's file is never modified — mirrors
// the migration-file-per-Epic convention already used under supabase/migrations.

export type GradeLevel = 'pre_kg' | 'kg1' | 'kg2' | 'nursery';
export type Gender = 'male' | 'female';
export type PackageType = 'full_day' | 'half_day';
export type MembershipStatus = 'active' | 'overdue' | 'suspended';
export type DayPathStatus = 'at_home' | 'in_bus' | 'classroom' | 'playing' | 'nap' | 'delivered';
export type DayPathSource = 'driver' | 'teacher' | 'reception' | 'system';
export type GuardianRelation = 'father' | 'mother' | 'guardian';
export type HomeworkStatus = 'done' | 'partial' | 'none';
export type ConcernCategory = 'academic' | 'behavior' | 'social' | 'health';
export type ConcernPriority = 'info' | 'attention' | 'urgent';
export type ConcernStatus = 'open' | 'acknowledged' | 'resolved';
export type FeedbackKind = 'complaint' | 'commend';
export type FeedbackSeverity = 'low' | 'medium' | 'high';

export interface ClassroomRow {
  id: string;
  tenant_id: string;
  name: string;
  grade: GradeLevel;
  age_min_months: number;
  age_max_months: number;
  coordinator_staff_id: string | null;
  capacity: number;
  color_tag: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChildRow {
  id: string;
  tenant_id: string;
  name: string;
  name_ar: string | null;
  dob: string;
  gender: Gender;
  blood_type: string | null;
  allergies: string | null;
  notes: string | null;
  photo_object_id: string | null;
  classroom_id: string;
  package: PackageType;
  membership_status: MembershipStatus;
  day_path_status: DayPathStatus;
  address_line: string | null;
  building: string | null;
  area: string | null;
  city: string | null;
  address_lat: number | null;
  address_lng: number | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relation: string | null;
  father_name: string | null;
  father_phone: string | null;
  father_job: string | null;
  father_national_id: string | null;
  mother_name: string | null;
  mother_phone: string | null;
  mother_job: string | null;
  mother_national_id: string | null;
  enrolled_at: string;
  created_by: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChildGuardianLinkRow {
  child_id: string;
  guardian_id: string;
  tenant_id: string;
  relation: GuardianRelation;
  is_primary_contact: boolean;
}

export interface AttendanceRecordRow {
  id: string;
  tenant_id: string;
  child_id: string;
  classroom_id: string;
  date: string;
  present: boolean;
  marked_by: string;
  notified_parent: boolean;
  notified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubjectRow {
  id: string;
  tenant_id: string;
  classroom_id: string;
  name: string;
  teacher_staff_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LessonRow {
  id: string;
  tenant_id: string;
  subject_id: string;
  classroom_id: string;
  date: string;
  title_en: string;
  title_ar: string | null;
  covered_en: string | null;
  covered_ar: string | null;
  objective_en: string | null;
  objective_ar: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface EvaluationRow {
  id: string;
  tenant_id: string;
  child_id: string;
  lesson_id: string;
  understanding: number;
  participation: number;
  behavior: number;
  homework: HomeworkStatus;
  note: string | null;
  note_ai_polished: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ConcernRow {
  id: string;
  tenant_id: string;
  child_id: string;
  raised_by: string;
  category: ConcernCategory;
  priority: ConcernPriority;
  message: string;
  status: ConcernStatus;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DayPathEventRow {
  id: string;
  child_id: string;
  tenant_id: string;
  status: DayPathStatus;
  source: DayPathSource;
  actor_id: string | null;
  occurred_at: string;
}

export interface StaffSubjectRow {
  staff_profile_id: string;
  tenant_id: string;
  subject_id: string;
  days: string[];
  sessions_per_week: number;
}

export interface StaffLeaveRecordRow {
  id: string;
  tenant_id: string;
  staff_profile_id: string;
  from_date: string;
  to_date: string;
  reason: string | null;
  covering_staff_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface StaffFeedbackRow {
  id: string;
  tenant_id: string;
  staff_profile_id: string;
  kind: FeedbackKind;
  from_name: string;
  subject: string | null;
  body: string;
  severity: FeedbackSeverity | null;
  occurred_at: string;
  created_at: string;
  updated_at: string;
}
