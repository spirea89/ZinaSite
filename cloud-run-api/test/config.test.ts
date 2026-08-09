import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('uses safe local defaults', () => {
    expect(loadConfig({ GOOGLE_OAUTH_CLIENT_ID: 'unit-test-audience' })).toEqual({
      nodeEnv: 'development', host: '0.0.0.0', port: 8080, logLevel: 'info', bodyLimitBytes: 256_000,
      expectedGoogleAudience: 'unit-test-audience', allowedAdminOrigins: [],
    });
  });

  it('fails without exposing configuration values', () => {
    expect(() => loadConfig({ PORT: 'secret-invalid-value', GOOGLE_OAUTH_CLIENT_ID: 'unit-test-audience' })).toThrow('Invalid service configuration.');
    expect(() => loadConfig({})).toThrow('Invalid service configuration.');
  });

  it('accepts only exact non-wildcard origins', () => {
    const config = loadConfig({
      GOOGLE_OAUTH_CLIENT_ID: 'unit-test-audience',
      ALLOWED_ADMIN_ORIGINS: 'https://one.example.invalid,http://localhost:8765',
    });
    expect(config.allowedAdminOrigins).toEqual(['https://one.example.invalid', 'http://localhost:8765']);
    expect(() => loadConfig({ GOOGLE_OAUTH_CLIENT_ID: 'unit-test-audience', ALLOWED_ADMIN_ORIGINS: '*' })).toThrow('Invalid service configuration.');
    expect(() => loadConfig({ GOOGLE_OAUTH_CLIENT_ID: 'unit-test-audience', ALLOWED_ADMIN_ORIGINS: 'https://one.example.invalid/path' })).toThrow('Invalid service configuration.');
  });
});
