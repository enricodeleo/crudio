import { dereference } from '@readme/openapi-parser';

export async function loadSpec(specPath) {
  const spec = await dereference(specPath);

  if (!spec.openapi || !spec.openapi.startsWith('3.')) {
    throw new Error(
      `Unsupported spec version: expected OpenAPI 3.x, got "${spec.openapi || spec.swagger || 'unknown'}". ` +
        `Crudio v1 only supports OpenAPI 3.0 and 3.1.`
    );
  }

  return spec;
}
