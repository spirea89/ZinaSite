import { ApiError } from '../api/errors.js';

export function extractBearerToken(authorization: string | string[] | undefined): string {
  if (authorization === undefined) {
    throw new ApiError('AUTHENTICATION_REQUIRED', 'Authentication is required.', 401);
  }
  if (Array.isArray(authorization) || !/^Bearer [^\s]+$/.test(authorization)) {
    throw new ApiError('AUTHENTICATION_FAILED', 'Authentication failed.', 401);
  }
  return authorization.slice('Bearer '.length);
}

