import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { loadSpec } from '../../src/openapi/loadSpec.js';
import { compileOperations } from '../../src/openapi/compileOperations.js';

const FIXTURES = join(import.meta.dirname, '..', 'fixtures');

describe('compileOperations', () => {
  it('compiles petstore CRUD endpoints into operation definitions', async () => {
    const spec = await loadSpec(join(FIXTURES, 'petstore.yaml'));
    const operations = compileOperations(spec);
    const operationKeys = operations.map((op) => op.key);

    expect(operationKeys).toEqual([
      'GET /pets',
      'POST /pets',
      'GET /pets/{petId}',
      'PUT /pets/{petId}',
      'PATCH /pets/{petId}',
      'DELETE /pets/{petId}',
      'GET /users',
      'POST /users',
      'GET /users/{userId}',
      'PUT /users/{userId}',
      'DELETE /users/{userId}',
    ]);

    expect(operations.find((op) => op.operationId === 'createPet')).toMatchObject({
      key: 'POST /pets',
      method: 'POST',
      openApiPath: '/pets',
      expressPath: '/pets',
      requestBodySchema:
        spec.paths['/pets'].post.requestBody.content['application/json'].schema,
      canonicalResponse: { status: 201, contentType: 'application/json' },
    });

    expect(operations.find((op) => op.operationId === 'getPetById')).toMatchObject({
      key: 'GET /pets/{petId}',
      expressPath: '/pets/:petId',
      pathParams: ['petId'],
    });
  });

  it('ignores unsupported methods while compiling supported method and path pairs', () => {
    const spec = {
      openapi: '3.0.3',
      paths: {
        '/pets': {
          get: {
            operationId: 'listPets',
            responses: {
              200: {
                description: 'ok',
                content: {
                  'application/json': {
                    schema: { type: 'array', items: { type: 'object' } },
                  },
                },
              },
            },
          },
          head: {
            operationId: 'headPets',
            responses: {
              200: { description: 'ok' },
            },
          },
          options: {
            operationId: 'optionsPets',
            responses: {
              204: { description: 'ok' },
            },
          },
        },
      },
    };

    expect(compileOperations(spec)).toMatchObject([
      {
        key: 'GET /pets',
        operationId: 'listPets',
      },
    ]);
  });

  it('selects canonical responses from json, structured fallback, or bodyless success', () => {
    const spec = {
      openapi: '3.0.3',
      paths: {
        '/reports': {
          get: {
            operationId: 'getReport',
            responses: {
              202: {
                description: 'accepted',
                content: {
                  'text/plain': {
                    schema: { type: 'string' },
                  },
                },
              },
              203: {
                description: 'structured',
                content: {
                  'application/merge-patch+json': {
                    schema: { type: 'object' },
                  },
                },
              },
            },
          },
        },
        '/health': {
          delete: {
            operationId: 'clearHealth',
            responses: {
              204: {
                description: 'no content',
              },
            },
          },
        },
      },
    };

    expect(compileOperations(spec)).toMatchObject([
      {
        key: 'GET /reports',
        canonicalResponse: {
          status: 203,
          contentType: 'application/merge-patch+json',
        },
      },
      {
        key: 'DELETE /health',
        canonicalResponse: {
          status: 204,
          contentType: null,
        },
      },
    ]);
  });
});
