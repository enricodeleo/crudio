import { describe, it, expect } from 'vitest';
import { normalize } from '../../src/openapi/schemaResolver.js';
import { UnsupportedSchemaError } from '../../src/http/errors.js';

describe('schemaResolver', () => {
  it('passes through simple schemas unchanged', () => {
    const schema = {
      type: 'object',
      properties: { name: { type: 'string' } },
    };
    expect(normalize(schema, 'Test')).toEqual(schema);
  });

  it('merges allOf schemas', () => {
    const schema = {
      allOf: [
        {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
        },
        {
          type: 'object',
          properties: { id: { type: 'integer' } },
          required: ['id'],
        },
      ],
    };
    const result = normalize(schema, 'Pet');
    expect(result.type).toBe('object');
    expect(result.properties.name).toEqual({ type: 'string' });
    expect(result.properties.id).toEqual({ type: 'integer' });
    expect(result.required).toEqual(['name', 'id']);
    expect(result.allOf).toBeUndefined();
  });

  it('rejects oneOf', () => {
    const schema = { oneOf: [{ type: 'string' }, { type: 'integer' }] };
    expect(() => normalize(schema, 'User.address')).toThrow(UnsupportedSchemaError);
  });

  it('rejects anyOf', () => {
    const schema = { anyOf: [{ type: 'string' }, { type: 'null' }] };
    expect(() => normalize(schema, 'User.address')).toThrow(UnsupportedSchemaError);
  });

  it('rejects not', () => {
    const schema = { not: { type: 'string' } };
    expect(() => normalize(schema, 'User.address')).toThrow(UnsupportedSchemaError);
  });

  it('returns null for undefined schema', () => {
    expect(normalize(undefined, 'Test')).toBeNull();
  });

  it('merges nested properties in allOf', () => {
    const schema = {
      allOf: [
        {
          type: 'object',
          properties: {
            profile: {
              type: 'object',
              properties: { bio: { type: 'string' } },
            },
          },
        },
        {
          type: 'object',
          properties: { id: { type: 'integer' } },
        },
      ],
    };
    const result = normalize(schema, 'User');
    expect(result.properties.profile.properties.bio).toEqual({ type: 'string' });
    expect(result.properties.id).toEqual({ type: 'integer' });
  });
});
