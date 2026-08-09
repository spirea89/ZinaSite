import { ApiError } from '../src/api/errors.js';
import type { VerifiedAdministratorIdentity } from '../src/auth/identity.js';
import type { GoogleIdTokenVerifier } from '../src/auth/token-verifier.js';
import { loadConfig } from '../src/config.js';

export const TEST_AUDIENCE = 'unit-test-audience';
export const TEST_ORIGIN = 'https://admin.example.invalid';
export const TEST_EMAIL = 'operator' + '@example.invalid';

export const TEST_IDENTITY: VerifiedAdministratorIdentity = Object.freeze({
  subject: 'unit-test-subject',
  email: TEST_EMAIL,
  issuer: 'https://accounts.google.com',
  audience: TEST_AUDIENCE,
  expiresAt: 2_000_000_000,
});

export function testConfig() {
  return loadConfig({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    GOOGLE_OAUTH_CLIENT_ID: TEST_AUDIENCE,
    ALLOWED_ADMIN_ORIGINS: TEST_ORIGIN,
  });
}

export class FakeTokenVerifier implements GoogleIdTokenVerifier {
  constructor(
    private readonly identity: VerifiedAdministratorIdentity = TEST_IDENTITY,
    private readonly failure = false,
  ) {}

  async verify(_idToken: string): Promise<VerifiedAdministratorIdentity> {
    if (this.failure) throw new ApiError('AUTHENTICATION_FAILED', 'Authentication failed.', 401);
    return this.identity;
  }
}

