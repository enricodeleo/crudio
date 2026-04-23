import { describe, it, expect } from 'vitest';
import {
  CrudioError,
  NotFoundError,
  ValidationError,
  DuplicateIdError,
  UnsupportedSchemaError,
  MethodNotAllowedError,
} from '../../src/http/errors.js';

describe('errors', () => {
  it('CrudioError is base with status and message', () => {
    const err = new CrudioError('test', 500);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('test');
    expect(err.status).toBe(500);
    expect(err.name).toBe('CrudioError');
  });

  it('NotFoundError has status 404', () => {
    const err = new NotFoundError('users', '42');
    expect(err).toBeInstanceOf(CrudioError);
    expect(err.status).toBe(404);
    expect(err.message).toBe('Resource users with id 42 not found');
  });

  it('ValidationError has status 400 and errors array', () => {
    const details = [{ instancePath: '/name', message: 'required' }];
    const err = new ValidationError(details);
    expect(err).toBeInstanceOf(CrudioError);
    expect(err.status).toBe(400);
    expect(err.errors).toEqual(details);
  });

  it('DuplicateIdError has status 409', () => {
    const err = new DuplicateIdError('users', '42');
    expect(err).toBeInstanceOf(CrudioError);
    expect(err.status).toBe(409);
    expect(err.message).toBe('Resource users already has an item with id 42');
  });

  it('UnsupportedSchemaError has status 400', () => {
    const err = new UnsupportedSchemaError('oneOf', 'User.address');
    expect(err).toBeInstanceOf(CrudioError);
    expect(err.status).toBe(400);
    expect(err.message).toContain('oneOf');
    expect(err.message).toContain('User.address');
  });

  it('MethodNotAllowedError has status 405', () => {
    const err = new MethodNotAllowedError('PATCH', '/users');
    expect(err).toBeInstanceOf(CrudioError);
    expect(err.status).toBe(405);
    expect(err.message).toBe('Method PATCH not allowed on /users');
  });
});
