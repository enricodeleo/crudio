import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { JsonStateStore } from '../../src/storage/jsonStateStore.js';

describe('JsonStateStore', () => {
  let testDir;
  let store;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'crudio-'));
    store = new JsonStateStore(testDir);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('stores resources under data/resources and metadata under data/_meta', async () => {
    await store.insert('pets', { id: 1, name: 'Rex' });
    await store.writeRegistry({ operations: [{ key: 'POST /pets' }] });

    expect(existsSync(join(testDir, 'resources', 'pets.json'))).toBe(true);
    expect(existsSync(join(testDir, '_meta', 'registry.json'))).toBe(true);
    expect(JSON.parse(readFileSync(join(testDir, '_meta', 'registry.json'), 'utf8'))).toEqual({
      operations: [{ key: 'POST /pets' }],
    });
  });

  it('returns empty results for missing resources', async () => {
    expect(await store.findAll('pets')).toEqual([]);
    expect(await store.findById('pets', 1)).toBeNull();
    expect(await store.count('pets')).toBe(0);
  });

  it('persists CRUD operations across store re-instantiation', async () => {
    await store.insert('pets', { id: 1, name: 'Rex', tag: 'dog' });
    await store.insert('pets', { id: 2, name: 'Milo', tag: 'cat' });
    await store.update('pets', 2, { id: 2, name: 'Milo II', tag: 'cat' });
    await store.delete('pets', 1);

    const reloaded = new JsonStateStore(testDir);

    expect(await reloaded.findAll('pets')).toEqual([{ id: 2, name: 'Milo II', tag: 'cat' }]);
    expect(await reloaded.findById('pets', 1)).toBeNull();
    expect(await reloaded.findById('pets', 2)).toEqual({ id: 2, name: 'Milo II', tag: 'cat' });
  });

  it('applies filters, pagination, and filtered counts', async () => {
    await store.insert('pets', { id: 1, name: 'Rex', tag: 'dog' });
    await store.insert('pets', { id: 2, name: 'Milo', tag: 'cat' });
    await store.insert('pets', { id: 3, name: 'Buddy', tag: 'dog' });

    expect(await store.findAll('pets', { filters: { tag: 'dog' } })).toEqual([
      { id: 1, name: 'Rex', tag: 'dog' },
      { id: 3, name: 'Buddy', tag: 'dog' },
    ]);
    expect(await store.findAll('pets', { offset: 1, limit: 1 })).toEqual([
      { id: 2, name: 'Milo', tag: 'cat' },
    ]);
    expect(await store.count('pets')).toBe(3);
    expect(await store.count('pets', { filters: { tag: 'dog' } })).toBe(2);
  });

  it('persists operation state by operation key and scope key', async () => {
    await store.writeOperationState('GET /countries/{code}/summary', 'code=IT', {
      status: 200,
      body: { code: 'IT', status: 'ready' },
      headers: {},
    });

    const reloaded = new JsonStateStore(testDir);

    expect(await reloaded.readOperationState('GET /countries/{code}/summary', 'code=IT')).toEqual({
      status: 200,
      body: { code: 'IT', status: 'ready' },
      headers: {},
    });
  });

  it('stores and reloads a default operation state separately from scoped entries', async () => {
    await store.writeOperationState('GET /countries/{code}/summary', 'code=IT', {
      status: 200,
      body: { code: 'IT', status: 'ready' },
      headers: {},
    });
    await store.writeOperationDefaultState('GET /countries/{code}/summary', {
      status: 200,
      body: { status: 'unavailable' },
      headers: {},
    });

    const reloaded = new JsonStateStore(testDir);

    expect(await reloaded.readOperationDefaultState('GET /countries/{code}/summary')).toEqual({
      status: 200,
      body: { status: 'unavailable' },
      headers: {},
    });
    expect(await reloaded.readOperationState('GET /countries/{code}/summary', 'code=IT')).toEqual({
      status: 200,
      body: { code: 'IT', status: 'ready' },
      headers: {},
    });
  });

  it('preserves arbitrary metadata fields on operation default state (e.g. origin)', async () => {
    await store.writeOperationDefaultState('POST /devices/search', {
      status: 200,
      body: [{ type: 'DESKTOP' }],
      headers: {},
      origin: 'auto-fake',
    });

    const reloaded = new JsonStateStore(testDir);
    const state = await reloaded.readOperationDefaultState('POST /devices/search');
    expect(state.origin).toBe('auto-fake');
    expect(state.body).toEqual([{ type: 'DESKTOP' }]);
  });

  it('does not create registry metadata when reading unseen operation state', async () => {
    const registryFile = join(testDir, '_meta', 'registry.json');

    expect(await store.readOperationState('GET /countries/{code}/summary', 'code=IT')).toBeNull();
    expect(await store.readOperationDefaultState('GET /countries/{code}/summary')).toBeNull();
    expect(await store.deleteOperationState('GET /countries/{code}/summary', 'code=IT')).toBe(false);
    expect(existsSync(registryFile)).toBe(false);
  });

  it('preserves operation state hashes when writing the registry after persisting operation state', async () => {
    await store.writeOperationState('GET /countries/{code}/summary', 'code=IT', {
      status: 200,
      body: { code: 'IT', status: 'ready' },
      headers: {},
    });

    const registryFile = join(testDir, '_meta', 'registry.json');
    const registryBefore = JSON.parse(readFileSync(registryFile, 'utf8'));

    await store.writeRegistry({ operations: [{ key: 'GET /countries/{code}/summary' }] });

    expect(JSON.parse(readFileSync(registryFile, 'utf8'))).toEqual({
      operations: [{ key: 'GET /countries/{code}/summary' }],
      operationStateHashes: registryBefore.operationStateHashes,
    });
  });

  it('round-trips the empty scope key for path-less operations', async () => {
    await store.writeOperationState('POST /auth/login', '', {
      status: 200,
      body: { token: 'demo' },
      headers: {},
    });

    const reloaded = new JsonStateStore(testDir);

    expect(await reloaded.readOperationState('POST /auth/login', '')).toEqual({
      status: 200,
      body: { token: 'demo' },
      headers: {},
    });
  });

  it('throws loudly on operation state hash collisions', async () => {
    vi.resetModules();
    vi.doMock('node:crypto', async () => {
      const actual = await vi.importActual('node:crypto');
      return {
        ...actual,
        createHash() {
          return {
            update() {
              return this;
            },
            digest() {
              return 'collision-hash-value';
            },
          };
        },
      };
    });

    try {
      const { JsonStateStore: MockedJsonStateStore } = await import(
        '../../src/storage/jsonStateStore.js'
      );
      const collisionDir = mkdtempSync(join(tmpdir(), 'crudio-collision-'));

      try {
        const collisionStore = new MockedJsonStateStore(collisionDir);
        await collisionStore.writeOperationState('GET /alpha', '', { status: 200 });
        await expect(collisionStore.writeOperationState('GET /beta', '', { status: 200 })).rejects
          .toThrow(/Operation state hash collision/);
      } finally {
        rmSync(collisionDir, { recursive: true, force: true });
      }
    } finally {
      vi.doUnmock('node:crypto');
      vi.resetModules();
    }
  });
});
