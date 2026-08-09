import type { VerifiedAdministratorIdentity } from './identity.js';

export interface GoogleIdTokenVerifier {
  verify(idToken: string): Promise<VerifiedAdministratorIdentity>;
}

