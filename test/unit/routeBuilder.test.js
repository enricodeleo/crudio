import { describe, it, expect } from 'vitest';
import { buildRoutes } from '../../src/http/routeBuilder.js';

describe('routeBuilder', () => {
  it('registers GET collection route for list', () => {
    const routes = buildRoutes([
      {
        name: 'pets',
        collectionPath: '/pets',
        itemPath: '/pets/{petId}',
        idParam: 'petId',
        schema: { type: 'object', properties: { name: { type: 'string' } } },
        methods: ['list'],
      },
    ]);

    expect(routes).toHaveLength(1);
    expect(routes[0]).toEqual({ method: 'GET', path: '/pets', operation: 'list', resourceName: 'pets' });
  });

  it('registers all CRUD routes for a full resource', () => {
    const routes = buildRoutes([
      {
        name: 'pets',
        collectionPath: '/pets',
        itemPath: '/pets/{petId}',
        idParam: 'petId',
        schema: { type: 'object', properties: {} },
        methods: ['list', 'getById', 'create', 'update', 'patch', 'delete'],
      },
    ]);

    expect(routes).toHaveLength(6);
    const methods = routes.map((r) => r.method);
    expect(methods).toContain('GET');
    expect(methods).toContain('POST');
    expect(methods).toContain('PUT');
    expect(methods).toContain('PATCH');
    expect(methods).toContain('DELETE');
  });

  it('replaces {param} with :param for Express', () => {
    const routes = buildRoutes([
      {
        name: 'pets',
        collectionPath: '/pets',
        itemPath: '/pets/{petId}',
        idParam: 'petId',
        schema: { type: 'object', properties: {} },
        methods: ['getById'],
      },
    ]);

    expect(routes[0].path).toBe('/pets/:petId');
  });

  it('skips routes for excluded methods', () => {
    const routes = buildRoutes([
      {
        name: 'pets',
        collectionPath: '/pets',
        itemPath: '/pets/{petId}',
        idParam: 'petId',
        schema: { type: 'object', properties: {} },
        methods: ['list', 'getById'],
      },
    ]);

    expect(routes).toHaveLength(2);
  });
});
