// Epic 5 domain (camelCase) types + row<->domain mappers.
import type {
  RequestRow,
  EventRow,
  EventRsvpRow,
  EventTripRegistrationRow,
  ReviewRequestResultRow,
  RequestType,
  ExamKind,
  RequestStatus,
  EventType,
  RsvpAttendee,
  TripRegistrationStatus,
} from './database.types.epic5.js';

export interface ApprovalRequest {
  id: string;
  tenantId: string;
  submittedBy: string;
  type: RequestType;
  examKind: ExamKind | null;
  title: string;
  classroomId: string | null;
  subjectId: string | null;
  requestDate: string;
  requestTime: string | null;
  note: string | null;
  place: string | null;
  price: number | null;
  attachmentObjectId: string | null;
  status: RequestStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
}

export function approvalRequestFromRow(row: RequestRow): ApprovalRequest {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    submittedBy: row.submitted_by,
    type: row.type,
    examKind: row.exam_kind,
    title: row.title,
    classroomId: row.classroom_id,
    subjectId: row.subject_id,
    requestDate: row.request_date,
    requestTime: row.request_time,
    note: row.note,
    place: row.place,
    price: row.price === null ? null : Number(row.price),
    attachmentObjectId: row.attachment_object_id,
    status: row.status,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    rejectionReason: row.rejection_reason,
  };
}

export interface ApprovalEvent {
  id: string;
  tenantId: string;
  sourceRequestId: string | null;
  type: EventType;
  title: string;
  description: string | null;
  classroomId: string | null;
  eventDate: string;
  eventTime: string | null;
  place: string | null;
  price: number | null;
  capacity: number | null;
}

export function approvalEventFromRow(row: EventRow): ApprovalEvent {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    sourceRequestId: row.source_request_id,
    type: row.type,
    title: row.title,
    description: row.description,
    classroomId: row.classroom_id,
    eventDate: row.event_date,
    eventTime: row.event_time,
    place: row.place,
    price: row.price === null ? null : Number(row.price),
    capacity: row.capacity,
  };
}

export interface EventRsvp {
  id: string;
  eventId: string;
  childId: string;
  tenantId: string;
  attendee: RsvpAttendee;
  extraGuestName: string | null;
  extraGuestRelation: string | null;
  contactPhone: string | null;
  respondedAt: string;
}

export function eventRsvpFromRow(row: EventRsvpRow): EventRsvp {
  return {
    id: row.id,
    eventId: row.event_id,
    childId: row.child_id,
    tenantId: row.tenant_id,
    attendee: row.attendee,
    extraGuestName: row.extra_guest_name,
    extraGuestRelation: row.extra_guest_relation,
    contactPhone: row.contact_phone,
    respondedAt: row.responded_at,
  };
}

export interface EventTripRegistration {
  id: string;
  eventId: string;
  childId: string;
  tenantId: string;
  status: TripRegistrationStatus;
  paymentTransactionId: string | null;
}

export function eventTripRegistrationFromRow(row: EventTripRegistrationRow): EventTripRegistration {
  return {
    id: row.id,
    eventId: row.event_id,
    childId: row.child_id,
    tenantId: row.tenant_id,
    status: row.status,
    paymentTransactionId: row.payment_transaction_id,
  };
}

export interface ReviewRequestResult {
  request: ApprovalRequest;
  event: ApprovalEvent | null;
}

export function reviewRequestResultFromRow(row: ReviewRequestResultRow): ReviewRequestResult {
  return {
    request: approvalRequestFromRow(row.request),
    event: row.event ? approvalEventFromRow(row.event) : null,
  };
}
