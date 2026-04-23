import { describe, it, expect } from 'vitest';
import { IdStrategy } from '../../src/engine/idStrategy.js';

describe('IdStrategy', () => {
  it('uses integer strategy for type: integer', () => {
    const strategy = new IdStrategy({ type: 'integer' });
    expect(strategy.type).toBe('integer');
  });

  it('uses uuid strategy for type: string, format: uuid', () => {
    const strategy = new IdStrategy({ type: 'string', format: 'uuid' });
    expect(strategy.type).toBe('uuid');
  });

  it('uses string strategy for type: string without format', () => {
    const strategy = new IdStrategy({ type: 'string' });
    expect(strategy.type).toBe('string');
  });

  it('falls back to integer when no schema given', () => {
    const strategy = new IdStrategy(null);
    expect(strategy.type).toBe('integer');
  });

  it('generates incremental integer id', () => {
    const strategy = new IdStrategy({ type: 'integer' });
    const id = strategy.generate([{ id: 3 }, { id: 7 }]);
    expect(id).toBe(8);
  });

  it('generates 1 when no existing items', () => {
    const strategy = new IdStrategy({ type: 'integer' });
    const id = strategy.generate([]);
    expect(id).toBe(1);
  });

  it('generates uuid for uuid strategy', () => {
    const strategy = new IdStrategy({ type: 'string', format: 'uuid' });
    const id = strategy.generate([]);
    expect(typeof id).toBe('string');
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  it('generates short string for string strategy', () => {
    const strategy = new IdStrategy({ type: 'string' });
    const id = strategy.generate([]);
    expect(typeof id).toBe('string');
    expect(id.length).toBe(8);
  });

  it('validates integer id as valid', () => {
    const strategy = new IdStrategy({ type: 'integer' });
    expect(strategy.validate(42)).toBe(true);
    expect(strategy.validate('42')).toBe(true);
  });

  it('rejects non-numeric for integer strategy', () => {
    const strategy = new IdStrategy({ type: 'integer' });
    expect(strategy.validate('abc')).toBe(false);
  });

  it('validates uuid format', () => {
    const strategy = new IdStrategy({ type: 'string', format: 'uuid' });
    expect(strategy.validate('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(strategy.validate('not-a-uuid')).toBe(false);
  });

  it('validates any string for string strategy', () => {
    const strategy = new IdStrategy({ type: 'string' });
    expect(strategy.validate('anything')).toBe(true);
    expect(strategy.validate(123)).toBe(false);
  });
});
