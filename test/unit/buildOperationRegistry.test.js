import { describe, expect, it } from 'vitest';
import { buildOperationRegistry } from '../../src/http/buildOperationRegistry.js';

const operations = [
  {
    key: 'POST /pets',
    method: 'POST',
    openApiPath: '/pets',
    expressPath: '/pets',
    operationId: 'createPet',
    pathParams: [],
    requestBodySchema: {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        name: { type: 'string' },
      },
    },
    canonicalResponse: {
      status: 201,
      contentType: 'application/json',
      schema: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
        },
      },
    },
    operation: {
      responses: {
        '201': {
          description: 'created',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  name: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  },
  {
    key: 'GET /countries/{code}/summary',
    method: 'GET',
    openApiPath: '/countries/{code}/summary',
    expressPath: '/countries/:code/summary',
    operationId: 'getCountrySummary',
    pathParams: ['code'],
    requestBodySchema: null,
    canonicalResponse: {
      status: 200,
      contentType: 'application/json',
      schema: {
        type: 'object',
        properties: {
          population: { type: 'integer' },
        },
      },
    },
    operation: {
      responses: {
        '200': {
          description: 'ok',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  population: { type: 'integer' },
                },
              },
            },
          },
        },
      },
    },
  },
  {
    key: 'POST /auth/login',
    method: 'POST',
    openApiPath: '/auth/login',
    expressPath: '/auth/login',
    operationId: 'login',
    pathParams: [],
    requestBodySchema: {
      type: 'object',
      properties: {
        email: { type: 'string' },
        password: { type: 'string' },
      },
    },
    canonicalResponse: {
      status: 200,
      contentType: 'application/json',
      schema: {
        type: 'object',
        properties: {
          token: { type: 'string' },
        },
      },
    },
    operation: {
      responses: {
        '200': {
          description: 'ok',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  token: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  },
  {
    key: 'POST /releases/{id}/start',
    method: 'POST',
    openApiPath: '/releases/{id}/start',
    expressPath: '/releases/:id/start',
    operationId: 'startRelease',
    pathParams: ['id'],
    requestBodySchema: null,
    canonicalResponse: {
      status: 200,
      contentType: 'application/json',
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          status: { type: 'string' },
        },
      },
    },
    operation: {
      responses: {
        '200': {
          description: 'ok',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  status: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  },
];

const resources = [
  {
    name: 'pets',
    collectionPath: '/pets',
    itemPath: '/pets/{petId}',
    idParam: 'petId',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        name: { type: 'string' },
      },
    },
    methods: ['create'],
  },
  {
    name: 'releases',
    collectionPath: '/releases',
    itemPath: '/releases/{id}',
    idParam: 'id',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        status: { type: 'string' },
        notes: { type: 'string' },
      },
    },
    methods: ['getById'],
  },
];

describe('buildOperationRegistry', () => {
  it('registers non-CRUD operations as operation-state routes', () => {
    const registry = buildOperationRegistry(operations, resources, {
      'GET /countries/{code}/summary': { mode: 'operation-state' },
    });

    expect(
      registry.find((entry) => entry.operation.key === 'GET /countries/{code}/summary')
    ).toMatchObject({
      routeKind: 'operation-state',
      method: 'GET',
      path: '/countries/:code/summary',
      operationConfig: {
        enabled: true,
        mode: 'operation-state',
        querySensitive: false,
      },
      projectionEligible: false,
    });
  });

  it('keeps CRUD-claimed operations resource-backed even when mode requests operation-state', () => {
    const entry = buildOperationRegistry(operations, resources, {
      createPet: { mode: 'operation-state' },
    }).find((route) => route.operation.key === 'POST /pets');

    expect(entry).toMatchObject({
      routeKind: 'resource',
      crudOperation: 'create',
      operationConfig: {
        enabled: true,
        mode: 'operation-state',
        querySensitive: false,
      },
      projectionEligible: false,
    });
  });

  it('warns and downgrades explicit resource-aware mode when build-time projection checks fail', () => {
    const warnings = [];
    const entry = buildOperationRegistry(
      operations,
      resources,
      {
        'POST /auth/login': { mode: 'resource-aware' },
      },
      {
        warn: (message) => warnings.push(message),
      }
    ).find((route) => route.operation.key === 'POST /auth/login');

    expect(entry).toMatchObject({
      routeKind: 'operation-state',
      projectionEligible: false,
      operationConfig: {
        enabled: true,
        mode: 'resource-aware',
        querySensitive: false,
      },
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/resource-aware.*POST \/auth\/login.*downgraded/i);
  });

  it('marks descendant operations projection-eligible when they match the parent resource schema', () => {
    const entry = buildOperationRegistry(operations, resources, {
      startRelease: { mode: 'auto' },
    }).find((route) => route.operation.key === 'POST /releases/{id}/start');

    expect(entry).toMatchObject({
      routeKind: 'operation-state',
      resource: resources[1],
      projectionEligible: true,
      operationConfig: {
        enabled: true,
        mode: 'auto',
        querySensitive: false,
      },
    });
  });

  it('preserves collision detection between operationId and canonical keys', () => {
    expect(() =>
      buildOperationRegistry(operations, resources, {
        createPet: { mode: 'auto' },
        'POST /pets': { mode: 'operation-state' },
      })
    ).toThrow(/either "createPet" or "POST \/pets"/);
  });
});
