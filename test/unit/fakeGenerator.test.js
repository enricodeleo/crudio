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

  it('generates an array from items schema (default: 1 deterministic item when useExamples)', () => {
    const value = generateFake({ type: 'array', items: { type: 'string' } });
    expect(Array.isArray(value)).toBe(true);
    expect(value).toHaveLength(1);
  });

  it('generates 1-3 random items when useExamples is false (seed CRUD path)', () => {
    const lengths = new Set();
    for (let i = 0; i < 50; i++) {
      const value = generateFake(
        { type: 'array', items: { type: 'string' } },
        { useExamples: false }
      );
      expect(Array.isArray(value)).toBe(true);
      expect(value.length).toBeGreaterThanOrEqual(1);
      expect(value.length).toBeLessThanOrEqual(3);
      lengths.add(value.length);
    }
    // Over 50 tries we expect to see at least 2 distinct lengths in the 1..3 range.
    expect(lengths.size).toBeGreaterThan(1);
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

  it('always populates optional properties (drop-in mock returns complete shape)', () => {
    for (let i = 0; i < 50; i++) {
      const value = generateFake({
        type: 'object',
        properties: {
          required_field: { type: 'string' },
          optional_field: { type: 'string' },
        },
        required: ['required_field'],
      });
      expect(value.required_field).toBeDefined();
      expect(value.optional_field).toBeDefined();
    }
  });

  it('returns the schema example verbatim when useExamples is true (default)', () => {
    const value = generateFake({
      type: 'string',
      example: 'configured-value',
    });
    expect(value).toBe('configured-value');
  });

  it('returns the schema example for objects and arrays (deep cloned)', () => {
    const example = { token: 'abc', roles: ['admin', 'user'] };
    const out = generateFake({
      type: 'object',
      example,
      properties: {
        token: { type: 'string' },
        roles: { type: 'array', items: { type: 'string' } },
      },
    });
    expect(out).toEqual(example);
    expect(out).not.toBe(example);
    expect(out.roles).not.toBe(example.roles);
  });

  it('uses property-level examples when the parent object has no example', () => {
    const value = generateFake({
      type: 'object',
      properties: {
        type: { type: 'string', example: 'DESKTOP' },
        ip: { type: 'string', example: '10.0.0.1' },
        port: { type: 'integer', example: 443 },
      },
    });
    expect(value).toEqual({ type: 'DESKTOP', ip: '10.0.0.1', port: 443 });
  });

  it('ignores examples when useExamples is false (seed CRUD path produces variation)', () => {
    const values = new Set();
    for (let i = 0; i < 30; i++) {
      const value = generateFake(
        { type: 'string', example: 'fixed' },
        { useExamples: false }
      );
      values.add(value);
    }
    expect(values.has('fixed')).toBe(false);
    expect(values.size).toBeGreaterThan(1);
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
