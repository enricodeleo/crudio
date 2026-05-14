import { describe, it, expect, vi } from 'vitest';
import { createValidators, createOperationResponseValidator } from '../../src/http/validators.js';

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

  it('enforces string format: email', () => {
    const v = createValidators({
      type: 'object',
      required: ['email'],
      properties: { email: { type: 'string', format: 'email' } },
    });

    expect(v.validateBody({ email: 'alice@example.com' }).valid).toBe(true);
    expect(v.validateBody({ email: 'not-an-email' }).valid).toBe(false);
  });

  it('enforces string format: uuid', () => {
    const v = createValidators({
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', format: 'uuid' } },
    });

    expect(v.validateBody({ id: '550e8400-e29b-41d4-a716-446655440000' }).valid).toBe(true);
    expect(v.validateBody({ id: 'not-a-uuid' }).valid).toBe(false);
  });

  it('enforces string format: date-time', () => {
    const v = createValidators({
      type: 'object',
      required: ['createdAt'],
      properties: { createdAt: { type: 'string', format: 'date-time' } },
    });

    expect(v.validateBody({ createdAt: '2026-05-14T10:00:00Z' }).valid).toBe(true);
    expect(v.validateBody({ createdAt: 'yesterday' }).valid).toBe(false);
  });
});

describe('createOperationResponseValidator', () => {
  const petOperation = {
    key: 'GET /pets/{petId}',
    canonicalResponse: { status: 200, contentType: 'application/json' },
    operation: {
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: { name: { type: 'string' } },
              },
            },
          },
        },
      },
    },
  };

  it('does not validate when the response status does not match canonical', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const validate = createOperationResponseValidator(petOperation, 'warn');

    validate({ error: 'Not found' }, 404);

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('validates when the response status matches canonical', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const validate = createOperationResponseValidator(petOperation, 'warn');

    validate({ name: 'Rex' }, 200);
    expect(warn).not.toHaveBeenCalled();

    validate({ unrelated: 'field' }, 200);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('treats missing status argument as a request to validate (backward compatible default)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const validate = createOperationResponseValidator(petOperation, 'warn');

    validate({ unrelated: 'field' });
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('returns null when mode is "off"', () => {
    expect(createOperationResponseValidator(petOperation, 'off')).toBeNull();
  });

  it('throws in strict mode when status matches and body is invalid', () => {
    const validate = createOperationResponseValidator(petOperation, 'strict');
    expect(() => validate({ unrelated: 'x' }, 200)).toThrow(/Response validation failed/);
  });

  it('does not throw in strict mode when status does not match canonical', () => {
    const validate = createOperationResponseValidator(petOperation, 'strict');
    expect(() => validate({ error: 'Not found' }, 404)).not.toThrow();
  });
});
