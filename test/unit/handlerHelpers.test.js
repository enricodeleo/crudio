import { describe, expect, it, vi } from 'vitest';
import { buildHandlerStateHelpers } from '../../src/http/buildHandlerStateHelpers.js';
import { buildHandlerResourceHelpers } from '../../src/http/buildHandlerResourceHelpers.js';

describe('buildHandlerStateHelpers', () => {
  it('reads and writes the current scoped operation state', async () => {
    const storage = {
      readOperationState: vi.fn().mockResolvedValue(null),
      writeOperationState: vi.fn().mockResolvedValue(),
      deleteOperationState: vi.fn().mockResolvedValue(true),
      readOperationDefaultState: vi.fn().mockResolvedValue(null),
      writeOperationDefaultState: vi.fn().mockResolvedValue(),
    };

    const state = buildHandlerStateHelpers(storage, 'POST /auth/login', '');

    expect(await state.get()).toBeNull();
    await state.set({ token: 'demo' });
    expect(storage.writeOperationState).toHaveBeenCalledWith('POST /auth/login', '', {
      status: 200,
      body: { token: 'demo' },
      headers: {},
    });
    await state.delete();
    expect(storage.deleteOperationState).toHaveBeenCalledWith('POST /auth/login', '');
    expect(await state.getDefault()).toBeNull();
    await state.setDefault({ token: 'seed' });
    expect(storage.writeOperationDefaultState).toHaveBeenCalledWith('POST /auth/login', {
      status: 200,
      body: { token: 'seed' },
      headers: {},
    });
  });
});

describe('buildHandlerResourceHelpers', () => {
  it('delegates CRUD helpers to the named engine', async () => {
    const engine = {
      getById: vi.fn().mockResolvedValue({ id: 1, name: 'Rex' }),
      list: vi.fn().mockResolvedValue([{ id: 1 }]),
      create: vi.fn().mockResolvedValue({ id: 1, name: 'Rex' }),
      update: vi.fn().mockResolvedValue({ id: 1, name: 'Max' }),
      patch: vi.fn().mockResolvedValue({ id: 1, enabled: true }),
      delete: vi.fn().mockResolvedValue(true),
    };
    const resources = buildHandlerResourceHelpers(new Map([['pets', { engine }]]));

    expect(await resources.get('pets', 1)).toEqual({ id: 1, name: 'Rex' });
    expect(await resources.list('pets', { limit: 1 })).toEqual([{ id: 1 }]);
    expect(await resources.create('pets', { name: 'Rex' })).toEqual({ id: 1, name: 'Rex' });
    expect(await resources.update('pets', 1, { name: 'Max' })).toEqual({ id: 1, name: 'Max' });
    expect(await resources.patch('pets', 1, { enabled: true })).toEqual({ id: 1, enabled: true });
    expect(await resources.delete('pets', 1)).toBe(true);

    expect(engine.getById).toHaveBeenCalledWith(1);
    expect(engine.list).toHaveBeenCalledWith({ limit: 1 });
    expect(engine.create).toHaveBeenCalledWith({ name: 'Rex' });
    expect(engine.update).toHaveBeenCalledWith(1, { name: 'Max' });
    expect(engine.patch).toHaveBeenCalledWith(1, { enabled: true });
    expect(engine.delete).toHaveBeenCalledWith(1);
  });
});
