// API handlers for submit-request / review-request / update-rsvp /
// register-for-trip / cancel-trip-registration — mirrors the corresponding
// RPCs and direct-CRUD paths (§14.2).
import {
  submitRequestSchema,
  reviewRequestSchema,
  updateRsvpSchema,
  registerForTripSchema,
  cancelTripRegistrationSchema,
} from '../../validation/approvals.schema.js';
import { AppError } from '../../lib/errors.js';
import type { ApprovalRequestService } from '../../services/approvalRequestService.js';
import type { EventService } from '../../services/eventService.js';
import type { CallerContext } from '../../types/domain.js';
import type { ApprovalRequest, ReviewRequestResult, EventRsvp, EventTripRegistration } from '../../types/domain.epic5.js';

function throwValidation(issues: { message: string }[]): never {
  throw new AppError('VALIDATION_FAILED', issues.map((i) => i.message).join('; '), 'تحقق من صحة البيانات المدخلة.');
}

export async function submitRequestRoute(service: ApprovalRequestService, caller: CallerContext, rawBody: unknown): Promise<ApprovalRequest> {
  const parsed = submitRequestSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.submit(parsed.data, caller);
}

export async function reviewRequestRoute(service: ApprovalRequestService, caller: CallerContext, rawBody: unknown): Promise<ReviewRequestResult> {
  const parsed = reviewRequestSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.review(parsed.data, caller);
}

export async function updateRsvpRoute(service: EventService, caller: CallerContext, rawBody: unknown): Promise<EventRsvp> {
  const parsed = updateRsvpSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.updateRsvp(parsed.data, caller);
}

export async function registerForTripRoute(service: EventService, caller: CallerContext, rawBody: unknown): Promise<EventTripRegistration> {
  const parsed = registerForTripSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.registerForTrip(parsed.data, caller);
}

export async function cancelTripRegistrationRoute(service: EventService, caller: CallerContext, rawBody: unknown): Promise<EventTripRegistration> {
  const parsed = cancelTripRegistrationSchema.safeParse(rawBody);
  if (!parsed.success) throwValidation(parsed.error.issues);
  return service.cancelTripRegistration(parsed.data, caller);
}
