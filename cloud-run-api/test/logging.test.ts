import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { createLoggerOptions } from '../src/logging.js';
import { testConfig } from './helpers.js';

describe('safe logging', () => {
  it('redacts sensitive fields and omits query strings', () => {
    const lines: string[] = [];
    const destination = { write(chunk: string) { lines.push(chunk); } };
    const logger = pino(createLoggerOptions(testConfig()), destination);
    logger.info({ req: { method: 'POST', url: '/v1/admin?token=private', headers: { authorization: 'Bearer private' } }, body: { idToken: 'private', email: 'private' } }, 'test');
    const output = lines.join('');
    expect(output).not.toContain('Bearer private');
    expect(output).not.toContain('token=private');
    expect(output).not.toContain('"private"');
  });
});
