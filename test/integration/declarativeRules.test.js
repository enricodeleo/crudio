import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/app.js';

const FIXTURES = join(import.meta.dirname, '..', 'fixtures');
const OP_STATE_SPEC = join(FIXTURES, 'operation-state.yaml');

describe('declarative rules integration', () => {
  let testDir;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'crudio-'));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  async function buildApp(operations = {}, options = {}) {
    return createApp({
      specPath: OP_STATE_SPEC,
      dataDir: testDir,
      resources: {},
      operations,
      ...options,
    });
  }

  it('serves a matching non-CRUD rule before the built-in runtime', async () => {
    const app = await buildApp({
      login: {
        rules: [
          {
            name: 'admin-login',
            if: { eq: [{ ref: 'req.body.email' }, 'ada@example.com'] },
            then: {
              writeState: {
                token: 'mock-token',
                role: 'admin',
              },
              respond: {
                status: 200,
                body: { ref: 'state.current' },
              },
            },
          },
        ],
      },
    });

    const res = await request(app, 'POST', '/auth/login', {
      email: 'ada@example.com',
      password: 'secret',
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      token: 'mock-token',
      role: 'admin',
    });
  });

  it('falls back to built-in behavior when rules exist but none match and no handler is configured', async () => {
    const app = await buildApp({
      getCountrySummary: {
        rules: [
          {
            name: 'special-view',
            if: { eq: [{ ref: 'req.query.view' }, 'special'] },
            then: {
              respond: {
                status: 200,
                body: {
                  code: { ref: 'req.params.code' },
                  status: 'special',
                },
              },
            },
          },
        ],
      },
    });

    const res = await request(app, 'GET', '/countries/IT/summary');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('lets a CRUD route read linked resource state in a rule while leaving the backing resource unchanged', async () => {
    const app = await buildApp({
      updateRelease: {
        rules: [
          {
            name: 'preview-update',
            if: { eq: [{ ref: 'resource.current.status' }, 'draft'] },
            then: {
              writeState: {
                id: { ref: 'resource.current.id' },
                name: { ref: 'resource.current.name' },
                status: { ref: 'req.body.status' },
              },
              respond: {
                status: 200,
                body: { ref: 'state.current' },
              },
            },
          },
        ],
      },
    });

    const created = await request(app, 'POST', '/releases', {
      name: 'v1.0.0',
      status: 'draft',
    });
    expect(created.status).toBe(201);

    const updated = await request(app, 'PUT', '/releases/1', {
      id: 1,
      name: 'v2.0.0',
      status: 'started',
    });
    expect(updated.status).toBe(200);
    expect(updated.body).toEqual({
      id: 1,
      name: 'v1.0.0',
      status: 'started',
    });

    const release = await request(app, 'GET', '/releases/1');
    expect(release.status).toBe(200);
    expect(release.body).toEqual({
      id: 1,
      name: 'v1.0.0',
      status: 'draft',
    });
  });

  it('returns an explicit error when rules and a JS handler coexist but no rule matches', async () => {
    const app = await buildApp({
      login: {
        rules: [
          {
            name: 'admin-login',
            if: { eq: [{ ref: 'req.body.email' }, 'ada@example.com'] },
            then: {
              respond: {
                status: 200,
                body: {
                  token: 'mock-token',
                  role: 'admin',
                },
              },
            },
          },
        ],
        handler: async (ctx) => ctx.json(200, { token: 'handler-token', role: 'user' }),
      },
    });

    const res = await request(app, 'POST', '/auth/login', {
      email: 'bob@example.com',
      password: 'secret',
    });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/rules.*handler.*no rule matched/i);
  });
});

async function request(app, method, path, body = null) {
  const { default: supertest } = await import('supertest');
  let req = supertest(app)[method.toLowerCase()](path);
  if (body) req = req.send(body).set('Content-Type', 'application/json');
  return req;
}
