import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { loadSpec } from '../../src/openapi/loadSpec.js';
import { compileOperations } from '../../src/openapi/compileOperations.js';
import { inferResources } from '../../src/openapi/inferResources.js';

const FIXTURES = join(import.meta.dirname, '..', 'fixtures');

function compile(spec) {
  return compileOperations(spec);
}

describe('inferResources', () => {
  it('infers pets as a CRUD resource from compiled operations', async () => {
    const spec = await loadSpec(join(FIXTURES, 'petstore.yaml'));
    const operations = compileOperations(spec);
    const resources = inferResources(operations, {});

    expect(resources.find((resource) => resource.name === 'pets')).toMatchObject({
      name: 'pets',
      collectionPath: '/pets',
      itemPath: '/pets/{petId}',
      idParam: 'petId',
      methods: ['list', 'create', 'getById', 'update', 'patch', 'delete'],
    });
  });

  it('extracts schema and id schema from compiled operations', async () => {
    const spec = await loadSpec(join(FIXTURES, 'petstore.yaml'));
    const resources = inferResources(compileOperations(spec), {});
    const pets = resources.find((resource) => resource.name === 'pets');

    expect(pets.schema.type).toBe('object');
    expect(pets.schema.required).toEqual(expect.arrayContaining(['id', 'name']));
    expect(pets.schema.properties).toMatchObject({
      id: { type: 'integer' },
      name: { type: 'string' },
    });
    expect(pets.idSchema).toEqual({ type: 'integer' });
  });

  it('uses canonical response metadata to extract resource schema', () => {
    const spec = {
      openapi: '3.0.3',
      info: { title: 'Test', version: '1.0' },
      paths: {
        '/reports': {
          get: {
            operationId: 'listReports',
            responses: {
              '202': {
                description: 'accepted',
                content: {
                  'text/plain': {
                    schema: { type: 'string' },
                  },
                },
              },
              '203': {
                description: 'structured',
                content: {
                  'application/merge-patch+json': {
                    schema: {
                      type: 'array',
                      items: {
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
        },
        '/reports/{reportId}': {
          delete: {
            operationId: 'deleteReport',
            parameters: [
              { name: 'reportId', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: {
              '204': { description: 'deleted' },
            },
          },
        },
      },
    };

    expect(inferResources(compile(spec))).toMatchObject([
      {
        name: 'reports',
        schema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            status: { type: 'string' },
          },
        },
        methods: ['list', 'delete'],
      },
    ]);
  });

  it('skips paths without a matching collection and item pair', () => {
    const spec = {
      openapi: '3.0.3',
      info: { title: 'Test', version: '1.0' },
      paths: {
        '/standalone': {
          get: {
            operationId: 'listStandalone',
            responses: { '200': { description: 'ok' } },
          },
        },
      },
    };

    expect(inferResources(compile(spec))).toEqual([]);
  });

  it('derives the resource name from the full collection path', () => {
    const spec = {
      openapi: '3.0.3',
      info: { title: 'Test', version: '1.0' },
      paths: {
        '/api/v1/products': {
          get: {
            operationId: 'listProducts',
            responses: { '200': { description: 'ok' } },
          },
        },
        '/api/v1/products/{productId}': {
          get: {
            operationId: 'getProductById',
            parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'integer' } }],
            responses: { '200': { description: 'ok' } },
          },
        },
      },
    };

    expect(inferResources(compile(spec))).toMatchObject([
      {
        name: 'api-v1-products',
        collectionPath: '/api/v1/products',
        itemPath: '/api/v1/products/{productId}',
      },
    ]);
  });

  it('infers a resource from paired paths even when get operations are absent', () => {
    const spec = {
      openapi: '3.0.3',
      info: { title: 'Test', version: '1.0' },
      paths: {
        '/items': {
          post: {
            operationId: 'createItem',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                    },
                  },
                },
              },
            },
            responses: {
              '201': { description: 'created' },
            },
          },
        },
        '/items/{itemId}': {
          delete: {
            operationId: 'deleteItem',
            parameters: [
              { name: 'itemId', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: {
              '204': { description: 'deleted' },
            },
          },
        },
      },
    };

    expect(inferResources(compile(spec))).toMatchObject([
      {
        name: 'items',
        collectionPath: '/items',
        itemPath: '/items/{itemId}',
        idParam: 'itemId',
        idSchema: { type: 'string' },
        methods: ['create', 'delete'],
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
        },
      },
    ]);
  });

  it('throws when two collection paths collide on the derived name', () => {
    const spec = {
      openapi: '3.0.3',
      info: { title: 'Test', version: '1.0' },
      paths: {
        '/a-b': {
          get: {
            operationId: 'listAB',
            responses: { '200': { description: 'ok' } },
          },
        },
        '/a-b/{id}': {
          get: {
            operationId: 'getAB',
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { '200': { description: 'ok' } },
          },
        },
        '/a/b': {
          get: {
            operationId: 'listA_B',
            responses: { '200': { description: 'ok' } },
          },
        },
        '/a/b/{id}': {
          get: {
            operationId: 'getA_B',
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { '200': { description: 'ok' } },
          },
        },
      },
    };

    expect(() => inferResources(compile(spec))).toThrow(/Resource name collision.*"a-b"/);
  });
});
