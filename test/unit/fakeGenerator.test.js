import { describe, it, expect } from 'vitest';
import { generateFake } from '../../src/seed/fakeGenerator.js';

describe('fakeGenerator', () => {
  it('generates a string', () => {
    const value = generateFake({ type: 'string' });
    expect(typeof value).toBe('string');
    expect(value.length).toBeGreaterThan(0);
  });

  it('generates a string with format: email', () => {
    const value = generateFake({ type: 'string', format: 'email' });
    expect(typeof value).toBe('string');
    expect(value).toContain('@');
  });

  it('generates a string with format: uri', () => {
    const value = generateFake({ type: 'string', format: 'uri' });
    expect(typeof value).toBe('string');
    expect(value).toMatch(/^https?:\/\//);
  });

  it('generates a string with format: date-time', () => {
    const value = generateFake({ type: 'string', format: 'date-time' });
    expect(typeof value).toBe('string');
    expect(new Date(value).toISOString()).toBe(value);
  });

  it('generates a string with format: uuid', () => {
    const value = generateFake({ type: 'string', format: 'uuid' });
    expect(typeof value).toBe('string');
    expect(value).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('generates a string from enum', () => {
    const value = generateFake({ type: 'string', enum: ['dog', 'cat', 'bird'] });
    expect(['dog', 'cat', 'bird']).toContain(value);
  });

  it('generates an integer', () => {
    const value = generateFake({ type: 'integer' });
    expect(Number.isInteger(value)).toBe(true);
  });

  it('generates a number', () => {
    const value = generateFake({ type: 'number' });
    expect(typeof value).toBe('number');
  });

  it('generates a boolean', () => {
    const value = generateFake({ type: 'boolean' });
    expect(typeof value).toBe('boolean');
  });

  it('generates an array from items schema', () => {
    const value = generateFake({ type: 'array', items: { type: 'string' } });
    expect(Array.isArray(value)).toBe(true);
    expect(value.length).toBeGreaterThanOrEqual(1);
    expect(value.length).toBeLessThanOrEqual(3);
  });

  it('generates an object from properties', () => {
    const value = generateFake({
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'integer' },
      },
      required: ['name', 'age'],
    });
    expect(typeof value).toBe('object');
    expect(typeof value.name).toBe('string');
    expect(Number.isInteger(value.age)).toBe(true);
  });

  it('skips optional properties ~50% of the time', () => {
    let missingOptional = 0;
    for (let i = 0; i < 100; i++) {
      const value = generateFake({
        type: 'object',
        properties: {
          required_field: { type: 'string' },
          optional_field: { type: 'string' },
        },
        required: ['required_field'],
      });
      if (value.optional_field === undefined) missingOptional++;
    }
    expect(missingOptional).toBeGreaterThan(0);
  });

  it('returns null for unknown type', () => {
    const value = generateFake({ type: 'unknown' });
    expect(value).toBeNull();
  });

  it('returns null for undefined schema', () => {
    const value = generateFake(undefined);
    expect(value).toBeNull();
  });
});
