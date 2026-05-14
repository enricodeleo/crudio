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
    key: 'PUT /releases/{id}',
    method: 'PUT',
    openApiPath: '/releases/{id}',
    expressPath: '/releases/:id',
    operationId: 'updateRelease',
    pathParams: ['id'],
    requestBodySchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        status: { type: 'string' },
        notes: { type: 'string' },
      },
    },
    canonicalResponse: {
      status: 200,
      contentType: 'application/json',
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          status: { type: 'string' },
          notes: { type: 'string' },
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
                  notes: { type: 'string' },
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
  {
    key: 'GET /releases/{id}/details',
    method: 'GET',
    openApiPath: '/releases/{id}/details',
    expressPath: '/releases/:id/details',
    operationId: 'getReleaseDetails',
    pathParams: ['id'],
    requestBodySchema: null,
    canonicalResponse: {
      status: 200,
      contentType: 'application/json',
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          metadata: {
            type: 'object',
            properties: {
              tags: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    label: { type: 'string' },
                  },
                },
              },
            },
          },
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
                  metadata: {
                    type: 'object',
                    properties: {
                      tags: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            label: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
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
        metadata: {
          type: 'object',
          properties: {
            tags: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  label: { type: 'integer' },
                },
              },
            },
          },
        },
      },
    },
    methods: ['getById', 'update'],
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

  it('preserves per-operation responseFake on the registry entry', () => {
    const registry = buildOperationRegistry(operations, resources, {
      'POST /auth/login': { responseFake: 'off' },
    });

    const entry = registry.find((route) => route.operation.key === 'POST /auth/login');
    expect(entry.operationConfig.responseFake).toBe('off');
  });

  it('leaves responseFake undefined on operations without an override', () => {
    const registry = buildOperationRegistry(operations, resources, {});
    const entry = registry.find((route) => route.operation.key === 'POST /auth/login');
    expect(entry.operationConfig.responseFake).toBeUndefined();
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
        mode: 'operation-state',
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

  it('marks descendant operations projection-ineligible when nested object and array shapes differ', () => {
    const entry = buildOperationRegistry(operations, resources, {
      getReleaseDetails: { mode: 'auto' },
    }).find((route) => route.operation.key === 'GET /releases/{id}/details');

    expect(entry).toMatchObject({
      routeKind: 'operation-state',
      resource: resources[1],
      projectionEligible: false,
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

  it('rejects patchResource rules on operations without a linked resource target', () => {
    expect(() =>
      buildOperationRegistry(operations, resources, {
        login: {
          rules: [
            {
              name: 'login-rule',
              then: {
                patchResource: {
                  status: 'started',
                },
                respond: {
                  status: 200,
                  body: { ok: true },
                },
              },
            },
          ],
        },
      })
    ).toThrow(/linked resource target/i);
  });

  it('allows patchResource rules on CRUD item routes with a linked resource target', () => {
    const entry = buildOperationRegistry(operations, resources, {
      updateRelease: {
        rules: [
          {
            name: 'patch-linked-release',
            then: {
              patchResource: {
                status: 'started',
              },
              respond: {
                status: 200,
                body: { ok: true },
              },
            },
          },
        ],
      },
    }).find((route) => route.operation.key === 'PUT /releases/{id}');

    expect(entry).toMatchObject({
      routeKind: 'resource',
      crudOperation: 'update',
      resource: resources[1],
      operationConfig: {
        enabled: true,
        mode: 'auto',
        querySensitive: false,
        rules: [
          {
            name: 'patch-linked-release',
            then: {
              patchResource: {
                status: 'started',
              },
              respond: {
                status: 200,
                body: { ok: true },
              },
            },
          },
        ],
      },
    });
  });
});
