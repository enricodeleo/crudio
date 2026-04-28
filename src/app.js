import express from 'express';
import { loadSpec } from './openapi/loadSpec.js';
import { compileOperations } from './openapi/compileOperations.js';
import { inferResources } from './openapi/inferResources.js';
import { normalize } from './openapi/schemaResolver.js';
import { buildOperationRegistry } from './http/buildOperationRegistry.js';
import { buildScopeKey } from './operations/scopeKey.js';
import { buildHandlerResourceHelpers } from './http/buildHandlerResourceHelpers.js';
import { buildHandlerStateHelpers } from './http/buildHandlerStateHelpers.js';
import { createCustomHandlerAdapter } from './http/createCustomHandlerAdapter.js';
import { executeCrudOperation } from './http/executeCrudOperation.js';
import { executeOperationStateOperation } from './http/executeOperationStateOperation.js';
import { loadCustomHandler } from './http/loadCustomHandler.js';
import {
  createOperationRequestValidator,
  createOperationResponseValidator,
  createValidators,
} from './http/validators.js';
import { sendDescriptor } from './http/responseDescriptor.js';
import { CrudEngine } from './engine/crudEngine.js';
import { IdStrategy } from './engine/idStrategy.js';
import { JsonStateStore } from './storage/jsonStateStore.js';
import { seedOperationState } from './seed/operationSeedEngine.js';
import { seedAll } from './seed/seedEngine.js';

export async function createApp({
  specPath,
  dataDir,
  resources: resourceConfig,
  operations: operationConfig = {},
  seed,
  seedPerResource,
  handlerBaseDir = process.cwd(),
  validateResponses = 'warn',
}) {
  const effectiveResourceConfig = mergeResourceConfig(resourceConfig, seedPerResource);
  const spec = await loadSpec(specPath);
  const operations = compileOperations(spec);
  const inferredResources = inferResources(operations);
  const crudResources = inferredResources.filter(isCrudResource);
  const storage = new JsonStateStore(dataDir);
  const routes = buildOperationRegistry(operations, crudResources, operationConfig);

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

  for (const resource of crudResources) {
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
    const normalizedResources = crudResources.map((r) => ({
      ...r,
      schema: normalize(r.schema, r.name),
    }));
    const engineMap = new Map(
      crudResources.map((r) => [r.name, engines.get(r.name).engine])
    );
    await seedAll(normalizedResources, engineMap, { count: seed }, effectiveResourceConfig);
  }

  const resources = buildHandlerResourceHelpers(engines);

  await seedOperationState({
    registry: routes,
    storage,
  });

  const app = express();

  app.use(express.json());

  app.get('/_crudio/health', (req, res) => {
    res.json({ status: 'ok', resources: crudResources.map((r) => r.name) });
  });

  for (const route of routes) {
    const customHandler = await loadCustomHandler(route.operationConfig.handler, handlerBaseDir);
    const requestValidator =
      route.routeKind === 'resource'
        ? createOperationRequestValidator({
            routeKind: route.routeKind,
            crudOperation: route.crudOperation,
            validators: validators.get(route.resource.name),
          })
        : null;
    const responseValidator = createOperationResponseValidator(route.operation, validateResponses);
    const defaultExecutor = ({ req }) =>
      route.routeKind === 'resource'
        ? executeCrudOperation({
            operation: route.operation,
            crudOperation: route.crudOperation,
            resource: route.resource,
            engine: engines.get(route.resource.name).engine,
            validators: validators.get(route.resource.name),
            req,
          })
        : executeOperationStateOperation({
            operation: route.operation,
            storage,
            operationConfig: route.operationConfig,
            projectionEligible: route.projectionEligible,
            resource: route.resource,
            req,
          });

    const execute = createCustomHandlerAdapter({
      operation: route.operation,
      operationConfig: route.operationConfig,
      declarativeRules: route.operationConfig.rules,
      customHandler,
      defaultExecutor,
      requestValidator,
      responseValidator,
      resources,
      resourceCurrentFactory: route.resource
        ? (req) => resources.getLinked(route.resource, req.params)
        : undefined,
      stateFactory: (req) =>
        buildHandlerStateHelpers(
          storage,
          route.operation.key,
          buildScopeKey(
            route.operationConfig.querySensitive ? { ...req.params, ...req.query } : { ...req.params }
          )
        ),
      storage,
    });

    app[route.method.toLowerCase()](route.path, async (req, res, next) => {
      try {
        const descriptor = await execute({
          req: {
            params: req.params,
            query: req.query,
            body: req.body,
            headers: req.headers,
          },
        });
        return sendDescriptor(res, descriptor);
      } catch (err) {
        next(err);
      }
    });
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

function isCrudResource(resource) {
  return resource.collectionPath !== resource.itemPath;
}
