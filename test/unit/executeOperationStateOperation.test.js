import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonStateStore } from '../../src/storage/jsonStateStore.js';
import { executeOperationStateOperation } from '../../src/http/executeOperationStateOperation.js';

const operation = {
  key: 'POST /countries/{code}/summary',
  method: 'POST',
  openApiPath: '/countries/{code}/summary',
  pathParams: ['code'],
  canonicalResponse: {
    status: 200,
    contentType: 'application/json',
  },
};

describe('executeOperationStateOperation', () => {
  let testDir;
  let storage;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'crudio-'));
    storage = new JsonStateStore(testDir);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('defers operation-state persistence until commit is invoked', async () => {
    const result = await executeOperationStateOperation({
      operation,
      storage,
      operationConfig: {
        mode: 'operation-state',
        querySensitive: false,
      },
      projectionEligible: false,
      resource: null,
      req: {
        params: { code: 'IT' },
        query: {},
        body: { status: 'ready' },
        headers: {},
      },
    });

    expect(result.descriptor.body).toEqual({ status: 'ready', code: 'IT' });
    expect(await storage.readOperationState(operation.key, 'code=IT')).toBeNull();

    await result.commit();

    expect(await storage.readOperationState(operation.key, 'code=IT')).toEqual({
      status: 200,
      body: { status: 'ready', code: 'IT' },
      headers: {},
    });
  });

  it('persists a wrapped descriptor when commit receives an override descriptor', async () => {
    const result = await executeOperationStateOperation({
      operation,
      storage,
      operationConfig: {
        mode: 'operation-state',
        querySensitive: false,
      },
      projectionEligible: false,
      resource: null,
      req: {
        params: { code: 'IT' },
        query: {},
        body: { status: 'ready' },
        headers: {},
      },
    });

    await result.commit({
      status: 200,
      body: { status: 'wrapped', code: 'IT', source: 'custom' },
      headers: {},
    });

    expect(await storage.readOperationState(operation.key, 'code=IT')).toEqual({
      status: 200,
      body: { status: 'wrapped', code: 'IT', source: 'custom' },
      headers: {},
    });
  });
});
