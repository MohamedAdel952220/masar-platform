// Tests for the fix to EPIC_2_REVIEW.md H1/M4: toAppError() must correctly
// parse the structured {code, human_message_en, human_message_ar} payload
// every Epic 1/Epic 2 RPC places in a Postgres exception's DETAIL clause
// (surfaced by PostgREST/supabase-js as error.details), and must fall back
// safely — without guessing a misleading specific code — for anything else.
import { describe, it, expect } from 'vitest';
import { toAppError } from '../../src/lib/rpcError.js';
import { AppError } from '../../src/lib/errors.js';

describe('toAppError', () => {
  it('parses a well-formed structured DETAIL payload into a matching AppError', () => {
    const pgError = {
      message: 'Classroom is at full capacity',
      details: JSON.stringify({
        code: 'VALIDATION_FAILED',
        human_message_en: 'This classroom is at full capacity.',
        human_message_ar: 'هذا الفصل ممتلئ بالكامل.',
      }),
      hint: null,
      code: 'P0001',
    };

    const result = toAppError(pgError);
    expect(result).toBeInstanceOf(AppError);
    expect(result.code).toBe('VALIDATION_FAILED');
    expect(result.messageEn).toBe('This classroom is at full capacity.');
    expect(result.messageAr).toBe('هذا الفصل ممتلئ بالكامل.');
  });

  it('correctly distinguishes different structured codes (not fixed to one case)', () => {
    const notFound = toAppError({
      message: 'Classroom not found',
      details: JSON.stringify({ code: 'NOT_FOUND', human_message_en: 'Classroom not found.', human_message_ar: 'لم يتم العثور على الفصل.' }),
    });
    expect(notFound.code).toBe('NOT_FOUND');

    const stateAlready = toAppError({
      message: 'already suspended',
      details: JSON.stringify({ code: 'STATE_ALREADY_PROCESSED', human_message_en: 'Already suspended.', human_message_ar: 'معلّق بالفعل.' }),
    });
    expect(stateAlready.code).toBe('STATE_ALREADY_PROCESSED');
  });

  it('regression test for EPIC_2_REVIEW.md M4: does NOT misclassify an unrelated error as EXTERNAL_AUTH_ADMIN_FAILURE via substring guessing', () => {
    // Previously, enroll-child's own ad-hoc substring matching
    // (`if (detail.includes('full capacity'))...else EXTERNAL_AUTH_ADMIN_FAILURE`)
    // would have mapped ANY unrecognized error — e.g. a numeric cast failure
    // on an address field — to a code that specifically implies an Auth
    // Admin API problem. toAppError must never do that: unrecognized errors
    // fall back to the generic VALIDATION_FAILED code, not a specific wrong one.
    const castError = { message: 'invalid input syntax for type numeric: "abc"', details: null, code: '22P02' };
    const result = toAppError(castError);
    expect(result.code).toBe('VALIDATION_FAILED');
    expect(result.code).not.toBe('EXTERNAL_AUTH_ADMIN_FAILURE');
    expect(result.messageEn).toContain('invalid input syntax');
  });

  it('falls back gracefully when details is missing entirely', () => {
    const result = toAppError({ message: 'connection reset', details: undefined });
    expect(result).toBeInstanceOf(AppError);
    expect(result.code).toBe('VALIDATION_FAILED');
    expect(result.messageEn).toBe('connection reset');
  });

  it('falls back gracefully when details is present but not valid JSON', () => {
    const result = toAppError({ message: 'oops', details: 'not json at all' });
    expect(result.code).toBe('VALIDATION_FAILED');
  });

  it('falls back gracefully when details parses but the code is not a recognized ErrorCode', () => {
    const result = toAppError({ message: 'oops', details: JSON.stringify({ code: 'SOME_MADE_UP_CODE', human_message_en: 'x', human_message_ar: 'y' }) });
    expect(result.code).toBe('VALIDATION_FAILED');
  });

  it('passes an existing AppError through unchanged', () => {
    const original = new AppError('PERM_ROLE_DENIED', 'nope', 'لا');
    const result = toAppError(original);
    expect(result).toBe(original);
  });

  it('handles a plain Error (non-PostgrestError) input', () => {
    const result = toAppError(new Error('plain JS error'));
    expect(result.code).toBe('VALIDATION_FAILED');
    expect(result.messageEn).toBe('plain JS error');
  });

  // Fix for EPIC_3_REVIEW.md L4: a raw Postgres constraint-violation error
  // (reachable via the TOCTOU races EPIC_3_REVIEW.md M3 narrowed but did
  // not eliminate) must not leak its raw, untranslated message to the end
  // user.
  it('regression test for EPIC_3_REVIEW.md L4: masks a raw unique_violation with a clean, bilingual, generic message', () => {
    const uniqueViolation = {
      message: 'duplicate key value violates unique constraint "trips_bus_leg_date_key"',
      details: null,
      code: '23505',
    };
    const result = toAppError(uniqueViolation);
    expect(result.code).toBe('VALIDATION_FAILED');
    expect(result.messageEn).not.toMatch(/duplicate key|constraint/i);
    expect(result.messageAr.length).toBeGreaterThan(0);
  });

  it('L4 fix does not affect non-constraint-violation Postgres error codes', () => {
    const castError = { message: 'invalid input syntax for type numeric: "abc"', details: null, code: '22P02' };
    const result = toAppError(castError);
    expect(result.messageEn).toContain('invalid input syntax');
  });
});
