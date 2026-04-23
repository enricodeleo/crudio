import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, rmSync } from 'node:fs';
import { seedResource } from '../../src/seed/seedEngine.js';
import { CrudEngine } from '../../src/engine/crudEngine.js';
import { IdStrategy } from '../../src/engine/idStrategy.js';
import { JsonFileAdapter } from '../../src/storage/jsonFileAdapter.js';

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
    storage = new JsonFileAdapter(TEST_DIR);
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
