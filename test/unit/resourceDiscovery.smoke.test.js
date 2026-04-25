import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { loadSpec } from '../../src/openapi/loadSpec.js';
import { discoverResources } from '../../src/openapi/resourceDiscovery.js';

const FIXTURES = join(import.meta.dirname, '..', 'fixtures');

describe('resourceDiscovery smoke', () => {
  it('still discovers the pets CRUD resource used by app boot today', async () => {
    const spec = await loadSpec(join(FIXTURES, 'petstore.yaml'));
    const resources = discoverResources(spec);

    expect(resources.find((resource) => resource.name === 'pets')).toMatchObject({
      name: 'pets',
      collectionPath: '/pets',
      itemPath: '/pets/{petId}',
      idParam: 'petId',
    });
  });
});
