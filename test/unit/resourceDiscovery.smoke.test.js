import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { loadSpec } from '../../src/openapi/loadSpec.js';
import { discoverResources } from '../../src/openapi/resourceDiscovery.js';

const FIXTURES = join(import.meta.dirname, '..', 'fixtures');

describe('resourceDiscovery smoke', () => {
  it('still discovers the pets CRUD resource used by app boot today', async () => {
    const spec = await loadSpec(join(FIXTURES, 'petstore.yaml'));
    const resources = discoverResources(spec);

    expect(resources.find((resource) => resource.name === 'pets')).toMatchObject({
      name: 'pets',
      collectionPath: '/pets',
      itemPath: '/pets/{petId}',
      idParam: 'petId',
    });
  });

  it('still derives full-path names to disambiguate shared last segments', () => {
    const spec = {
      openapi: '3.0.3',
      info: { title: 'Test', version: '1.0' },
      paths: {
        '/files': {
          get: { responses: { '200': { description: 'ok' } } },
        },
        '/files/{id}': {
          get: {
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { '200': { description: 'ok' } },
          },
        },
        '/logs/files': {
          get: { responses: { '200': { description: 'ok' } } },
        },
        '/logs/files/{id}': {
          get: {
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { '200': { description: 'ok' } },
          },
        },
      },
    };

    expect(discoverResources(spec).map((resource) => resource.name).sort()).toEqual([
      'files',
      'logs-files',
    ]);
  });

  it('still throws on derived-name collisions that would break current app boot', () => {
    const spec = {
      openapi: '3.0.3',
      info: { title: 'Test', version: '1.0' },
      paths: {
        '/a-b': {
          get: { responses: { '200': { description: 'ok' } } },
        },
        '/a-b/{id}': {
          get: {
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { '200': { description: 'ok' } },
          },
        },
        '/a/b': {
          get: { responses: { '200': { description: 'ok' } } },
        },
        '/a/b/{id}': {
          get: {
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { '200': { description: 'ok' } },
          },
        },
      },
    };

    expect(() => discoverResources(spec)).toThrow(/Resource name collision.*"a-b"/);
  });

  it('temporarily preserves config exclude behavior for the current app boot path until Task 6', () => {
    const spec = {
      openapi: '3.0.3',
      info: { title: 'Test', version: '1.0' },
      paths: {
        '/items': {
          get: { responses: { '200': { description: 'ok' } } },
        },
        '/items/{itemId}': {
          get: {
            parameters: [
              { name: 'itemId', in: 'path', required: true, schema: { type: 'integer' } },
            ],
            responses: { '200': { description: 'ok' } },
          },
        },
      },
    };

    expect(discoverResources(spec, { items: { exclude: true } })).toEqual([]);
  });

  it('temporarily preserves config method narrowing for the current app boot path until Task 6', () => {
    const spec = {
      openapi: '3.0.3',
      info: { title: 'Test', version: '1.0' },
      paths: {
        '/items': {
          get: { responses: { '200': { description: 'ok' } } },
          post: {
            requestBody: {
              content: {
                'application/json': {
                  schema: { type: 'object' },
                },
              },
            },
            responses: { '201': { description: 'created' } },
          },
        },
        '/items/{itemId}': {
          get: {
            parameters: [
              { name: 'itemId', in: 'path', required: true, schema: { type: 'integer' } },
            ],
            responses: { '200': { description: 'ok' } },
          },
          delete: {
            parameters: [
              { name: 'itemId', in: 'path', required: true, schema: { type: 'integer' } },
            ],
            responses: { '204': { description: 'deleted' } },
          },
        },
      },
    };

    expect(discoverResources(spec, { items: { methods: ['list', 'getById'] } })).toMatchObject([
      {
        name: 'items',
        methods: ['list', 'getById'],
      },
    ]);
  });
});
