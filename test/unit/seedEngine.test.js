import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, rmSync } from 'node:fs';
import {
  seedResource,
  seedAll,
  buildFKGraph,
  topoSort,
} from '../../src/seed/seedEngine.js';
import { CrudEngine } from '../../src/engine/crudEngine.js';
import { IdStrategy } from '../../src/engine/idStrategy.js';
import { JsonStateStore } from '../../src/storage/jsonStateStore.js';

class InMemoryAdapter {
  constructor() {
    this.data = new Map();
  }
  #items(r) {
    if (!this.data.has(r)) this.data.set(r, []);
    return this.data.get(r);
  }
  async findAll(r) {
    return this.#items(r);
  }
  async findById(r, id) {
    return this.#items(r).find((x) => String(x.id) === String(id)) ?? null;
  }
  async insert(r, item) {
    this.#items(r).push(item);
    return item;
  }
  async update(r, id, item) {
    const idx = this.#items(r).findIndex((x) => String(x.id) === String(id));
    if (idx === -1) return null;
    this.#items(r)[idx] = item;
    return item;
  }
  async delete(r, id) {
    const idx = this.#items(r).findIndex((x) => String(x.id) === String(id));
    if (idx === -1) return false;
    this.#items(r).splice(idx, 1);
    return true;
  }
  async count(r) {
    return this.#items(r).length;
  }
}

const TEST_DIR = join(import.meta.dirname, '..', 'tmp-seed');

describe('seedEngine', () => {
  let storage;
  let engine;

  const schema = {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      name: { type: 'string' },
      tag: { type: 'string', enum: ['dog', 'cat', 'bird'] },
    },
    required: ['id', 'name'],
  };

  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(TEST_DIR, { recursive: true });
    storage = new JsonStateStore(TEST_DIR);
    engine = new CrudEngine(storage, new IdStrategy({ type: 'integer' }), schema, 'pets');
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('seeds N records into the engine', async () => {
    await seedResource(engine, schema, 5);
    const result = await engine.list({});
    expect(result.items).toHaveLength(5);
  });

  it('each seeded record has required fields', async () => {
    await seedResource(engine, schema, 3);
    const result = await engine.list({});
    for (const item of result.items) {
      expect(item.id).toBeDefined();
      expect(item.name).toBeDefined();
    }
  });

  it('seeds 0 records', async () => {
    await seedResource(engine, schema, 0);
    const result = await engine.list({});
    expect(result.items).toHaveLength(0);
  });
});

describe('buildFKGraph & topoSort', () => {
  it('resolves a simple dependency chain', () => {
    const resources = [
      {
        name: 'posts',
        schema: { type: 'object', properties: { userId: { type: 'integer' } } },
      },
      {
        name: 'users',
        schema: { type: 'object', properties: { name: { type: 'string' } } },
      },
    ];
    const graph = buildFKGraph(resources);
    expect([...graph.get('posts')]).toEqual(['users']);
    expect([...graph.get('users')]).toEqual([]);
    const { sorted, cycles } = topoSort(resources, graph);
    expect(sorted).toEqual(['users', 'posts']);
    expect(cycles.size).toBe(0);
  });

  it('detects cycles without throwing', () => {
    const resources = [
      { name: 'a', schema: { type: 'object', properties: { bId: { type: 'integer' } } } },
      { name: 'b', schema: { type: 'object', properties: { aId: { type: 'integer' } } } },
    ];
    const { cycles } = topoSort(resources, buildFKGraph(resources));
    expect(cycles.size).toBeGreaterThan(0);
  });
});

