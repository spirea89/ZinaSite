import { describe, expect, it } from 'vitest';
import { InMemoryCmsRepository } from '../src/repositories/in-memory-cms-repository.js';

describe('InMemoryCmsRepository', () => {
  it('starts empty and returns defensive copies', async () => {
    const repository = new InMemoryCmsRepository();
    const first = await repository.snapshot();
    const second = await repository.snapshot();
    expect(first).toEqual({ articles: [], categories: [], events: [], teamMembers: [], homepageContent: null });
    expect(first).not.toBe(second);
  });
});
