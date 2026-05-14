import { describe, it, expect } from 'vitest';
import { buildListResponseBody } from '../../src/http/buildListResponseBody.js';

const items = [{ id: 1 }, { id: 2 }];

describe('buildListResponseBody', () => {
  it('returns the items array unchanged when the response schema is `type: array`', () => {
    const body = buildListResponseBody({
      schema: { type: 'array', items: { type: 'object' } },
      items,
      total: 2,
    });

    expect(body).toEqual(items);
  });

  it('returns the legacy {items,total} wrapper when no response schema is provided', () => {
    const body = buildListResponseBody({ schema: null, items, total: 5 });
    expect(body).toEqual({ items, total: 5 });
  });

  it('fills the first array property with items when schema is an object', () => {
    const body = buildListResponseBody({
      schema: {
        type: 'object',
        properties: {
          items: { type: 'array', items: { type: 'object' } },
        },
      },
      items,
      total: 2,
    });

    expect(body).toEqual({ items });
  });

  it('honors a custom item-field name (e.g. data) instead of items', () => {
    const body = buildListResponseBody({
      schema: {
        type: 'object',
        properties: {
          data: { type: 'array', items: { type: 'object' } },
        },
      },
      items,
      total: 2,
    });

    expect(body).toEqual({ data: items });
  });

  it('assigns the total to integer/number fields named total, count, totalItems, totalCount', () => {
    for (const field of ['total', 'count', 'totalItems', 'totalCount']) {
      const body = buildListResponseBody({
        schema: {
          type: 'object',
          properties: {
            items: { type: 'array', items: { type: 'object' } },
            [field]: { type: 'integer' },
          },
        },
        items,
        total: 42,
      });

      expect(body[field]).toBe(42);
    }
  });

  it('is case-insensitive on count-field name matching', () => {
    const body = buildListResponseBody({
      schema: {
        type: 'object',
        properties: {
          items: { type: 'array', items: { type: 'object' } },
          Total: { type: 'integer' },
        },
      },
      items,
      total: 7,
    });

    expect(body.Total).toBe(7);
  });

  it('does not treat unrelated integer fields as count (e.g. `pageSize`)', () => {
    const body = buildListResponseBody({
      schema: {
        type: 'object',
        properties: {
          items: { type: 'array', items: { type: 'object' } },
          pageSize: { type: 'integer' },
        },
      },
      items,
      total: 2,
    });

    expect(typeof body.pageSize).toBe('number');
    expect(body.pageSize).not.toBe(2);
  });

  it('generates a fake value for unrecognized object/string properties from their sub-schema', () => {
    const body = buildListResponseBody({
      schema: {
        type: 'object',
        properties: {
          items: { type: 'array', items: { type: 'object' } },
          total: { type: 'integer' },
          nextCursor: { type: 'string' },
        },
      },
      items,
      total: 2,
    });

    expect(typeof body.nextCursor).toBe('string');
    expect(body.nextCursor.length).toBeGreaterThan(0);
  });

  it('picks only the FIRST array property as items when the schema has multiple arrays', () => {
    const body = buildListResponseBody({
      schema: {
        type: 'object',
        properties: {
          items: { type: 'array', items: { type: 'object' } },
          related: { type: 'array', items: { type: 'string' } },
        },
      },
      items,
      total: 2,
    });

    expect(body.items).toEqual(items);
    // `related` is filled with a fake string array, not with `items`
    expect(Array.isArray(body.related)).toBe(true);
    expect(body.related).not.toEqual(items);
  });

  it('falls back to {items,total} when schema is an object with no array property at all', () => {
    const body = buildListResponseBody({
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
        },
      },
      items,
      total: 2,
    });

    expect(body).toEqual({ items, total: 2 });
  });
});
