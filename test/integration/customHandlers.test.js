import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createApp } from '../../src/app.js';

const FIXTURES = join(import.meta.dirname, '..', 'fixtures');
const PETSTORE_SPEC = join(FIXTURES, 'petstore.yaml');
const OP_STATE_SPEC = join(FIXTURES, 'operation-state.yaml');
const TEST_DIR = join(import.meta.dirname, '..', 'tmp-custom-handlers');

describe('custom handlers integration', () => {
  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('wraps a CRUD route with nextDefault()', async () => {
    const app = await createApp({
      specPath: PETSTORE_SPEC,
      dataDir: TEST_DIR,
      resources: {},
      operations: {
        createPet: {
          handler: async (ctx) => {
            const created = await ctx.nextDefault();
            return ctx.json(created.status, { ...created.body, source: 'custom' });
          },
        },
      },
      validateResponses: 'off',
    });

    const res = await request(app, 'POST', '/pets', { name: 'Rex' });
    expect(res.status).toBe(201);
    expect(res.body.source).toBe('custom');
  });

  it('loads a module handler for a non-CRUD route and still projects through nextDefault()', async () => {
    const app = await createApp({
      specPath: OP_STATE_SPEC,
      dataDir: TEST_DIR,
      resources: {},
      operations: {
        startRelease: {
          handler: './test/fixtures/handlers/startRelease.js',
        },
      },
      validateResponses: 'off',
    });

    await request(app, 'POST', '/releases', { name: 'v1.0.0', status: 'draft' });
    const started = await request(app, 'POST', '/releases/1/start', { status: 'started' });
    expect(started.status).toBe(200);
    expect(started.body.source).toBe('module');

    const release = await request(app, 'GET', '/releases/1');
    expect(release.status).toBe(200);
    expect(release.body).toEqual({
      id: '1',
      name: 'v1.0.0',
      status: 'started',
    });
  });

  it('rejects an invalid custom CRUD request before the handler runs', async () => {
    const spy = vi.fn(async (ctx) => ctx.nextDefault());
    const app = await createApp({
      specPath: PETSTORE_SPEC,
      dataDir: TEST_DIR,
      resources: {},
      operations: {
        createPet: { handler: spy },
      },
      validateResponses: 'off',
    });

    const res = await request(app, 'POST', '/pets', { tag: 'dog' });
    expect(res.status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });
});

async function request(app, method, path, body = null) {
  const { default: supertest } = await import('supertest');
  let req = supertest(app)[method.toLowerCase()](path);
  if (body) req = req.send(body).set('Content-Type', 'application/json');
  return req;
}
