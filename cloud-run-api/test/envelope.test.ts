import { describe, expect, it } from 'vitest';
import { failureEnvelope, successEnvelope } from '../src/api/envelope.js';
import { ApiError, publicError } from '../src/api/errors.js';

describe('API envelopes', () => {
  it('matches the Apps Script success shape', () => {
    expect(successEnvelope({ status: 'ok' })).toEqual({ ok: true, data: { status: 'ok' }, error: null, version: 'v1' });
  });

  it('matches the Apps Script failure shape', () => {
    expect(failureEnvelope('BAD_REQUEST', 'Bad request.')).toEqual({ ok: false, data: null, error: { code: 'BAD_REQUEST', message: 'Bad request.' }, version: 'v1' });
  });

  it('redacts untrusted internal errors', () => {
    expect(publicError(new Error('private spreadsheet detail'))).toEqual({ code: 'INTERNAL_ERROR', message: 'The request could not be completed.', statusCode: 500 });
  });

  it('exposes explicitly safe API errors', () => {
    expect(publicError(new ApiError('INVALID_ID', 'ID is invalid.', 400))).toEqual({ code: 'INVALID_ID', message: 'ID is invalid.', statusCode: 400 });
  });
});

