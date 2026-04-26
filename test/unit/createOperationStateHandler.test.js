import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonStateStore } from '../../src/storage/jsonStateStore.js';
import { createOperationStateHandler } from '../../src/http/createOperationStateHandler.js';

const defaultHeaders = {};

const operations = {
  getCountrySummary: {
    key: 'GET /countries/{code}/summary',
    method: 'GET',
    openApiPath: '/countries/{code}/summary',
    pathParams: ['code'],
    canonicalResponse: {
      status: 200,
      contentType: 'application/json',
    },
  },
  login: {
    key: 'POST /auth/login',
    method: 'POST',
    openApiPath: '/auth/login',
    pathParams: [],
    canonicalResponse: {
      status: 200,
      contentType: 'application/json',
    },
  },
  startRelease: {
    key: 'POST /releases/{id}/start',
    method: 'POST',
    openApiPath: '/releases/{id}/start',
    pathParams: ['id'],
    canonicalResponse: {
      status: 200,
      contentType: 'application/json',
    },
  },
  reportStatus: {
    key: 'POST /reports/{id}/status',
    method: 'POST',
    openApiPath: '/reports/{id}/status',
    pathParams: ['id'],
    canonicalResponse: {
      status: 200,
      contentType: 'application/json',
    },
  },
  deleteSession: {
    key: 'DELETE /auth/login',
    method: 'DELETE',
    openApiPath: '/auth/login',
    pathParams: [],
    canonicalResponse: {
      status: 204,
      contentType: null,
    },
  },
  patchProfile: {
    key: 'PATCH /profiles/{id}',
    method: 'PATCH',
    openApiPath: '/profiles/{id}',
    pathParams: ['id'],
    canonicalResponse: {
      status: 200,
      contentType: 'application/json',
    },
  },
  publishReport: {
    key: 'POST /reports/{id}/publish',
    method: 'POST',
    openApiPath: '/reports/{id}/publish',
    pathParams: ['id'],
    canonicalResponse: {
      status: 204,
      contentType: null,
    },
  },
};

const releaseResource = {
  name: 'releases',
  idParam: 'id',
};

