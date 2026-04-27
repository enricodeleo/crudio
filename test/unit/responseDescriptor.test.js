import { describe, expect, it } from 'vitest';
import { assertValidDescriptor, json, sendDescriptor } from '../../src/http/responseDescriptor.js';

describe('responseDescriptor helpers', () => {
  it('creates normalized JSON descriptors', () => {
    expect(json(201, { id: 1 })).toEqual({
      status: 201,
      body: { id: 1 },
      headers: {},
    });
  });

  it('rejects malformed descriptors', () => {
    expect(() => assertValidDescriptor({ body: {} })).toThrow(/status/i);
  });

  it('writes descriptors to an express-like response', () => {
    const response = createResponse();

    sendDescriptor(response, {
      status: 200,
      body: { ok: true },
      headers: { 'x-test': 'yes' },
    });

    expect(response.headers).toEqual({ 'x-test': 'yes' });
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ ok: true });
    expect(response.ended).toBe(false);
  });

  it('ends 204 descriptors without writing a body', () => {
    const response = createResponse();

    sendDescriptor(response, {
      status: 204,
      body: undefined,
      headers: {},
    });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBeUndefined();
    expect(response.ended).toBe(true);
  });
});

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    ended: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    set(headers) {
      Object.assign(this.headers, headers);
      return this;
    },
    json(body) {
      this.body = body;
      this.ended = false;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
}
