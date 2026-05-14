import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonStateStore } from '../../src/storage/jsonStateStore.js';
import { seedResponseFakeFallback } from '../../src/seed/responseFakeFallback.js';

function makeRoute({
  key = 'POST /devices/search',
  method = 'POST',
  responseStatus = 200,
  responseContentType = 'application/json',
  responseSchema,
  routeKind = 'operation-state',
  operationConfig = {},
} = {}) {
  return {
    routeKind,
    operation: {
      key,
      method,
      openApiPath: '/devices/search',
      canonicalResponse:
        responseStatus && responseContentType
          ? { status: responseStatus, contentType: responseContentType }
          : null,
      operation: {
        responses:
          responseStatus && responseContentType && responseSchema
            ? {
                [String(responseStatus)]: {
                  content: { [responseContentType]: { schema: responseSchema } },
                },
              }
            : {},
      },
    },
    operationConfig: {
      enabled: true,
      mode: 'auto',
      seed: { default: undefined, scopes: {}, ...(operationConfig.seed ?? {}) },
      ...operationConfig,
    },
  };
}

describe('seedResponseFakeFallback', () => {
  let testDir;
  let store;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'crudio-rf-'));
    store = new JsonStateStore(testDir);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('writes a generated default state with origin=auto-fake for non-CRUD object response', async () => {
    await seedResponseFakeFallback({
      registry: [
        makeRoute({
          responseSchema: {
            type: 'object',
            required: ['id', 'name'],
            properties: {
              id: { type: 'integer' },
              name: { type: 'string' },
            },
          },
        }),
      ],
      storage: store,
    });

    const defaultState = await store.readOperationDefaultState('POST /devices/search');
    expect(defaultState).not.toBeNull();
    expect(defaultState.status).toBe(200);
    expect(defaultState.origin).toBe('auto-fake');
    expect(defaultState.headers).toEqual({});
    expect(defaultState.body).toEqual(
      expect.objectContaining({
        id: expect.any(Number),
        name: expect.any(String),
      })
    );
  });

  it('produces an array body when the response schema is an array', async () => {
    await seedResponseFakeFallback({
      registry: [
        makeRoute({
          responseSchema: {
            type: 'array',
            items: {
              type: 'object',
              required: ['type'],
              properties: { type: { type: 'string' } },
            },
          },
        }),
      ],
      storage: store,
    });

    const defaultState = await store.readOperationDefaultState('POST /devices/search');
    expect(Array.isArray(defaultState.body)).toBe(true);
    expect(defaultState.body.length).toBeGreaterThan(0);
    expect(defaultState.body[0]).toEqual(
      expect.objectContaining({ type: expect.any(String) })
    );
  });

  it('skips operations that are projection-eligible into a parent CRUD resource', async () => {
    const route = makeRoute({
      responseSchema: { type: 'object', properties: { id: { type: 'integer' } } },
    });
    route.projectionEligible = true;

    await seedResponseFakeFallback({
      registry: [route],
      storage: store,
    });

    expect(await store.readOperationDefaultState('POST /devices/search')).toBeNull();
  });

  it('skips CRUD-claimed routes', async () => {
    await seedResponseFakeFallback({
      registry: [
        makeRoute({
          key: 'POST /pets',
          routeKind: 'resource',
          responseSchema: { type: 'object', properties: { name: { type: 'string' } } },
        }),
      ],
      storage: store,
    });

    expect(await store.readOperationDefaultState('POST /pets')).toBeNull();
  });

  it('skips operations that already have an explicit seed.default', async () => {
    await seedResponseFakeFallback({
      registry: [
        makeRoute({
          responseSchema: { type: 'object', properties: { id: { type: 'integer' } } },
          operationConfig: { seed: { default: { id: 1 }, scopes: {} } },
        }),
      ],
      storage: store,
    });

    expect(await store.readOperationDefaultState('POST /devices/search')).toBeNull();
  });

  it('skips operations that already have explicit seed scopes', async () => {
    await seedResponseFakeFallback({
      registry: [
        makeRoute({
          responseSchema: { type: 'object', properties: { id: { type: 'integer' } } },
          operationConfig: { seed: { default: undefined, scopes: { 'id=1': { id: 1 } } } },
        }),
      ],
      storage: store,
    });

    expect(await store.readOperationDefaultState('POST /devices/search')).toBeNull();
  });

  it('skips operations when per-op responseFake is "off"', async () => {
    await seedResponseFakeFallback({
      registry: [
        makeRoute({
          responseSchema: { type: 'object', properties: { id: { type: 'integer' } } },
          operationConfig: { responseFake: 'off' },
        }),
      ],
      storage: store,
    });

    expect(await store.readOperationDefaultState('POST /devices/search')).toBeNull();
  });

  it('skips operations when top-level default is "off" and per-op leaves it inherited', async () => {
    await seedResponseFakeFallback({
      registry: [
        makeRoute({
          responseSchema: { type: 'object', properties: { id: { type: 'integer' } } },
        }),
      ],
      storage: store,
      defaultResponseFake: 'off',
    });

    expect(await store.readOperationDefaultState('POST /devices/search')).toBeNull();
  });

  it('per-op responseFake "auto" overrides top-level "off"', async () => {
    await seedResponseFakeFallback({
      registry: [
        makeRoute({
          responseSchema: { type: 'object', properties: { id: { type: 'integer' } } },
          operationConfig: { responseFake: 'auto' },
        }),
      ],
      storage: store,
      defaultResponseFake: 'off',
    });

    const defaultState = await store.readOperationDefaultState('POST /devices/search');
    expect(defaultState?.origin).toBe('auto-fake');
  });

  it('skips operations with no canonical response schema', async () => {
    await seedResponseFakeFallback({
      registry: [
        makeRoute({ responseSchema: undefined }),
      ],
      storage: store,
    });

    expect(await store.readOperationDefaultState('POST /devices/search')).toBeNull();
  });

  it('skips operations with an empty object response schema', async () => {
    await seedResponseFakeFallback({
      registry: [
        makeRoute({
          responseSchema: { type: 'object', properties: {} },
        }),
      ],
      storage: store,
    });

    expect(await store.readOperationDefaultState('POST /devices/search')).toBeNull();
  });

  it('uses the canonical response status (e.g. 201 for create-like ops)', async () => {
    await seedResponseFakeFallback({
      registry: [
        makeRoute({
          responseStatus: 201,
          responseSchema: { type: 'object', properties: { id: { type: 'integer' } } },
        }),
      ],
      storage: store,
    });

    const defaultState = await store.readOperationDefaultState('POST /devices/search');
    expect(defaultState.status).toBe(201);
  });

  it('does not overwrite an existing default state', async () => {
    await store.writeOperationDefaultState('POST /devices/search', {
      status: 200,
      body: { preserved: true },
      headers: {},
    });

    await seedResponseFakeFallback({
      registry: [
        makeRoute({
          responseSchema: { type: 'object', properties: { id: { type: 'integer' } } },
        }),
      ],
      storage: store,
    });

    const defaultState = await store.readOperationDefaultState('POST /devices/search');
    expect(defaultState.body).toEqual({ preserved: true });
  });
});