describe('createOperationStateHandler', () => {
  let testDir;
  let store;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'crudio-'));
    store = new JsonStateStore(testDir);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('returns 404 for unseeded GET operation-state routes', async () => {
    const res = await invoke(
      handlerFor(operations.getCountrySummary),
      { params: { code: 'IT' } }
    );

    expect(res.status).toBe(404);
  });

  it('falls back to default seeded state for GET when no scoped state exists', async () => {
    await store.writeOperationDefaultState(operations.getCountrySummary.key, {
      status: 200,
      body: { status: 'unavailable' },
      headers: defaultHeaders,
    });

    const res = await invoke(
      handlerFor(operations.getCountrySummary),
      { params: { code: 'FR' } }
    );

    expect(res).toEqual({
      status: 200,
      body: { status: 'unavailable' },
      headers: {},
      ended: false,
    });
  });

  it('persists POST operation responses by the empty scope for path-less routes', async () => {
    await store.writeOperationDefaultState(operations.login.key, {
      status: 200,
      body: { role: 'guest', email: 'seed@example.com' },
      headers: defaultHeaders,
    });

    const res = await invoke(
      handlerFor(operations.login),
      {
        body: { email: 'ada@example.com' },
      }
    );

    expect(res).toEqual({
      status: 200,
      body: { role: 'guest', email: 'ada@example.com' },
      headers: {},
      ended: false,
    });
    expect(await store.readOperationState(operations.login.key, '')).toEqual({
      status: 200,
      body: { role: 'guest', email: 'ada@example.com' },
      headers: {},
    });
  });

  it('projects response data into an existing resource item when the rule succeeds', async () => {
    await store.insert('releases', {
      id: '1',
      name: 'v1',
      status: 'draft',
    });

    const res = await invoke(
      handlerFor(operations.startRelease, {
        operationConfig: { mode: 'auto' },
        projectionEligible: true,
        resource: releaseResource,
      }),
      {
        params: { id: '1' },
        body: { id: 'wrong', status: 'started' },
      }
    );

    expect(res.body).toEqual({ id: '1', status: 'started' });
    expect(await store.findById('releases', '1')).toEqual({
      id: '1',
      name: 'v1',
      status: 'started',
    });
  });

  it('includes query params in the scope when querySensitive is true', async () => {
    const res = await invoke(
      handlerFor(operations.reportStatus, {
        operationConfig: { mode: 'operation-state', querySensitive: true },
      }),
      {
        params: { id: '1' },
        query: { locale: 'en' },
        body: { status: 'queued' },
      }
    );

    expect(res.status).toBe(200);
    expect(await store.readOperationState(operations.reportStatus.key, 'id=1&locale=en')).toEqual({
      status: 200,
      body: { id: '1', status: 'queued' },
      headers: {},
    });
    expect(await store.readOperationState(operations.reportStatus.key, 'id=1')).toBeNull();
  });

  it('returns 404 when deleting a non-existent operation-state scope', async () => {
    const res = await invoke(handlerFor(operations.deleteSession), {});

    expect(res.status).toBe(404);
  });

  it('uses shallow merge for PATCH', async () => {
    await store.writeOperationState(operations.patchProfile.key, 'id=1', {
      status: 200,
      body: { profile: { name: 'Ada', title: 'Eng' }, enabled: true },
      headers: defaultHeaders,
    });

    const res = await invoke(
      handlerFor(operations.patchProfile),
      {
        params: { id: '1' },
        body: { profile: { title: 'Lead' } },
      }
    );

    expect(res.body).toEqual({
      profile: { title: 'Lead' },
      enabled: true,
      id: '1',
    });
  });

  it('does not persist state for 204-only operations', async () => {
    const res = await invoke(
      handlerFor(operations.publishReport),
      {
        params: { id: '1' },
        body: { status: 'published' },
      }
    );

    expect(res).toEqual({
      status: 204,
      body: undefined,
      headers: {},
      ended: true,
    });
    expect(await store.readOperationState(operations.publishReport.key, 'id=1')).toBeNull();
  });

  it('skips projection in auto mode when the target resource item does not exist', async () => {
    const res = await invoke(
      handlerFor(operations.startRelease, {
        operationConfig: { mode: 'auto' },
        projectionEligible: true,
        resource: releaseResource,
      }),
      {
        params: { id: '1' },
        body: { status: 'started' },
      }
    );

    expect(res.status).toBe(200);
    expect(await store.readOperationState(operations.startRelease.key, 'id=1')).toEqual({
      status: 200,
      body: { id: '1', status: 'started' },
      headers: {},
    });
    expect(await store.findById('releases', '1')).toBeNull();
  });

  function handlerFor(operation, overrides = {}) {
    return createOperationStateHandler({
      operation,
      storage: store,
      operationConfig: {
        mode: 'operation-state',
        querySensitive: false,
        ...overrides.operationConfig,
      },
      projectionEligible: overrides.projectionEligible ?? false,
      resource: overrides.resource ?? null,
    });
  }
});

async function invoke(handler, req = {}) {
  return new Promise((resolve, reject) => {
    const response = {
      statusCode: 200,
      headers: {},
      status(code) {
        this.statusCode = code;
        return this;
      },
      set(headers) {
        Object.assign(this.headers, headers);
        return this;
      },
      json(body) {
        resolve({
          status: this.statusCode,
          body,
          headers: this.headers,
          ended: false,
        });
        return this;
      },
      end() {
        resolve({
          status: this.statusCode,
          body: undefined,
          headers: this.headers,
          ended: true,
        });
        return this;
      },
    };

    Promise.resolve(
      handler(
        {
          params: {},
          query: {},
          body: undefined,
          ...req,
        },
        response,
        reject
      )
    ).catch(reject);
  });
}
