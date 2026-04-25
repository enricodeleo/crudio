import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { loadSpec } from '../../src/openapi/loadSpec.js';
import { compileOperations } from '../../src/openapi/compileOperations.js';

const FIXTURES = join(import.meta.dirname, '..', 'fixtures');

describe('compileOperations', () => {
  it('compiles petstore CRUD endpoints into operation definitions', async () => {
    const spec = await loadSpec(join(FIXTURES, 'petstore.yaml'));
    const operations = compileOperations(spec);

    expect(operations.find((op) => op.operationId === 'createPet')).toMatchObject({
      key: 'POST /pets',
      method: 'POST',
      openApiPath: '/pets',
      expressPath: '/pets',
      canonicalResponse: { status: 201, contentType: 'application/json' },
    });

    expect(operations.find((op) => op.operationId === 'getPetById')).toMatchObject({
      key: 'GET /pets/{petId}',
      expressPath: '/pets/:petId',
      pathParams: ['petId'],
    });
  });
});
