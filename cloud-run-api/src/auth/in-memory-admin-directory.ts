import type { AdministratorDirectory, AdministratorRecord } from './admin-directory.js';

export class InMemoryAdministratorDirectory implements AdministratorDirectory {
  readonly #records = new Map<string, AdministratorRecord>();

  constructor(records: readonly AdministratorRecord[] = []) {
    for (const record of records) {
      const normalized = record.email.trim().toLowerCase();
      if (!normalized || this.#records.has(normalized)) throw new Error('Invalid administrator fixture.');
      this.#records.set(normalized, { email: normalized, active: record.active === true });
    }
  }

  async findByNormalizedEmail(email: string): Promise<AdministratorRecord | null> {
    return this.#records.get(email) ?? null;
  }
}

