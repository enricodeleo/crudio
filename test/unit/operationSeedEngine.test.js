import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonStateStore } from '../../src/storage/jsonStateStore.js';
import { seedOperationState } from '../../src/seed/operationSeedEngine.js';

describe('operationSeedEngine', () => {
  let testDir;
  let store;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'crudio-'));
    store = new JsonStateStore(testDir);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('persists default and scope-specific operation seeds separately in response shape', async () => {
    await seedOperationState({
      registry: [
        {
          routeKind: 'operation-state',
          operation: {
            key: 'GET /countries/{code}/summary',
            canonicalResponse: { status: 200 },
          },
          operationConfig: {
            seed: {
              default: { status: 'unavailable' },
              scopes: {
                'code=IT': { code: 'IT', status: 'ready' },
              },
            },
          },
        },
      ],
      storage: store,
    });

    expect(
      await store.readOperationDefaultState('GET /countries/{code}/summary')
    ).toEqual({
      status: 200,
      body: { status: 'unavailable' },
      headers: {},
    });
    expect(
      await store.readOperationState('GET /countries/{code}/summary', 'code=IT')
    ).toEqual({
      status: 200,
      body: { code: 'IT', status: 'ready' },
      headers: {},
    });
  });

  it('warns and skips operation seeds configured on CRUD-claimed routes', async () => {
    const warnings = [];

    await seedOperationState({
      registry: [
        {
          routeKind: 'resource',
          crudOperation: 'create',
          operation: {
            key: 'POST /releases',
            canonicalResponse: { status: 201 },
          },
          operationConfig: {
            seed: {
              default: { name: 'v1.0.0', status: 'draft' },
            },
          },
        },
      ],
      storage: store,
      warn: (message) => warnings.push(message),
    });

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/crud-claimed/i);
    expect(warnings[0]).toMatch(/POST \/releases/);
    expect(await store.readOperationDefaultState('POST /releases')).toBeNull();
  });
});
