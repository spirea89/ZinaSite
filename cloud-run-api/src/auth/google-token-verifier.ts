import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import { ApiError } from '../api/errors.js';
import type { VerifiedAdministratorIdentity } from './identity.js';
import type { GoogleIdTokenVerifier } from './token-verifier.js';

const GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);
const CLOCK_SKEW_SECONDS = 300;

export function validateVerifiedGooglePayload(
  payload: TokenPayload,
  expectedAudience: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): VerifiedAdministratorIdentity {
  if (payload.aud !== expectedAudience) throw new Error('Invalid audience');
  if (!payload.iss || !GOOGLE_ISSUERS.has(payload.iss)) throw new Error('Invalid issuer');
  if (!payload.exp || payload.exp <= nowSeconds) throw new Error('Expired token');
  if (!payload.iat || payload.iat > nowSeconds + CLOCK_SKEW_SECONDS) throw new Error('Invalid issue time');
  if (!payload.sub) throw new Error('Missing subject');
  if (!payload.email || payload.email_verified !== true) throw new Error('Unverified email');
  const email = payload.email.trim().toLowerCase();
  if (!email) throw new Error('Missing email');
  if (!email.endsWith('@gmail.com') && !payload.hd) throw new Error('Google is not authoritative');
  return {
    subject: payload.sub,
    email,
    issuer: payload.iss as VerifiedAdministratorIdentity['issuer'],
    audience: payload.aud,
    expiresAt: payload.exp,
  };
}

export class OfficialGoogleIdTokenVerifier implements GoogleIdTokenVerifier {
  readonly #client: OAuth2Client;
  readonly #expectedAudience: string;

  constructor(expectedAudience: string, client = new OAuth2Client()) {
    this.#expectedAudience = expectedAudience;
    this.#client = client;
  }

  async verify(idToken: string): Promise<VerifiedAdministratorIdentity> {
    try {
      const ticket = await this.#client.verifyIdToken({ idToken, audience: this.#expectedAudience });
      const payload = ticket.getPayload();
      if (!payload) throw new Error('Missing verified payload');
      return validateVerifiedGooglePayload(payload, this.#expectedAudience);
    } catch {
      throw new ApiError('AUTHENTICATION_FAILED', 'Authentication failed.', 401);
    }
  }
}

