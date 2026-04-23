import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { loadSpec } from '../../src/openapi/loadSpec.js';

const FIXTURES = join(import.meta.dirname, '..', 'fixtures');

describe('loadSpec', () => {
  it('loads a valid OpenAPI 3.0 spec', async () => {
    const spec = await loadSpec(join(FIXTURES, 'petstore.yaml'));
    expect(spec.openapi).toBe('3.0.3');
    expect(spec.paths).toBeDefined();
    expect(spec.paths['/pets']).toBeDefined();
    expect(spec.paths['/pets/{petId}']).toBeDefined();
  });

  it('dereferences $ref', async () => {
    const spec = await loadSpec(join(FIXTURES, 'petstore.yaml'));
    const petSchema =
      spec.paths['/pets'].post.requestBody.content['application/json'].schema;
    expect(petSchema.properties).toBeDefined();
  });

  it('throws for missing file', async () => {
    await expect(loadSpec(join(FIXTURES, 'nonexistent.yaml'))).rejects.toThrow();
  });

  it('throws for non-OpenAPI-3 document', async () => {
    const { writeFileSync, mkdirSync, rmSync } = await import('node:fs');
    const tmpDir = join(import.meta.dirname, '..', 'tmp-loadspec');
    mkdirSync(tmpDir, { recursive: true });
    const tmpFile = join(tmpDir, 'swagger2.yaml');
    writeFileSync(tmpFile, 'swagger: "2.0"\ninfo:\n  title: Test\n  version: "1.0"\npaths: {}\n');
    try {
      await expect(loadSpec(tmpFile)).rejects.toThrow('OpenAPI 3');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
