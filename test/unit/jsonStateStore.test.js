import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JsonStateStore } from '../../src/storage/jsonStateStore.js';

const TEST_DIR = join(import.meta.dirname, '..', 'tmp-state-store');

describe('JsonStateStore', () => {
  let store;

  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
    store = new JsonStateStore(TEST_DIR);
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('stores resources under data/resources and metadata under data/_meta', async () => {
    await store.insert('pets', { id: 1, name: 'Rex' });
    await store.writeRegistry({ operations: [{ key: 'POST /pets' }] });

    expect(existsSync(join(TEST_DIR, 'resources', 'pets.json'))).toBe(true);
    expect(existsSync(join(TEST_DIR, '_meta', 'registry.json'))).toBe(true);
    expect(JSON.parse(readFileSync(join(TEST_DIR, '_meta', 'registry.json'), 'utf8'))).toEqual({
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

    const reloaded = new JsonStateStore(TEST_DIR);

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
});
