import type { FastifyInstance } from 'fastify';
import { successEnvelope } from '../api/envelope.js';

export async function registerHealthRoute(app: FastifyInstance): Promise<void> {
  app.get('/health', async (_request, reply) => {
    return reply.code(200).send(successEnvelope({ status: 'ok' as const }));
  });
}

