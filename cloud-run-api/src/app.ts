import Fastify, { type FastifyInstance } from 'fastify';
import { ApiError, publicError } from './api/errors.js';
import { failureEnvelope } from './api/envelope.js';
import type { AppConfig } from './config.js';
import { createLoggerOptions } from './logging.js';
import { registerHealthRoute } from './routes/health.js';

export async function buildApp(config: AppConfig): Promise<FastifyInstance> {
  const app = Fastify({
    logger: createLoggerOptions(config),
    bodyLimit: config.bodyLimitBytes,
    requestIdHeader: false,
  });

  app.setNotFoundHandler(async (_request, reply) => {
    return reply.code(404).send(failureEnvelope('NOT_FOUND', 'Route not found.'));
  });

  app.setErrorHandler(async (error, _request, reply) => {
    const safe = publicError(error);
    if (!(error instanceof ApiError && error.expose)) {
      app.log.error({ err: error }, 'Request failed');
    }
    return reply.code(safe.statusCode).send(failureEnvelope(safe.code, safe.message));
  });

  await registerHealthRoute(app);
  return app;
}
