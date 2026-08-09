import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import { ActionDispatcher } from './api/dispatcher.js';
import { ApiError, publicError } from './api/errors.js';
import { failureEnvelope } from './api/envelope.js';
import { registerProtectedReadActions } from './actions/protected-read-actions.js';
import type { AdministratorDirectory } from './auth/admin-directory.js';
import { InMemoryAdministratorDirectory } from './auth/in-memory-admin-directory.js';
import { OfficialGoogleIdTokenVerifier } from './auth/google-token-verifier.js';
import type { GoogleIdTokenVerifier } from './auth/token-verifier.js';
import type { AppConfig } from './config.js';
import { createLoggerOptions } from './logging.js';
import type { CmsRepository } from './repositories/cms-repository.js';
import { InMemoryCmsRepository } from './repositories/in-memory-cms-repository.js';
import { registerAdminRoute } from './routes/admin.js';
import { registerHealthRoute } from './routes/health.js';

export interface AppDependencies {
  readonly tokenVerifier: GoogleIdTokenVerifier;
  readonly administratorDirectory: AdministratorDirectory;
  readonly cmsRepository: CmsRepository;
}

function defaultDependencies(config: AppConfig): AppDependencies {
  return {
    tokenVerifier: new OfficialGoogleIdTokenVerifier(config.expectedGoogleAudience),
    administratorDirectory: new InMemoryAdministratorDirectory(),
    cmsRepository: new InMemoryCmsRepository(),
  };
}

export async function buildApp(config: AppConfig, suppliedDependencies?: AppDependencies): Promise<FastifyInstance> {
  const dependencies = suppliedDependencies ?? defaultDependencies(config);
  const app = Fastify({
    logger: createLoggerOptions(config),
    bodyLimit: config.bodyLimitBytes,
    requestIdHeader: false,
  });

  await app.register(cors, {
    origin(origin, callback) {
      callback(null, origin !== undefined && config.allowedAdminOrigins.includes(origin));
    },
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    credentials: false,
    strictPreflight: true,
    optionsSuccessStatus: 204,
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
  const dispatcher = new ActionDispatcher();
  registerProtectedReadActions(dispatcher, dependencies.cmsRepository);
  await registerAdminRoute(app, {
    dispatcher,
    tokenVerifier: dependencies.tokenVerifier,
    administratorDirectory: dependencies.administratorDirectory,
  });
  return app;
}
