import { describe, it, expect } from 'vitest';
import { discoverResources } from '../../src/openapi/resourceDiscovery.js';
import { join } from 'node:path';
import { loadSpec } from '../../src/openapi/loadSpec.js';

const FIXTURES = join(import.meta.dirname, '..', 'fixtures');

describe('resourceDiscovery', () => {
  it('discovers pets resource from petstore fixture', async () => {
    const spec = await loadSpec(join(FIXTURES, 'petstore.yaml'));
    const resources = discoverResources(spec);
    const pets = resources.find((r) => r.name === 'pets');
    expect(pets).toBeDefined();
    expect(pets.collectionPath).toBe('/pets');
    expect(pets.itemPath).toBe('/pets/{petId}');
    expect(pets.idParam).toBe('petId');
    expect(pets.methods).toContain('list');
    expect(pets.methods).toContain('getById');
    expect(pets.methods).toContain('create');
    expect(pets.methods).toContain('update');
    expect(pets.methods).toContain('patch');
    expect(pets.methods).toContain('delete');
  });

  it('discovers users resource from petstore fixture', async () => {
    const spec = await loadSpec(join(FIXTURES, 'petstore.yaml'));
    const resources = discoverResources(spec);
    const users = resources.find((r) => r.name === 'users');
    expect(users).toBeDefined();
    expect(users.collectionPath).toBe('/users');
    expect(users.itemPath).toBe('/users/{userId}');
    expect(users.idParam).toBe('userId');
    expect(users.methods).not.toContain('patch');
  });

  it('extracts schema from response and request body', async () => {
    const spec = await loadSpec(join(FIXTURES, 'petstore.yaml'));
    const resources = discoverResources(spec);
    const pets = resources.find((r) => r.name === 'pets');
    expect(pets.schema).toBeDefined();
    expect(pets.schema.properties).toBeDefined();
    expect(pets.schema.properties.name).toBeDefined();
    expect(pets.schema.properties.id).toBeDefined();
  });

  it('skips paths without a matching pair', () => {
    const spec = {
      openapi: '3.0.3',
      info: { title: 'Test', version: '1.0' },
      paths: {
        '/standalone': {
          get: {
            responses: { '200': { description: 'ok' } },
          },
        },
      },
    };
    const resources = discoverResources(spec);
    expect(resources).toHaveLength(0);
  });

  it('derives resource name from the full collection path', () => {
    const spec = {
      openapi: '3.0.3',
      info: { title: 'Test', version: '1.0' },
      paths: {
        '/api/v1/products': {
          get: { responses: { '200': { description: 'ok' } } },
          post: {
            requestBody: {
              content: {
                'application/json': { schema: { type: 'object', properties: {} } },
              },
            },
            responses: { '201': { description: 'ok' } },
          },
        },
        '/api/v1/products/{productId}': {
          get: {
            parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'integer' } }],
            responses: { '200': { description: 'ok' } },
          },
          delete: {
            parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'integer' } }],
            responses: { '204': { description: 'ok' } },
          },
        },
      },
    };
    const resources = discoverResources(spec);
    expect(resources).toHaveLength(1);
    expect(resources[0].name).toBe('api-v1-products');
    expect(resources[0].collectionPath).toBe('/api/v1/products');
    expect(resources[0].itemPath).toBe('/api/v1/products/{productId}');
  });

  it('disambiguates resources that share a last segment', () => {
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
    const resources = discoverResources(spec);
    const names = resources.map((r) => r.name).sort();
    expect(names).toEqual(['files', 'logs-files']);
  });

  it('throws a clear error when two paths collide on the derived name', () => {
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

  it('applies config overrides to exclude resources', () => {
    const spec = {
      openapi: '3.0.3',
      info: { title: 'Test', version: '1.0' },
      paths: {
        '/items': {
          get: { responses: { '200': { description: 'ok' } } },
        },
        '/items/{itemId}': {
          get: {
            parameters: [{ name: 'itemId', in: 'path', required: true, schema: { type: 'integer' } }],
            responses: { '200': { description: 'ok' } },
          },
        },
      },
    };
    const resources = discoverResources(spec, { items: { exclude: true } });
    expect(resources).toHaveLength(0);
  });

  it('applies config overrides for methods', () => {
    const spec = {
      openapi: '3.0.3',
      info: { title: 'Test', version: '1.0' },
      paths: {
        '/items': {
          get: { responses: { '200': { description: 'ok' } } },
          post: {
            requestBody: {
              content: { 'application/json': { schema: { type: 'object' } } },
            },
            responses: { '201': { description: 'ok' } },
          },
        },
        '/items/{itemId}': {
          get: {
            parameters: [{ name: 'itemId', in: 'path', required: true, schema: { type: 'integer' } }],
            responses: { '200': { description: 'ok' } },
          },
          delete: {
            parameters: [{ name: 'itemId', in: 'path', required: true, schema: { type: 'integer' } }],
            responses: { '204': { description: 'ok' } },
          },
        },
      },
    };
    const resources = discoverResources(spec, {
      items: { methods: ['list', 'getById'] },
    });
    expect(resources[0].methods).toEqual(['list', 'getById']);
  });
});
