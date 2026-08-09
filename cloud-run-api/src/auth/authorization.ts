import { ApiError } from '../api/errors.js';
import type { AdministratorDirectory } from './admin-directory.js';
import type { VerifiedAdministratorIdentity } from './identity.js';

export async function authorizeAdministrator(
  identity: VerifiedAdministratorIdentity,
  directory: AdministratorDirectory,
): Promise<VerifiedAdministratorIdentity> {
  const record = await directory.findByNormalizedEmail(identity.email);
  if (!record || record.active !== true || record.email !== identity.email) {
    throw new ApiError('FORBIDDEN', 'Administrator access is not authorized.', 403);
  }
  return identity;
}
