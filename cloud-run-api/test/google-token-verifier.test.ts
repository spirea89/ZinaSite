import type { TokenPayload } from 'google-auth-library';
import { describe, expect, it } from 'vitest';
import { validateVerifiedGooglePayload } from '../src/auth/google-token-verifier.js';
import { TEST_AUDIENCE } from './helpers.js';

const NOW = 1_900_000_000;
const EMAIL = 'operator' + '@gmail.com';
const validPayload: TokenPayload = {
  aud: TEST_AUDIENCE,
  iss: 'https://accounts.google.com',
  exp: NOW + 600,
  iat: NOW - 10,
  sub: 'unit-test-subject',
  email: EMAIL.toUpperCase(),
  email_verified: true,
};

describe('validateVerifiedGooglePayload', () => {
  it('normalizes a verified Google identity', () => {
    expect(validateVerifiedGooglePayload(validPayload, TEST_AUDIENCE, NOW)).toMatchObject({
      email: EMAIL,
      subject: 'unit-test-subject',
      audience: TEST_AUDIENCE,
      issuer: 'https://accounts.google.com',
    });
  });

  it.each([
    ['audience', { aud: 'wrong-audience' }],
    ['issuer', { iss: 'https://issuer.example.invalid' }],
    ['expiry', { exp: NOW }],
    ['future issue time', { iat: NOW + 301 }],
    ['subject', { sub: '' }],
    ['verified email', { email_verified: false }],
    ['email', { email: '' }],
  ])('rejects invalid %s', (_name, change) => {
    expect(() => validateVerifiedGooglePayload({ ...validPayload, ...change }, TEST_AUDIENCE, NOW)).toThrow();
  });

  it('requires Google authority for non-Gmail addresses', () => {
    const hostedEmail = 'operator' + '@example.invalid';
    expect(() => validateVerifiedGooglePayload({ ...validPayload, email: hostedEmail }, TEST_AUDIENCE, NOW)).toThrow();
    expect(validateVerifiedGooglePayload({ ...validPayload, email: hostedEmail, hd: 'example.invalid' }, TEST_AUDIENCE, NOW).email).toBe(hostedEmail);
  });
});

