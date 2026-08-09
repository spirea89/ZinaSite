export interface CmsSnapshot {
  readonly articles: readonly unknown[];
  readonly categories: readonly unknown[];
  readonly events: readonly unknown[];
  readonly teamMembers: readonly unknown[];
  readonly homepageContent: unknown | null;
}

export interface CmsRepository {
  snapshot(): Promise<CmsSnapshot>;
}

