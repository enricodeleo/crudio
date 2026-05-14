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

  it('returns the auto-fake default body unchanged on POST when origin=auto-fake (no merge with req.body)', async () => {
    await storage.writeOperationDefaultState(operation.key, {
      status: 200,
      body: { type: 'DESKTOP', registerIp: '10.0.0.1' },
      headers: {},
      origin: 'auto-fake',
    });

    const result = await executeOperationStateOperation({
      operation,
      storage,
      operationConfig: { mode: 'operation-state', querySensitive: false },
      projectionEligible: false,
      resource: null,
      req: {
        params: { code: 'IT' },
        query: {},
        body: { ignored: 'input-field' },
        headers: {},
      },
    });

    expect(result.descriptor.body).toEqual({ type: 'DESKTOP', registerIp: '10.0.0.1' });

    await result.commit();

    expect(await storage.readOperationState(operation.key, 'code=IT')).toEqual({
      status: 200,
      body: { type: 'DESKTOP', registerIp: '10.0.0.1' },
      headers: {},
    });
  });

  it('returns the auto-fake default body unchanged when it is an array', async () => {
    await storage.writeOperationDefaultState(operation.key, {
      status: 200,
      body: [{ type: 'DESKTOP' }, { type: 'MOBILE' }],
      headers: {},
      origin: 'auto-fake',
    });

    const result = await executeOperationStateOperation({
      operation,
      storage,
      operationConfig: { mode: 'operation-state', querySensitive: false },
      projectionEligible: false,
      resource: null,
      req: {
        params: { code: 'IT' },
        query: {},
        body: { filter: 'whatever' },
        headers: {},
      },
    });

    expect(result.descriptor.body).toEqual([{ type: 'DESKTOP' }, { type: 'MOBILE' }]);

    await result.commit();

    expect(await storage.readOperationState(operation.key, 'code=IT')).toEqual({
      status: 200,
      body: [{ type: 'DESKTOP' }, { type: 'MOBILE' }],
      headers: {},
    });
  });

  it('still merges req.body for POST when default origin is not auto-fake (legacy echo behavior)', async () => {
    await storage.writeOperationDefaultState(operation.key, {
      status: 200,
      body: { status: 'unavailable' },
      headers: {},
    });

    const result = await executeOperationStateOperation({
      operation,
      storage,
      operationConfig: { mode: 'operation-state', querySensitive: false },
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
  });

  it('PATCH on an auto-fake array body returns the default unchanged (no merge with req.body)', async () => {
    const patchOperation = { ...operation, method: 'PATCH' };
    await storage.writeOperationDefaultState(patchOperation.key, {
      status: 200,
      body: [{ type: 'DESKTOP' }],
      headers: {},
      origin: 'auto-fake',
    });

    const result = await executeOperationStateOperation({
      operation: patchOperation,
      storage,
      operationConfig: { mode: 'operation-state', querySensitive: false },
      projectionEligible: false,
      resource: null,
      req: {
        params: { code: 'IT' },
        query: {},
        body: { added: 'field' },
        headers: {},
      },
    });

    expect(result.descriptor.body).toEqual([{ type: 'DESKTOP' }]);
  });

  it('PATCH on an auto-fake object body still merges req.body (PATCH semantics)', async () => {
    const patchOperation = { ...operation, method: 'PATCH' };
    await storage.writeOperationDefaultState(patchOperation.key, {
      status: 200,
      body: { type: 'DESKTOP', registerIp: '10.0.0.1' },
      headers: {},
      origin: 'auto-fake',
    });

    const result = await executeOperationStateOperation({
      operation: patchOperation,
      storage,
      operationConfig: { mode: 'operation-state', querySensitive: false },
      projectionEligible: false,
      resource: null,
      req: {
        params: { code: 'IT' },
        query: {},
        body: { registerIp: '192.168.1.1' },
        headers: {},
      },
    });

    expect(result.descriptor.body).toEqual({
      type: 'DESKTOP',
      registerIp: '192.168.1.1',
      code: 'IT',
    });
  });

  it('GET reads the auto-fake default state on first call', async () => {
    const getOperation = { ...operation, method: 'GET' };
    await storage.writeOperationDefaultState(getOperation.key, {
      status: 200,
      body: [{ type: 'DESKTOP' }],
      headers: {},
      origin: 'auto-fake',
    });

    const result = await executeOperationStateOperation({
      operation: getOperation,
      storage,
      operationConfig: { mode: 'operation-state', querySensitive: false },
      projectionEligible: false,
      resource: null,
      req: { params: { code: 'IT' }, query: {}, body: {}, headers: {} },
    });

    expect(result.descriptor.status).toBe(200);
    expect(result.descriptor.body).toEqual([{ type: 'DESKTOP' }]);
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
