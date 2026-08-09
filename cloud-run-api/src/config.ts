import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  BODY_LIMIT_BYTES: z.coerce.number().int().min(1024).max(1_048_576).default(256_000),
  GOOGLE_OAUTH_CLIENT_ID: z.string().trim().min(1).max(500),
  ALLOWED_ADMIN_ORIGINS: z.string().default(''),
});

export type AppConfig = Readonly<{
  nodeEnv: z.infer<typeof configSchema>['NODE_ENV'];
  host: string;
  port: number;
  logLevel: z.infer<typeof configSchema>['LOG_LEVEL'];
  bodyLimitBytes: number;
  expectedGoogleAudience: string;
  allowedAdminOrigins: readonly string[];
}>;

function parseAllowedOrigins(value: string): readonly string[] {
  if (!value.trim()) return Object.freeze([]);
  const origins = value.split(',').map((origin) => origin.trim());
  const unique = new Set<string>();
  for (const origin of origins) {
    if (!origin || origin === '*') throw new Error('Invalid service configuration.');
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error('Invalid service configuration.');
    }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin || parsed.username || parsed.password) {
      throw new Error('Invalid service configuration.');
    }
    unique.add(origin);
  }
  return Object.freeze([...unique]);
}

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = configSchema.safeParse(environment);
  if (!parsed.success) {
    throw new Error('Invalid service configuration.');
  }
  return Object.freeze({
    nodeEnv: parsed.data.NODE_ENV,
    host: parsed.data.HOST,
    port: parsed.data.PORT,
    logLevel: parsed.data.LOG_LEVEL,
    bodyLimitBytes: parsed.data.BODY_LIMIT_BYTES,
    expectedGoogleAudience: parsed.data.GOOGLE_OAUTH_CLIENT_ID,
    allowedAdminOrigins: parseAllowedOrigins(parsed.data.ALLOWED_ADMIN_ORIGINS),
  });
}
