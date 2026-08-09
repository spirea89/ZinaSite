import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('uses safe local defaults', () => {
    expect(loadConfig({})).toEqual({
      nodeEnv: 'development', host: '0.0.0.0', port: 8080, logLevel: 'info', bodyLimitBytes: 256_000,
    });
  });

  it('fails without exposing configuration values', () => {
    expect(() => loadConfig({ PORT: 'secret-invalid-value' })).toThrow('Invalid service configuration.');
  });
});

