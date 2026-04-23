import express from 'express';
import { loadSpec } from './openapi/loadSpec.js';
import { discoverResources } from './openapi/resourceDiscovery.js';
import { normalize } from './openapi/schemaResolver.js';
import { buildRoutes } from './http/routeBuilder.js';
import { createValidators } from './http/validators.js';
import { CrudEngine } from './engine/crudEngine.js';
import { IdStrategy } from './engine/idStrategy.js';
import { JsonFileAdapter } from './storage/jsonFileAdapter.js';
import { seedResource } from './seed/seedEngine.js';

export async function createApp({ specPath, dataDir, resources: resourceConfig, seed, seedPerResource }) {
  const spec = await loadSpec(specPath);
  const discovered = discoverResources(spec, resourceConfig);
  const storage = new JsonFileAdapter(dataDir);

  const engines = new Map();
  const validators = new Map();

  for (const resource of discovered) {
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

  if (seed) {
    for (const resource of discovered) {
      const count = seedPerResource?.[resource.name] ?? seed;
      const engine = engines.get(resource.name).engine;
      const normalizedSchema = normalize(resource.schema, resource.name);
      await seedResource(engine, normalizedSchema, count);
    }
  }

  const routes = buildRoutes(discovered);
  const app = express();

  app.use(express.json());

  app.get('/_crudio/health', (req, res) => {
    res.json({ status: 'ok', resources: discovered.map((r) => r.name) });
  });

  for (const route of routes) {
    const { engine, resource } = engines.get(route.resourceName);
    const v = validators.get(route.resourceName);
    const idParam = resource.idParam;

    const handler = createHandler(route.operation, engine, v, idParam, route.resourceName);
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

function createHandler(operation, engine, validators, idParam, resourceName) {
  switch (operation) {
    case 'list':
      return async (req, res, next) => {
        try {
          const query = validators.parseQuery(req.query);
          const result = await engine.list(query);
          res.json(result);
        } catch (err) {
          next(err);
        }
      };

    case 'getById':
      return async (req, res, next) => {
        try {
          const item = await engine.getById(req.params[idParam]);
          if (!item) return res.status(404).json({ error: `Resource ${resourceName} with id ${req.params[idParam]} not found` });
          res.json(item);
        } catch (err) {
          next(err);
        }
      };

    case 'create':
      return async (req, res, next) => {
        try {
          const validation = validators.validateCreate(req.body);
          if (!validation.valid) {
            return res.status(400).json({ error: 'Validation failed', details: validation.errors });
          }
          const item = await engine.create(req.body);
          res.status(201).json(item);
        } catch (err) {
          next(err);
        }
      };

    case 'update':
      return async (req, res, next) => {
        try {
          const validation = validators.validateBody(req.body);
          if (!validation.valid) {
            return res.status(400).json({ error: 'Validation failed', details: validation.errors });
          }
          const item = await engine.update(req.params[idParam], req.body);
          if (!item) return res.status(404).json({ error: `Resource ${resourceName} with id ${req.params[idParam]} not found` });
          res.json(item);
        } catch (err) {
          next(err);
        }
      };

    case 'patch':
      return async (req, res, next) => {
        try {
          const validation = validators.validatePatch(req.body);
          if (!validation.valid) {
            return res.status(400).json({ error: 'Validation failed', details: validation.errors });
          }
          const item = await engine.patch(req.params[idParam], req.body);
          if (!item) return res.status(404).json({ error: `Resource ${resourceName} with id ${req.params[idParam]} not found` });
          res.json(item);
        } catch (err) {
          next(err);
        }
      };

    case 'delete':
      return async (req, res, next) => {
        try {
          const deleted = await engine.delete(req.params[idParam]);
          if (!deleted) return res.status(404).json({ error: `Resource ${resourceName} with id ${req.params[idParam]} not found` });
          res.status(204).end();
        } catch (err) {
          next(err);
        }
      };

    default:
      return (req, res) => res.status(405).json({ error: 'Method not allowed' });
  }
}
