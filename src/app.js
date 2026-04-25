import express from 'express';
import { loadSpec } from './openapi/loadSpec.js';
import { compileOperations } from './openapi/compileOperations.js';
import { inferResources } from './openapi/inferResources.js';
import { normalize } from './openapi/schemaResolver.js';
import { buildOperationRegistry } from './http/buildOperationRegistry.js';
import { createOperationHandler } from './http/createOperationHandler.js';
import { createValidators } from './http/validators.js';
import { CrudEngine } from './engine/crudEngine.js';
import { IdStrategy } from './engine/idStrategy.js';
import { JsonStateStore } from './storage/jsonStateStore.js';
import { seedAll } from './seed/seedEngine.js';

export async function createApp({
  specPath,
  dataDir,
  resources: resourceConfig,
  operations: operationConfig = {},
  seed,
  seedPerResource,
}) {
  const effectiveResourceConfig = mergeResourceConfig(resourceConfig, seedPerResource);
  const spec = await loadSpec(specPath);
  const operations = compileOperations(spec);
  const inferredResources = inferResources(operations);
  const storage = new JsonStateStore(dataDir);

  await storage.writeRegistry({
    operations: operations.map(({ key, method, openApiPath, operationId }) => ({
      key,
      method,
      openApiPath,
      operationId,
    })),
  });

  const engines = new Map();
  const validators = new Map();

  for (const resource of inferredResources) {
    const normalizedSchema = normalize(resource.schema, resource.name);
    const idSchema = resource.idSchema ?? null;

    const engine = new CrudEngine(
      storage,
      new IdStrategy(idSchema),
      normalizedSchema,
      resource.name
    );
    engines.set(resource.name, { engine, resource });

    validators.set(resource.name, createValidators(normalizedSchema));
  }

  if (shouldSeed(seed, effectiveResourceConfig)) {
    const normalizedResources = inferredResources.map((r) => ({
      ...r,
      schema: normalize(r.schema, r.name),
    }));
    const engineMap = new Map(
      inferredResources.map((r) => [r.name, engines.get(r.name).engine])
    );
    await seedAll(normalizedResources, engineMap, { count: seed }, effectiveResourceConfig);
  }

  const routes = buildOperationRegistry(operations, inferredResources, operationConfig);
  const app = express();

  app.use(express.json());

  app.get('/_crudio/health', (req, res) => {
    res.json({ status: 'ok', resources: inferredResources.map((r) => r.name) });
  });

  for (const route of routes) {
    const { engine } = engines.get(route.resource.name);
    const v = validators.get(route.resource.name);
    const handler = createOperationHandler({
      operation: route.operation,
      crudOperation: route.crudOperation,
      resource: route.resource,
      engine,
      validators: v,
    });
    app[route.method.toLowerCase()](route.path, handler);
  }

  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use((err, req, res, _next) => {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

function mergeResourceConfig(resourceConfig = {}, seedPerResource = {}) {
  const merged = { ...resourceConfig };

  for (const [resourceName, count] of Object.entries(seedPerResource ?? {})) {
    merged[resourceName] = {
      ...(merged[resourceName] ?? {}),
      seed: {
        ...(merged[resourceName]?.seed ?? {}),
        count: merged[resourceName]?.seed?.count ?? count,
      },
    };
  }

  return merged;
}

function shouldSeed(seed, resourceConfig = {}) {
  if (seed !== undefined) return true;
  return Object.values(resourceConfig).some((config) => config?.seed?.count !== undefined);
}
