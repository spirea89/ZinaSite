import { describe, expect, it } from 'vitest';
import { authorizeAdministrator } from '../src/auth/authorization.js';
import { InMemoryAdministratorDirectory } from '../src/auth/in-memory-admin-directory.js';
import { TEST_EMAIL, TEST_IDENTITY } from './helpers.js';

describe('authorizeAdministrator', () => {
  it('rejects missing and inactive administrators', async () => {
    await expect(authorizeAdministrator(TEST_IDENTITY, new InMemoryAdministratorDirectory())).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });
    await expect(authorizeAdministrator(TEST_IDENTITY, new InMemoryAdministratorDirectory([{ email: TEST_EMAIL, active: false }]))).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });
  });

  it('accepts one exact active normalized administrator', async () => {
    const identity = await authorizeAdministrator(TEST_IDENTITY, new InMemoryAdministratorDirectory([{ email: TEST_EMAIL.toUpperCase(), active: true }]));
    expect(identity).toBe(TEST_IDENTITY);
  });

  it('rejects duplicate normalized fixtures', () => {
    expect(() => new InMemoryAdministratorDirectory([{ email: TEST_EMAIL, active: true }, { email: TEST_EMAIL.toUpperCase(), active: true }])).toThrow('Invalid administrator fixture.');
  });
});

