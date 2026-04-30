import { describe, expect, it } from 'vitest';

import { validateDeclarativeRuleEffects } from '../../src/http/validateDeclarativeRuleEffects.js';

describe('validateDeclarativeRuleEffects', () => {
  it('allows patchResource on a descendant operation with a linked resource target', () => {
    expect(() =>
      validateDeclarativeRuleEffects({
        operation: {
          key: 'POST /releases/{id}/start',
          openApiPath: '/releases/{id}/start',
        },
        rules: [
          {
            name: 'start-release',
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
        resource: {
          name: 'releases',
          itemPath: '/releases/{id}',
        },
      })
    ).not.toThrow();
  });

  it('allows patchResource on a CRUD item route with a linked resource target', () => {
    expect(() =>
      validateDeclarativeRuleEffects({
        operation: {
          key: 'PUT /releases/{id}',
          openApiPath: '/releases/{id}',
        },
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
        resource: {
          name: 'releases',
          itemPath: '/releases/{id}',
        },
      })
    ).not.toThrow();
  });

  it('rejects patchResource when the operation has no linked resource target', () => {
    expect(() =>
      validateDeclarativeRuleEffects({
        operation: {
          key: 'POST /auth/login',
          openApiPath: '/auth/login',
        },
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
        resource: null,
      })
    ).toThrow(/linked resource target/i);
  });

  it('rejects patchResource on collection routes even if a resource exists', () => {
    expect(() =>
      validateDeclarativeRuleEffects({
        operation: {
          key: 'POST /pets',
          openApiPath: '/pets',
        },
        rules: [
          {
            name: 'create-pet-rule',
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
        resource: {
          name: 'pets',
          itemPath: '/pets/{petId}',
        },
      })
    ).toThrow(/linked resource target/i);
  });
});
