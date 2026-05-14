import { describe, it, expect } from 'vitest';
import { sanitizeForAjv } from '../../src/openapi/sanitizeForAjv.js';

describe('sanitizeForAjv', () => {
  it('drops `nullable` when the node has no `type`', () => {
    const schema = {
      oneOf: [{ type: 'boolean' }, { type: 'string' }],
      nullable: true,
    };
    const out = sanitizeForAjv(schema);
    expect(out).toEqual({ oneOf: [{ type: 'boolean' }, { type: 'string' }] });
  });

  it('keeps `nullable` when the node declares a `type`', () => {
    const schema = { type: 'string', nullable: true };
    const out = sanitizeForAjv(schema);
    expect(out).toEqual({ type: 'string', nullable: true });
  });

  it('recurses into nested objects, arrays, allOf, oneOf, properties', () => {
    const schema = {
      type: 'object',
      properties: {
        a: { type: 'string', nullable: true },
        b: { oneOf: [{ type: 'integer' }], nullable: true },
        c: {
          type: 'array',
          items: { allOf: [{ nullable: true }, { type: 'object' }] },
        },
      },
    };
    const out = sanitizeForAjv(schema);
    expect(out.properties.a).toEqual({ type: 'string', nullable: true });
    expect(out.properties.b).toEqual({ oneOf: [{ type: 'integer' }] });
    expect(out.properties.c.items.allOf[0]).toEqual({});
    expect(out.properties.c.items.allOf[1]).toEqual({ type: 'object' });
  });

  it('does not mutate the input schema', () => {
    const schema = { oneOf: [{ type: 'boolean' }], nullable: true };
    sanitizeForAjv(schema);
    expect(schema).toEqual({ oneOf: [{ type: 'boolean' }], nullable: true });
  });

  it('handles shared sub-schemas without infinite recursion', () => {
    const shared = { type: 'object', properties: { id: { type: 'integer' } } };
    const schema = {
      type: 'object',
      properties: { a: shared, b: shared },
    };
    const out = sanitizeForAjv(schema);
    expect(out.properties.a).toEqual(shared);
    expect(out.properties.b).toEqual(shared);
    // Shared sub-schemas should be recognised as the same output node.
    expect(out.properties.a).toBe(out.properties.b);
  });

  it('returns primitives unchanged', () => {
    expect(sanitizeForAjv(null)).toBeNull();
    expect(sanitizeForAjv(undefined)).toBeUndefined();
    expect(sanitizeForAjv('s')).toBe('s');
    expect(sanitizeForAjv(42)).toBe(42);
    expect(sanitizeForAjv(true)).toBe(true);
  });

  it('handles direct cycles in the schema graph', () => {
    const a = { type: 'object', properties: {} };
    a.properties.self = a;
    const out = sanitizeForAjv(a);
    expect(out.type).toBe('object');
    expect(out.properties.self).toBe(out);
  });
});
