import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ApiError } from '../api/errors.js';
import { successEnvelope } from '../api/envelope.js';
import type { ActionDispatcher } from '../api/dispatcher.js';
import { extractBearerToken } from '../auth/authentication.js';
import { authorizeAdministrator } from '../auth/authorization.js';
import type { AdministratorDirectory } from '../auth/admin-directory.js';
import type { GoogleIdTokenVerifier } from '../auth/token-verifier.js';

const requestSchema = z.object({
  action: z.string().min(1).max(100),
}).strict();

export interface AdminRouteDependencies {
  readonly dispatcher: ActionDispatcher;
  readonly tokenVerifier: GoogleIdTokenVerifier;
  readonly administratorDirectory: AdministratorDirectory;
}

export async function registerAdminRoute(app: FastifyInstance, dependencies: AdminRouteDependencies): Promise<void> {
  app.post('/v1/admin', async (request, reply) => {
    const parsed = requestSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError('INVALID_PAYLOAD', 'Request body is invalid.', 400);
    const token = extractBearerToken(request.headers.authorization);
    const identity = await dependencies.tokenVerifier.verify(token);
    await authorizeAdministrator(identity, dependencies.administratorDirectory);
    const data = await dependencies.dispatcher.dispatch(parsed.data.action, undefined, { requestId: request.id });
    return reply.code(200).send(successEnvelope(data));
  });
}

