import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createApp } from '../../src/app.js';

const FIXTURES = join(import.meta.dirname, '..', 'fixtures');
const TEST_DIR = join(import.meta.dirname, '..', 'tmp-integration');

describe('CRUD routes integration', () => {
  let app;

  beforeEach(async () => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(TEST_DIR, { recursive: true });
    app = await createApp({
      specPath: join(FIXTURES, 'petstore.yaml'),
      dataDir: TEST_DIR,
      resources: {},
    });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  async function request(method, path, body = null) {
    const { default: supertest } = await import('supertest');
    let req = supertest(app)[method.toLowerCase()](path);
    if (body) req = req.send(body).set('Content-Type', 'application/json');
    return req;
  }

  it('POST /pets creates a pet', async () => {
    const res = await request('POST', '/pets', { name: 'Rex', tag: 'dog' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Rex');
    expect(res.body.id).toBe(1);
  });

  it('GET /pets returns an empty array when the spec declares `type: array`', async () => {
    const res = await request('GET', '/pets');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('GET /pets returns created pets as a plain array (matches `type: array` in the spec)', async () => {
    await request('POST', '/pets', { name: 'Rex' });
    await request('POST', '/pets', { name: 'Buddy' });
    const res = await request('GET', '/pets');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
  });

  it('keeps the petstore CRUD flow green through the operation-first app', async () => {
    await request('POST', '/pets', { name: 'Rex' });
    const list = await request('GET', '/pets');
    expect(list.body).toHaveLength(1);
    expect((await request('GET', '/pets/1')).status).toBe(200);
  });

  it('GET /pets/:petId returns a single pet', async () => {
    await request('POST', '/pets', { name: 'Rex' });
    const res = await request('GET', '/pets/1');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Rex');
  });

  it('GET /pets/:petId returns 404 for missing', async () => {
    const res = await request('GET', '/pets/99');
    expect(res.status).toBe(404);
  });

  it('PUT /pets/:petId updates a pet', async () => {
    await request('POST', '/pets', { name: 'Rex', tag: 'dog' });
    const res = await request('PUT', '/pets/1', { id: 1, name: 'Rex II', tag: 'dog' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Rex II');
  });

  it('PATCH /pets/:petId patches a pet', async () => {
    await request('POST', '/pets', { name: 'Rex', tag: 'dog' });
    const res = await request('PATCH', '/pets/1', { tag: 'cat' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Rex');
    expect(res.body.tag).toBe('cat');
  });

  it('DELETE /pets/:petId deletes a pet', async () => {
    await request('POST', '/pets', { name: 'Rex' });
    const res = await request('DELETE', '/pets/1');
    expect(res.status).toBe(204);
  });

  it('DELETE /pets/:petId returns 404 for missing', async () => {
    const res = await request('DELETE', '/pets/99');
    expect(res.status).toBe(404);
  });

  it('POST /pets with invalid body returns 400', async () => {
    const res = await request('POST', '/pets', { tag: 'dog' });
    expect(res.status).toBe(400);
  });

  it('POST /users creates a user with UUID', async () => {
    const res = await request('POST', '/users', { name: 'Alice', email: 'alice@test.com' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Alice');
    expect(res.body.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  it('GET /pets supports query params and returns a paginated array (spec says `type: array`)', async () => {
    await request('POST', '/pets', { name: 'Rex', tag: 'dog' });
    await request('POST', '/pets', { name: 'Whiskers', tag: 'cat' });
    await request('POST', '/pets', { name: 'Buddy', tag: 'dog' });
    const res = await request('GET', '/pets?tag=dog&limit=1');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].tag).toBe('dog');
  });

  it('returns 404 for non-CRUD paths', async () => {
    const res = await request('GET', '/nonexistent');
    expect(res.status).toBe(404);
  });

  it('can disable one CRUD operation via operations.<key>.enabled = false', async () => {
    const disabledApp = await createApp({
      specPath: join(FIXTURES, 'petstore.yaml'),
      dataDir: TEST_DIR,
      resources: {},
      operations: { createPet: { enabled: false } },
    });
    const { default: supertest } = await import('supertest');
    const res = await supertest(disabledApp).post('/pets').send({ name: 'Rex' });
    expect(res.status).toBe(404);
  });
});

describe('list response shape follows the spec', () => {
  it('wraps items+total when the response schema is an object', async () => {
    const { mkdirSync, rmSync } = await import('node:fs');
    const WRAP_DIR = join(import.meta.dirname, '..', 'tmp-wrapped-list');
    rmSync(WRAP_DIR, { recursive: true, force: true });
    mkdirSync(WRAP_DIR, { recursive: true });
    const wrappedApp = await createApp({
      specPath: join(FIXTURES, 'petstore-wrapped-list.yaml'),
      dataDir: WRAP_DIR,
      resources: {},
    });
    const { default: supertest } = await import('supertest');
    await supertest(wrappedApp).post('/pets').send({ name: 'Rex' }).set('Content-Type', 'application/json');
    await supertest(wrappedApp).post('/pets').send({ name: 'Buddy' }).set('Content-Type', 'application/json');
    const res = await supertest(wrappedApp).get('/pets');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(false);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.total).toBe(2);
    rmSync(WRAP_DIR, { recursive: true, force: true });
  });
});

describe('seeding', () => {
  it('seeds data when seed option is provided', async () => {
    const { mkdirSync, rmSync } = await import('node:fs');
    const TEST_DIR = join(import.meta.dirname, '..', 'tmp-seed-integration');
    rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(TEST_DIR, { recursive: true });
    const seededApp = await createApp({
      specPath: join(FIXTURES, 'petstore.yaml'),
      dataDir: TEST_DIR,
      resources: {},
      seed: 5,
    });
    const { default: supertest } = await import('supertest');
    const res = await supertest(seededApp).get('/pets');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(5);
    rmSync(TEST_DIR, { recursive: true, force: true });
  });
});
