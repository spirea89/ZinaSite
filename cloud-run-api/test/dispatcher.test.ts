import { describe, expect, it, vi } from 'vitest';
import { ActionDispatcher } from '../src/api/dispatcher.js';

describe('ActionDispatcher', () => {
  it('dispatches an explicitly registered action', async () => {
    const dispatcher = new ActionDispatcher();
    const handler = vi.fn(async () => ({ items: [] }));
    dispatcher.register('listAllEvents', handler);
    await expect(dispatcher.dispatch('listAllEvents', {}, { requestId: 'test-request' })).resolves.toEqual({ items: [] });
    expect(handler).toHaveBeenCalledOnce();
  });

  it('rejects unknown and malformed actions', async () => {
    const dispatcher = new ActionDispatcher();
    await expect(dispatcher.dispatch('deleteEverything', {}, { requestId: 'test' })).rejects.toMatchObject({ code: 'UNKNOWN_ADMIN_ACTION' });
    await expect(dispatcher.dispatch('../bad', {}, { requestId: 'test' })).rejects.toMatchObject({ code: 'INVALID_ACTION' });
  });

  it('rejects duplicate registrations', () => {
    const dispatcher = new ActionDispatcher();
    dispatcher.register('listAllEvents', async () => []);
    expect(() => dispatcher.register('listAllEvents', async () => [])).toThrow('Action already registered');
  });
});

