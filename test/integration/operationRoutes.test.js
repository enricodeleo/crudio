import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createApp } from '../../src/app.js';

const FIXTURES = join(import.meta.dirname, '..', 'fixtures');
const TEST_DIR = join(import.meta.dirname, '..', 'tmp-operation-routes');

describe('operation-state routes integration', () => {
  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  async function buildApp(operations = {}, options = {}) {
    return createApp({
      specPath: join(FIXTURES, 'operation-state.yaml'),
      dataDir: TEST_DIR,
      resources: {},
      operations,
      ...options,
    });
  }

  async function request(app, method, path, body = null) {
    const { default: supertest } = await import('supertest');
    let req = supertest(app)[method.toLowerCase()](path);
    if (body) req = req.send(body).set('Content-Type', 'application/json');
    return req;
  }

  it('serves seeded scope-specific GET responses', async () => {
    const app = await buildApp({
      'GET /countries/{code}/summary': {
        seed: {
          scopes: {
            'code=IT': { code: 'IT', status: 'ready' },
          },
        },
      },
    });

    const res = await request(app, 'GET', '/countries/IT/summary');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ code: 'IT', status: 'ready' });
  });

  it('falls back to the default seeded response when scope-specific state is missing', async () => {
    const app = await buildApp({
      'GET /countries/{code}/summary': {
        seed: {
          default: { status: 'unavailable' },
        },
      },
    });

    const res = await request(app, 'GET', '/countries/FR/summary');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'unavailable' });
  });

  it('auto-fakes a non-CRUD POST response from the documented schema (response-shape, not input-shape)', async () => {
    const app = await buildApp();

    const res = await request(app, 'POST', '/auth/login', {
      email: 'ada@example.com',
      password: 'hunter2',
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      token: expect.any(String),
      role: expect.any(String),
    });
    expect(res.body).not.toHaveProperty('email');
    expect(res.body).not.toHaveProperty('password');
  });

  it('returns the same auto-fake payload across repeated calls in the same scope (sticky)', async () => {
    const app = await buildApp();

    const first = await request(app, 'POST', '/auth/login', {
      email: 'ada@example.com',
      password: 'hunter2',
    });
    const second = await request(app, 'POST', '/auth/login', {
      email: 'different@example.com',
      password: 'whatever',
    });

    expect(first.body).toEqual(second.body);
  });

  it('echoes the input again when responseFake is "off" (opt-out)', async () => {
    const app = await buildApp({}, { responseFake: 'off' });

    const res = await request(app, 'POST', '/auth/login', {
      email: 'ada@example.com',
      password: 'hunter2',
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ email: 'ada@example.com', password: 'hunter2' });
  });

  it('does not auto-fake when an explicit seed.default is provided', async () => {
    const app = await buildApp({
      login: {
        seed: { default: { token: 'configured-token', role: 'admin' } },
      },
    });

    const res = await request(app, 'POST', '/auth/login', {
      email: 'ada@example.com',
      password: 'hunter2',
    });

    // Explicit seed.default keeps the legacy echo-and-merge behavior, so the
    // configured fields appear alongside whatever the caller posted.
    expect(res.body).toMatchObject({ token: 'configured-token', role: 'admin' });
  });

  it('updates backing resource state from a projection candidate route', async () => {
    const app = await buildApp();

    const created = await request(app, 'POST', '/releases', {
      name: 'v1.0.0',
      status: 'draft',
    });
    expect(created.status).toBe(201);

    const started = await request(app, 'POST', '/releases/1/start', {
      status: 'started',
    });
    expect(started.status).toBe(200);
    expect(started.body).toEqual({ id: '1', status: 'started' });

    const release = await request(app, 'GET', '/releases/1');
    expect(release.status).toBe(200);
    expect(release.body).toEqual({
      id: '1',
      name: 'v1.0.0',
      status: 'started',
    });
  });
});
