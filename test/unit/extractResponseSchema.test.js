import { describe, it, expect } from 'vitest';
import {
  extractRawResponseSchema,
  extractResponseSchema,
} from '../../src/openapi/extractResponseSchema.js';

function makeOperation({ status = 200, contentType = 'application/json', schema } = {}) {
  return {
    key: `POST /things`,
    method: 'POST',
    openApiPath: '/things',
    canonicalResponse: status && contentType ? { status, contentType } : null,
    operation: {
      responses:
        status && contentType && schema
          ? {
              [String(status)]: {
                content: {
                  [contentType]: { schema },
                },
              },
            }
          : {},
    },
  };
}

describe('extractRawResponseSchema', () => {
  it('returns null when canonical response is missing', () => {
    expect(extractRawResponseSchema(makeOperation({ status: null, contentType: null }))).toBeNull();
  });

  it('returns null when schema is missing for the canonical response', () => {
    expect(extractRawResponseSchema(makeOperation({ schema: undefined }))).toBeNull();
  });

  it('returns the raw schema when canonical response points to one', () => {
    const schema = { type: 'object', properties: { id: { type: 'integer' } } };
    expect(extractRawResponseSchema(makeOperation({ schema }))).toBe(schema);
  });
});

describe('extractResponseSchema', () => {
  it('returns null when there is no schema', () => {
    expect(extractResponseSchema(makeOperation({ schema: undefined }))).toBeNull();
  });

  it('returns a normalized object schema as-is', () => {
    const schema = { type: 'object', properties: { name: { type: 'string' } } };
    expect(extractResponseSchema(makeOperation({ schema }))).toEqual(schema);
  });

  it('preserves array shape and does not unwrap items', () => {
    const schema = {
      type: 'array',
      items: { type: 'object', properties: { id: { type: 'integer' } } },
    };
    expect(extractResponseSchema(makeOperation({ schema }))).toEqual(schema);
  });

  it('merges allOf via schemaResolver.normalize', () => {
    const schema = {
      allOf: [
        { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'] },
        { type: 'object', properties: { name: { type: 'string' } } },
      ],
    };
    expect(extractResponseSchema(makeOperation({ schema }))).toEqual({
      type: 'object',
      properties: { id: { type: 'integer' }, name: { type: 'string' } },
      required: ['id'],
    });
  });

  it('propagates UnsupportedSchemaError for oneOf', () => {
    const schema = { oneOf: [{ type: 'object' }, { type: 'array' }] };
    expect(() => extractResponseSchema(makeOperation({ schema }))).toThrow();
  });
});
