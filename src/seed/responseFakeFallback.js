import { extractResponseSchema } from '../openapi/extractResponseSchema.js';
import { generateFake } from './fakeGenerator.js';

function hasExplicitSeed(seed = {}) {
  return seed.default !== undefined || Object.keys(seed.scopes ?? {}).length > 0;
}

function isSchemaUsable(schema) {
  if (!schema || typeof schema !== 'object') return false;

  if (schema.type === 'object') {
    return Object.keys(schema.properties ?? {}).length > 0;
  }

  if (schema.type === 'array') {
    return isSchemaUsable(schema.items);
  }

  return Boolean(schema.type) || Array.isArray(schema.enum);
}

export async function seedResponseFakeFallback({
  registry = [],
  storage,
  defaultResponseFake = 'auto',
  warn = console.warn,
}) {
  for (const route of registry) {
    if (route.routeKind !== 'operation-state') continue;
    if (route.projectionEligible) continue;

    const effectiveResponseFake = route.operationConfig?.responseFake ?? defaultResponseFake;
    if (effectiveResponseFake === 'off') continue;

    if (hasExplicitSeed(route.operationConfig?.seed)) continue;

    const existingDefault = await storage.readOperationDefaultState(route.operation.key);
    if (existingDefault) continue;

    let schema;
    try {
      schema = extractResponseSchema(route.operation);
    } catch (err) {
      warn(
        `Response fake fallback skipped for "${route.operation.key}": ${err.message}`
      );
      continue;
    }

    if (!isSchemaUsable(schema)) continue;

    const body = generateFake(schema);
    if (body === null || body === undefined) continue;

    await storage.writeOperationDefaultState(route.operation.key, {
      status: route.operation.canonicalResponse?.status ?? 200,
      body,
      headers: {},
      origin: 'auto-fake',
    });
  }
}
