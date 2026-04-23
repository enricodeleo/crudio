import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { JsonFileAdapter } from '../../src/storage/jsonFileAdapter.js';

const TEST_DIR = join(import.meta.dirname, '..', 'tmp-storage');

describe('JsonFileAdapter', () => {
  let adapter;

  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
    adapter = new JsonFileAdapter(TEST_DIR);
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('findAll returns empty array for missing resource', async () => {
    const items = await adapter.findAll('users');
    expect(items).toEqual([]);
  });

  it('findById returns null for missing item', async () => {
    const item = await adapter.findById('users', '1');
    expect(item).toBeNull();
  });

  it('insert adds an item and it can be found', async () => {
    await adapter.insert('users', { id: 1, name: 'Alice' });
    const item = await adapter.findById('users', '1');
    expect(item).toEqual({ id: 1, name: 'Alice' });
  });

  it('findAll returns all inserted items', async () => {
    await adapter.insert('users', { id: 1, name: 'Alice' });
    await adapter.insert('users', { id: 2, name: 'Bob' });
    const items = await adapter.findAll('users');
    expect(items).toHaveLength(2);
  });

  it('findAll respects limit and offset', async () => {
    await adapter.insert('users', { id: 1, name: 'A' });
    await adapter.insert('users', { id: 2, name: 'B' });
    await adapter.insert('users', { id: 3, name: 'C' });
    const items = await adapter.findAll('users', { limit: 1, offset: 1 });
    expect(items).toEqual([{ id: 2, name: 'B' }]);
  });

  it('findAll applies equality filters', async () => {
    await adapter.insert('users', { id: 1, name: 'Alice', role: 'admin' });
    await adapter.insert('users', { id: 2, name: 'Bob', role: 'user' });
    await adapter.insert('users', { id: 3, name: 'Carol', role: 'user' });
    const items = await adapter.findAll('users', { filters: { role: 'user' } });
    expect(items).toHaveLength(2);
    expect(items.every((i) => i.role === 'user')).toBe(true);
  });

  it('update replaces an existing item', async () => {
    await adapter.insert('users', { id: 1, name: 'Alice' });
    await adapter.update('users', '1', { id: 1, name: 'Alice Updated' });
    const item = await adapter.findById('users', '1');
    expect(item).toEqual({ id: 1, name: 'Alice Updated' });
  });

  it('update returns null for missing item', async () => {
    const result = await adapter.update('users', '99', { id: 99, name: 'X' });
    expect(result).toBeNull();
  });

  it('delete removes an item', async () => {
    await adapter.insert('users', { id: 1, name: 'Alice' });
    const deleted = await adapter.delete('users', '1');
    expect(deleted).toBe(true);
    const item = await adapter.findById('users', '1');
    expect(item).toBeNull();
  });

  it('delete returns false for missing item', async () => {
    const deleted = await adapter.delete('users', '99');
    expect(deleted).toBe(false);
  });

  it('count returns number of items', async () => {
    expect(await adapter.count('users')).toBe(0);
    await adapter.insert('users', { id: 1, name: 'A' });
    await adapter.insert('users', { id: 2, name: 'B' });
    expect(await adapter.count('users')).toBe(2);
  });

  it('persists data to a JSON file', async () => {
    await adapter.insert('users', { id: 1, name: 'Alice' });
    const file = join(TEST_DIR, 'users.json');
    expect(existsSync(file)).toBe(true);
  });

  it('creates a fresh adapter reading existing data', async () => {
    await adapter.insert('users', { id: 1, name: 'Alice' });
    const adapter2 = new JsonFileAdapter(TEST_DIR);
    const item = await adapter2.findById('users', '1');
    expect(item).toEqual({ id: 1, name: 'Alice' });
  });
});
