import type { ActionDispatcher } from '../api/dispatcher.js';
import type { CmsRepository } from '../repositories/cms-repository.js';

export const PROTECTED_READ_ACTIONS = Object.freeze([
  'listAllArticles',
  'listArticleCategories',
  'listAllEvents',
  'listTeamMembers',
  'getHomepageContent',
] as const);

export function registerProtectedReadActions(dispatcher: ActionDispatcher, repository: CmsRepository): void {
  dispatcher.register('listAllArticles', async () => (await repository.snapshot()).articles);
  dispatcher.register('listArticleCategories', async () => (await repository.snapshot()).categories);
  dispatcher.register('listAllEvents', async () => (await repository.snapshot()).events);
  dispatcher.register('listTeamMembers', async () => (await repository.snapshot()).teamMembers);
  dispatcher.register('getHomepageContent', async () => (await repository.snapshot()).homepageContent);
}

