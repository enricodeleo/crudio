import { describe, it, expect } from 'vitest';
import { resolveFK } from '../../src/seed/fkResolver.js';

describe('resolveFK', () => {
  const resources = ['users', 'stores', 'store-collections', 'deploys', 'divisioni', 'negozi'];

  it('returns null for non-FK property names', () => {
    expect(resolveFK('name', { type: 'string' }, resources)).toBe(null);
    expect(resolveFK('isValid', { type: 'boolean' }, resources)).toBe(null);
    expect(resolveFK('email', { type: 'string' }, resources)).toBe(null);
  });

  it('returns null for the primary key itself', () => {
    expect(resolveFK('id', { type: 'string' }, resources)).toBe(null);
    expect(resolveFK('_id', { type: 'string' }, resources)).toBe(null);
    expect(resolveFK('ID', { type: 'string' }, resources)).toBe(null);
  });

  it('detects camelCase singular FK', () => {
    expect(resolveFK('userId', { type: 'string' }, resources)).toEqual({
      target: 'users',
      isArray: false,
    });
  });

  it('detects snake_case singular FK', () => {
    expect(resolveFK('user_id', { type: 'string' }, resources)).toEqual({
      target: 'users',
      isArray: false,
    });
  });

  it('detects camelCase array FK', () => {
    expect(
      resolveFK('storeIds', { type: 'array', items: { type: 'string' } }, resources)
    ).toEqual({ target: 'stores', isArray: true });
  });

  it('detects snake_case array FK', () => {
    expect(
      resolveFK('store_ids', { type: 'array', items: { type: 'string' } }, resources)
    ).toEqual({ target: 'stores', isArray: true });
  });

  it('maps multi-word camelCase FK to kebab-case plural resource', () => {
    expect(resolveFK('storeCollectionId', { type: 'string' }, resources)).toEqual({
      target: 'store-collections',
      isArray: false,
    });
  });

  it('handles Italian plurals for o/e→i', () => {
    expect(resolveFK('divisione_id', { type: 'string' }, resources)).toEqual({
      target: 'divisioni',
      isArray: false,
    });
    expect(resolveFK('negozioId', { type: 'string' }, resources)).toEqual({
      target: 'negozi',
      isArray: false,
    });
  });

  it('honors explicit x-crudio-ref even when heuristic misses', () => {
    const schema = { type: 'string', 'x-crudio-ref': 'divisioni' };
    expect(resolveFK('division_id', schema, resources)).toEqual({
      target: 'divisioni',
      isArray: false,
    });
  });

  it('returns null when x-crudio-ref targets a non-existent resource', () => {
    const schema = { type: 'string', 'x-crudio-ref': 'ghosts' };
    expect(resolveFK('ghostId', schema, resources)).toBe(null);
  });

  it('explicit x-crudio-ref on array marks isArray true', () => {
    const schema = { type: 'array', items: { type: 'string' }, 'x-crudio-ref': 'stores' };
    expect(resolveFK('whatever', schema, resources)).toEqual({
      target: 'stores',
      isArray: true,
    });
  });

  it('returns null when heuristic stem does not match any resource', () => {
    expect(resolveFK('widgetId', { type: 'string' }, resources)).toBe(null);
  });

  it('does not treat UUID-like tail as FK', () => {
    expect(resolveFK('uuid', { type: 'string' }, resources)).toBe(null);
  });

  it('ignores malformed input gracefully', () => {
    expect(resolveFK('', { type: 'string' }, resources)).toBe(null);
    expect(resolveFK(null, { type: 'string' }, resources)).toBe(null);
    expect(resolveFK('userId', {}, null)).toBe(null);
  });
});
