import { describe, expect, it } from 'vitest';
import { extractBearerToken } from '../src/auth/authentication.js';

describe('extractBearerToken', () => {
  it('extracts one strict bearer credential', () => {
    expect(extractBearerToken('Bearer fake-unit-test-credential')).toBe('fake-unit-test-credential');
  });

  it('rejects missing and malformed authorization', () => {
    expect(() => extractBearerToken(undefined)).toThrow(expect.objectContaining({ code: 'AUTHENTICATION_REQUIRED', statusCode: 401 }));
    for (const value of ['Basic value', 'bearer value', 'Bearer', 'Bearer two values', ' Bearer value']) {
      expect(() => extractBearerToken(value)).toThrow(expect.objectContaining({ code: 'AUTHENTICATION_FAILED', statusCode: 401 }));
    }
  });
});

