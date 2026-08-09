import type { CmsRepository, CmsSnapshot } from './cms-repository.js';

const EMPTY_SNAPSHOT: CmsSnapshot = Object.freeze({
  articles: Object.freeze([]),
  categories: Object.freeze([]),
  events: Object.freeze([]),
  teamMembers: Object.freeze([]),
  homepageContent: null,
});

export class InMemoryCmsRepository implements CmsRepository {
  readonly #snapshot: CmsSnapshot;

  constructor(snapshot: CmsSnapshot = EMPTY_SNAPSHOT) {
    this.#snapshot = structuredClone(snapshot);
  }

  async snapshot(): Promise<CmsSnapshot> {
    return structuredClone(this.#snapshot);
  }
}

