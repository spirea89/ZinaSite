export interface VerifiedAdministratorIdentity {
  readonly subject: string;
  readonly email: string;
  readonly issuer: 'accounts.google.com' | 'https://accounts.google.com';
  readonly audience: string;
  readonly expiresAt: number;
}