describe('seedAll (FK coherence)', () => {
  let storage;
  beforeEach(() => {
    storage = new InMemoryAdapter();
  });

  function build(name, schema, idType = 'integer') {
    const engine = new CrudEngine(storage, new IdStrategy({ type: idType }), schema, name);
    return { name, schema, engine };
  }

  it('seeds scalar FKs with real existing IDs', async () => {
    const users = build('users', {
      type: 'object',
      required: ['name'],
      properties: { id: { type: 'integer' }, name: { type: 'string' } },
    });
    const posts = build('posts', {
      type: 'object',
      required: ['title', 'userId'],
      properties: {
        id: { type: 'integer' },
        title: { type: 'string' },
        userId: { type: 'integer' },
      },
    });
    const engines = new Map([
      ['users', users.engine],
      ['posts', posts.engine],
    ]);
    await seedAll([users, posts], engines, 5);
    const allUsers = await storage.findAll('users');
    const allPosts = await storage.findAll('posts');
    const userIds = new Set(allUsers.map((u) => u.id));
    expect(allUsers.length).toBe(5);
    expect(allPosts.length).toBe(5);
    for (const p of allPosts) {
      expect(userIds.has(p.userId)).toBe(true);
    }
  });

  it('seeds array FKs with real existing IDs', async () => {
    const stores = build(
      'stores',
      {
        type: 'object',
        required: ['name'],
        properties: { id: { type: 'string' }, name: { type: 'string' } },
      },
      'uuid'
    );
    const collections = build(
      'collections',
      {
        type: 'object',
        required: ['name', 'storeIds'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          storeIds: { type: 'array', items: { type: 'string' } },
        },
      },
      'uuid'
    );
    const engines = new Map([
      ['stores', stores.engine],
      ['collections', collections.engine],
    ]);
    await seedAll([stores, collections], engines, 4);
    const allStores = await storage.findAll('stores');
    const allCols = await storage.findAll('collections');
    const storeIds = new Set(allStores.map((s) => s.id));
    for (const c of allCols) {
      expect(Array.isArray(c.storeIds)).toBe(true);
      expect(c.storeIds.length).toBeGreaterThan(0);
      for (const sid of c.storeIds) {
        expect(storeIds.has(sid)).toBe(true);
      }
    }
  });

  it('honors explicit x-crudio-ref when heuristic misses', async () => {
    const divisioni = build('divisioni', {
      type: 'object',
      required: ['name'],
      properties: { id: { type: 'integer' }, name: { type: 'string' } },
    });
    const negozi = build('negozi', {
      type: 'object',
      required: ['name', 'division_id'],
      properties: {
        id: { type: 'integer' },
        name: { type: 'string' },
        division_id: { type: 'integer', 'x-crudio-ref': 'divisioni' },
      },
    });
    const engines = new Map([
      ['divisioni', divisioni.engine],
      ['negozi', negozi.engine],
    ]);
    await seedAll([divisioni, negozi], engines, 3);
    const divs = await storage.findAll('divisioni');
    const negs = await storage.findAll('negozi');
    const divIds = new Set(divs.map((d) => d.id));
    for (const n of negs) {
      expect(divIds.has(n.division_id)).toBe(true);
    }
  });

  it('prefers config-defined foreign keys when heuristic misses', async () => {
    const users = build('users', {
      type: 'object',
      required: ['name'],
      properties: { id: { type: 'integer' }, name: { type: 'string' } },
    });
    const posts = build('posts', {
      type: 'object',
      required: ['title', 'authorId'],
      properties: {
        id: { type: 'integer' },
        title: { type: 'string' },
        authorId: { type: 'integer' },
      },
    });
    const engines = new Map([
      ['users', users.engine],
      ['posts', posts.engine],
    ]);

    await seedAll([users, posts], engines, { count: 3 }, {
      posts: {
        foreignKeys: {
          authorId: 'users',
        },
      },
    });

    const allUsers = await storage.findAll('users');
    const allPosts = await storage.findAll('posts');
    const userIds = new Set(allUsers.map((user) => user.id));

    expect(allUsers).toHaveLength(3);
    expect(allPosts).toHaveLength(3);
    for (const post of allPosts) {
      expect(userIds.has(post.authorId)).toBe(true);
    }
  });

  it('uses per-resource seed counts before global seed count', async () => {
    const users = build('users', {
      type: 'object',
      required: ['name'],
      properties: { id: { type: 'integer' }, name: { type: 'string' } },
    });
    const posts = build('posts', {
      type: 'object',
      required: ['title'],
      properties: { id: { type: 'integer' }, title: { type: 'string' } },
    });
    const engines = new Map([
      ['users', users.engine],
      ['posts', posts.engine],
    ]);

    const counts = await seedAll([users, posts], engines, { count: 5 }, {
      posts: {
        seed: {
          count: 2,
        },
      },
    });

    expect(await storage.count('users')).toBe(5);
    expect(await storage.count('posts')).toBe(2);
    expect(counts).toEqual({
      users: 5,
      posts: 2,
    });
  });
});
