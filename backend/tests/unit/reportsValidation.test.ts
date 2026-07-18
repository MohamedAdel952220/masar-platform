import { describe, it, expect } from 'vitest';
import {
  listReportDraftsSchema,
  updateReportDraftSchema,
  sendReportDraftSchema,
  scheduleReportDraftSchema,
  resendReportDraftSchema,
  deleteReportDraftSchema,
  exportReportDraftSchema,
} from '../../src/validation/reports.schema.js';

const draftId = '11111111-1111-1111-1111-111111111111';
const batchId = '22222222-2222-2222-2222-222222222222';
const childId = '33333333-3333-3333-3333-333333333333';

describe('listReportDraftsSchema', () => {
  it('accepts an empty filter object', () => {
    expect(listReportDraftsSchema.safeParse({}).success).toBe(true);
  });

  it('accepts a batchId/childId filter', () => {
    expect(listReportDraftsSchema.safeParse({ batchId, childId }).success).toBe(true);
  });

  it('rejects a non-uuid batchId', () => {
    expect(listReportDraftsSchema.safeParse({ batchId: 'nope' }).success).toBe(false);
  });
});

describe('updateReportDraftSchema', () => {
  it('accepts a body-only update', () => {
    expect(updateReportDraftSchema.safeParse({ draftId, body: 'Revised report text.' }).success).toBe(true);
  });

  it('accepts a deliveryChannels-only update', () => {
    expect(updateReportDraftSchema.safeParse({ draftId, deliveryChannels: ['app', 'email'] }).success).toBe(true);
  });

  it('accepts a status-only update to "ready"', () => {
    expect(updateReportDraftSchema.safeParse({ draftId, status: 'ready' }).success).toBe(true);
  });

  it('rejects an update with no fields beyond draftId', () => {
    expect(updateReportDraftSchema.safeParse({ draftId }).success).toBe(false);
  });

  it('rejects an empty body string', () => {
    expect(updateReportDraftSchema.safeParse({ draftId, body: '   ' }).success).toBe(false);
  });

  it('rejects an empty deliveryChannels array', () => {
    expect(updateReportDraftSchema.safeParse({ draftId, deliveryChannels: [] }).success).toBe(false);
  });

  it('rejects an invalid delivery channel', () => {
    expect(updateReportDraftSchema.safeParse({ draftId, deliveryChannels: ['sms'] }).success).toBe(false);
  });

  // The RPCs (migration 5), not this schema, are the sole path to
  // scheduled/sent — this schema only ever accepts draft/ready, matching
  // ai_report_drafts_update_manager's own narrowed WITH CHECK (migration 4).
  it('rejects a status of "sent"', () => {
    expect(updateReportDraftSchema.safeParse({ draftId, status: 'sent' }).success).toBe(false);
  });

  it('rejects a status of "scheduled"', () => {
    expect(updateReportDraftSchema.safeParse({ draftId, status: 'scheduled' }).success).toBe(false);
  });

  it('rejects a non-uuid draftId', () => {
    expect(updateReportDraftSchema.safeParse({ draftId: 'nope', body: 'x' }).success).toBe(false);
  });
});

describe('sendReportDraftSchema / resendReportDraftSchema / deleteReportDraftSchema / exportReportDraftSchema', () => {
  it('accepts a valid draftId for each', () => {
    expect(sendReportDraftSchema.safeParse({ draftId }).success).toBe(true);
    expect(resendReportDraftSchema.safeParse({ draftId }).success).toBe(true);
    expect(deleteReportDraftSchema.safeParse({ draftId }).success).toBe(true);
    expect(exportReportDraftSchema.safeParse({ draftId }).success).toBe(true);
  });

  it('rejects a missing draftId for each', () => {
    expect(sendReportDraftSchema.safeParse({}).success).toBe(false);
    expect(resendReportDraftSchema.safeParse({}).success).toBe(false);
    expect(deleteReportDraftSchema.safeParse({}).success).toBe(false);
    expect(exportReportDraftSchema.safeParse({}).success).toBe(false);
  });

  // Fix for EPIC_8_REVIEW.md H1.
  it('accepts an optional, valid-uuid idempotencyKey for each', () => {
    const idempotencyKey = '99999999-9999-9999-9999-999999999999';
    expect(sendReportDraftSchema.safeParse({ draftId, idempotencyKey }).success).toBe(true);
    expect(resendReportDraftSchema.safeParse({ draftId, idempotencyKey }).success).toBe(true);
    expect(deleteReportDraftSchema.safeParse({ draftId, idempotencyKey }).success).toBe(true);
    expect(exportReportDraftSchema.safeParse({ draftId, idempotencyKey }).success).toBe(true);
  });

  it('rejects a non-uuid idempotencyKey for each', () => {
    expect(sendReportDraftSchema.safeParse({ draftId, idempotencyKey: 'nope' }).success).toBe(false);
    expect(resendReportDraftSchema.safeParse({ draftId, idempotencyKey: 'nope' }).success).toBe(false);
    expect(deleteReportDraftSchema.safeParse({ draftId, idempotencyKey: 'nope' }).success).toBe(false);
    expect(exportReportDraftSchema.safeParse({ draftId, idempotencyKey: 'nope' }).success).toBe(false);
  });
});

describe('scheduleReportDraftSchema', () => {
  it('accepts a valid future ISO timestamp', () => {
    expect(scheduleReportDraftSchema.safeParse({ draftId, scheduledFor: '2026-08-01T09:00:00.000Z' }).success).toBe(true);
  });

  // Fix for EPIC_8_REVIEW.md H1.
  it('accepts an optional, valid-uuid idempotencyKey', () => {
    expect(scheduleReportDraftSchema.safeParse({ draftId, scheduledFor: '2026-08-01T09:00:00.000Z', idempotencyKey: '99999999-9999-9999-9999-999999999999' }).success).toBe(true);
  });

  it('rejects a missing scheduledFor', () => {
    expect(scheduleReportDraftSchema.safeParse({ draftId }).success).toBe(false);
  });

  it('rejects a non-ISO scheduledFor string', () => {
    expect(scheduleReportDraftSchema.safeParse({ draftId, scheduledFor: 'next Tuesday' }).success).toBe(false);
  });

  // Note: "must be in the future" is enforced by schedule_report_draft
  // (migration 5) at call time, not by this schema — a schema-level check
  // would be a stale snapshot the moment the request is actually sent.
  it('accepts a syntactically valid past timestamp (future-ness is an RPC-level check)', () => {
    expect(scheduleReportDraftSchema.safeParse({ draftId, scheduledFor: '2020-01-01T00:00:00.000Z' }).success).toBe(true);
  });
});
