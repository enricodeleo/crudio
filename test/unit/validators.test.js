import { describe, it, expect } from 'vitest';
import { createValidators } from '../../src/http/validators.js';

describe('validators', () => {
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'integer' },
      tag: { type: 'string', enum: ['dog', 'cat'] },
    },
    required: ['name'],
  };

  it('validates a valid full body', () => {
    const v = createValidators(schema);
    const result = v.validateBody({ name: 'Rex', age: 3 });
    expect(result.valid).toBe(true);
  });

  it('rejects body missing required field', () => {
    const v = createValidators(schema);
    const result = v.validateBody({ age: 3 });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects wrong type', () => {
    const v = createValidators(schema);
    const result = v.validateBody({ name: 123 });
    expect(result.valid).toBe(false);
  });

  it('rejects invalid enum value', () => {
    const v = createValidators(schema);
    const result = v.validateBody({ name: 'Rex', tag: 'lizard' });
    expect(result.valid).toBe(false);
  });

  it('validates partial body for patch', () => {
    const v = createValidators(schema);
    const result = v.validatePatch({ tag: 'dog' });
    expect(result.valid).toBe(true);
  });

  it('rejects invalid type in patch', () => {
    const v = createValidators(schema);
    const result = v.validatePatch({ name: 123 });
    expect(result.valid).toBe(false);
  });

  it('allows empty patch body', () => {
    const v = createValidators(schema);
    const result = v.validatePatch({});
    expect(result.valid).toBe(true);
  });

  it('parses query params with defaults', () => {
    const v = createValidators(schema);
    const query = v.parseQuery({ limit: '10', offset: '5', name: 'Rex' });
    expect(query).toEqual({ limit: 10, offset: 5, filters: { name: 'Rex' } });
  });

  it('uses default limit and offset when not provided', () => {
    const v = createValidators(schema);
    const query = v.parseQuery({});
    expect(query.limit).toBe(100);
    expect(query.offset).toBe(0);
    expect(query.filters).toEqual({});
  });

  it('caps limit at 1000', () => {
    const v = createValidators(schema);
    const query = v.parseQuery({ limit: '5000' });
    expect(query.limit).toBe(1000);
  });

  it('ignores limit/offset from filters', () => {
    const v = createValidators(schema);
    const query = v.parseQuery({ limit: '10', offset: '0', name: 'Rex' });
    expect(query.filters).toEqual({ name: 'Rex' });
  });
});
