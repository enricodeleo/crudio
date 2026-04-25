const CRUD_ROUTE_MAP = {
  list: { method: 'GET', path: 'collection' },
  getById: { method: 'GET', path: 'item' },
  create: { method: 'POST', path: 'collection' },
  update: { method: 'PUT', path: 'item' },
  patch: { method: 'PATCH', path: 'item' },
  delete: { method: 'DELETE', path: 'item' },
};

function resolveOperationConfig(operation, operationsConfig = {}) {
  const byOperationId = operation.operationId ? operationsConfig[operation.operationId] : undefined;
  const byKey = operationsConfig[operation.key];

  if (byOperationId && byKey) {
    throw new Error(
      `Operation config collision for "${operation.key}". Configure either "${operation.operationId}" or "${operation.key}", not both.`
    );
  }

  return byOperationId ?? byKey ?? {};
}

export function buildOperationRegistry(operations, resources, operationsConfig = {}) {
  const byKey = new Map(operations.map((operation) => [operation.key, operation]));
  const registry = [];

  for (const resource of resources) {
    for (const crudOperation of resource.methods) {
      const route = CRUD_ROUTE_MAP[crudOperation];
      if (!route) continue;

      const openApiPath =
        route.path === 'collection' ? resource.collectionPath : resource.itemPath;
      const operation = byKey.get(`${route.method} ${openApiPath}`);
      if (!operation) continue;

      const operationConfig = resolveOperationConfig(operation, operationsConfig);
      if (operationConfig.enabled === false) continue;

      registry.push({
        method: operation.method,
        path: operation.expressPath,
        crudOperation,
        operation,
        resource,
      });
    }
  }

  return registry;
}
