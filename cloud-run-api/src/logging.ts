import type { LoggerOptions } from 'pino';
import type { AppConfig } from './config.js';

const REDACTED = '[REDACTED]';

export function createLoggerOptions(config: AppConfig): LoggerOptions {
  return {
    level: config.logLevel,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers.set-cookie',
        'request.body',
        'body',
        '*.idToken',
        '*.email',
        '*.clientSecret',
      ],
      censor: REDACTED,
    },
    serializers: {
      req(request: { method?: string; url?: string }) {
        return {
          method: request.method,
          path: request.url?.split('?')[0],
        };
      },
      res(response: { statusCode?: number }) {
        return { statusCode: response.statusCode };
      },
      err(error: { name?: string; message?: string; code?: string }) {
        return {
          type: error.name ?? 'Error',
          message: error.message ?? 'Request failed',
          code: error.code,
        };
      },
    },
  };
}

