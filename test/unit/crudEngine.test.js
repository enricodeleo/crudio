import { describe, it, expect, beforeEach } from 'vitest';
import { CrudEngine } from '../../src/engine/crudEngine.js';
import { IdStrategy } from '../../src/engine/idStrategy.js';
import { JsonStateStore } from '../../src/storage/jsonStateStore.js';
import { join } from 'node:path';
import { mkdirSync, rmSync } from 'node:fs';

const TEST_DIR = join(import.meta.dirname, '..', 'tmp-engine');

class LegacyCountAdapter {
  constructor(items = []) {
    this.items = items;
  }

  async findAll(_resource, query = {}) {
    let items = [...this.items];
    if (query.filters) {
      for (const [key, value] of Object.entries(query.filters)) {
        items = items.filter((item) => item[key] === value);
      }
    }
    const offset = query.offset ?? 0;
    const limit = query.limit ?? items.length;
    return items.slice(offset, offset + limit);
  }

  async findById(_resource, id) {
    return this.items.find((item) => String(item.id) === String(id)) ?? null;
  }

  async insert(_resource, item) {
    this.items.push(item);
    return item;
  }

  async update(_resource, id, item) {
    const index = this.items.findIndex((existing) => String(existing.id) === String(id));
    if (index === -1) return null;
    this.items[index] = item;
    return item;
  }

  async delete(_resource, id) {
    const index = this.items.findIndex((existing) => String(existing.id) === String(id));
    if (index === -1) return false;
    this.items.splice(index, 1);
    return true;
  }

  async count() {
    return this.items.length;
  }
}

class StrictLegacyCountAdapter extends LegacyCountAdapter {
  async count(resource) {
    if (arguments.length !== 1) {
      throw new Error(`count expected 1 argument, got ${arguments.length}`);
    }
    return super.count(resource);
  }
}

describe('CrudEngine', () => {
  let engine;
  let storage;

  const schema = {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      name: { type: 'string' },
      tag: { type: 'string' },
    },
    required: ['id', 'name'],
  };

  const idSchema = { type: 'integer' };

  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(TEST_DIR, { recursive: true });
    storage = new JsonStateStore(TEST_DIR);
    engine = new CrudEngine(storage, new IdStrategy(idSchema), schema, 'pets');
  });

  it('creates an item and assigns an id', async () => {
    const item = await engine.create({ name: 'Rex', tag: 'dog' });
    expect(item.id).toBe(1);
    expect(item.name).toBe('Rex');
  });

  it('creates with a provided id', async () => {
    const item = await engine.create({ id: 42, name: 'Rex' });
    expect(item.id).toBe(42);
  });

  it('rejects duplicate id on create', async () => {
    await engine.create({ id: 1, name: 'Rex' });
    await expect(engine.create({ id: 1, name: 'Buddy' })).rejects.toThrow('already has an item');
  });

  it('gets item by id', async () => {
    await engine.create({ name: 'Rex' });
    const item = await engine.getById('1');
    expect(item.name).toBe('Rex');
  });

  it('returns null for missing id', async () => {
    const item = await engine.getById('99');
    expect(item).toBeNull();
  });

  it('lists all items', async () => {
    await engine.create({ name: 'Rex' });
    await engine.create({ name: 'Buddy' });
    const result = await engine.list({});
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('lists with limit and offset', async () => {
    await engine.create({ name: 'A' });
    await engine.create({ name: 'B' });
    await engine.create({ name: 'C' });
    const result = await engine.list({ limit: 1, offset: 1 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe('B');
    expect(result.total).toBe(3);
  });

  it('lists with filters', async () => {
    await engine.create({ name: 'Rex', tag: 'dog' });
    await engine.create({ name: 'Whiskers', tag: 'cat' });
    await engine.create({ name: 'Buddy', tag: 'dog' });
    const result = await engine.list({ filters: { tag: 'dog' } });
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('computes filtered totals when storage only supports legacy count(resource)', async () => {
    const legacyStorage = new LegacyCountAdapter([
      { id: 1, name: 'Rex', tag: 'dog' },
      { id: 2, name: 'Whiskers', tag: 'cat' },
      { id: 3, name: 'Buddy', tag: 'dog' },
    ]);
    const legacyEngine = new CrudEngine(legacyStorage, new IdStrategy(idSchema), schema, 'pets');

    const result = await legacyEngine.list({ filters: { tag: 'dog' }, limit: 1, offset: 1 });

    expect(result.items).toEqual([{ id: 3, name: 'Buddy', tag: 'dog' }]);
    expect(result.total).toBe(2);
  });

  it('calls legacy count(resource) with one argument on unfiltered lists', async () => {
    const legacyStorage = new StrictLegacyCountAdapter([
      { id: 1, name: 'Rex', tag: 'dog' },
      { id: 2, name: 'Whiskers', tag: 'cat' },
    ]);
    const legacyEngine = new CrudEngine(legacyStorage, new IdStrategy(idSchema), schema, 'pets');

    const result = await legacyEngine.list({ limit: 1, offset: 0 });

    expect(result.items).toEqual([{ id: 1, name: 'Rex', tag: 'dog' }]);
    expect(result.total).toBe(2);
  });

  it('updates an item (full replacement)', async () => {
    await engine.create({ name: 'Rex', tag: 'dog' });
    const updated = await engine.update('1', { id: 1, name: 'Rex II', tag: 'dog' });
    expect(updated.name).toBe('Rex II');
  });

  it('returns null when updating missing item', async () => {
    const result = await engine.update('99', { id: 99, name: 'X' });
    expect(result).toBeNull();
  });

  it('patches an item (partial merge)', async () => {
    await engine.create({ name: 'Rex', tag: 'dog' });
    const patched = await engine.patch('1', { tag: 'good boy' });
    expect(patched.name).toBe('Rex');
    expect(patched.tag).toBe('good boy');
  });

  it('returns null when patching missing item', async () => {
    const result = await engine.patch('99', { name: 'X' });
    expect(result).toBeNull();
  });

  it('deletes an item', async () => {
    await engine.create({ name: 'Rex' });
    const deleted = await engine.delete('1');
    expect(deleted).toBe(true);
    expect(await engine.getById('1')).toBeNull();
  });

  it('returns false when deleting missing item', async () => {
    const deleted = await engine.delete('99');
    expect(deleted).toBe(false);
  });

  it('generates sequential integer ids', async () => {
    await engine.create({ name: 'A' });
    await engine.create({ name: 'B' });
    await engine.create({ name: 'C' });
    const items = await engine.list({});
    const ids = items.items.map((i) => i.id);
    expect(ids).toEqual([1, 2, 3]);
  });
});
