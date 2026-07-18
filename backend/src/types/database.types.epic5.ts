// Epic 5 snake_case row types, kept separate from database.types(.epicN).ts
// for the same reason those files are separate: repositories are the only
// place that ever sees a raw DB row shape.

export type RequestType = 'event' | 'trip' | 'exam';
export type ExamKind = 'weekly' | 'monthly';
export type RequestStatus = 'pending' | 'approved' | 'rejected';
export type EventType = 'exam' | 'celebration' | 'trip';
export type RsvpAttendee = 'child' | 'father' | 'mother' | 'both';
export type TripRegistrationStatus = 'open' | 'registered' | 'paid' | 'cancelled';

export interface RequestRow {
  id: string;
  tenant_id: string;
  submitted_by: string;
  type: RequestType;
  exam_kind: ExamKind | null;
  title: string;
  classroom_id: string | null;
  subject_id: string | null;
  request_date: string;
  request_time: string | null;
  note: string | null;
  place: string | null;
  price: number | null;
  attachment_object_id: string | null;
  status: RequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventRow {
  id: string;
  tenant_id: string;
  source_request_id: string | null;
  type: EventType;
  title: string;
  description: string | null;
  classroom_id: string | null;
  event_date: string;
  event_time: string | null;
  place: string | null;
  price: number | null;
  capacity: number | null;
  created_at: string;
  updated_at: string;
}

export interface EventRsvpRow {
  id: string;
  event_id: string;
  child_id: string;
  tenant_id: string;
  attendee: RsvpAttendee;
  extra_guest_name: string | null;
  extra_guest_relation: string | null;
  contact_phone: string | null;
  responded_at: string;
}

export interface EventTripRegistrationRow {
  id: string;
  event_id: string;
  child_id: string;
  tenant_id: string;
  status: TripRegistrationStatus;
  payment_transaction_id: string | null;
  created_at: string;
  updated_at: string;
}

// Shape of review_request's jsonb return value.
export interface ReviewRequestResultRow {
  request: RequestRow;
  event: EventRow | null;
}
