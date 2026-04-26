const CRUD_ROUTE_MAP = {
  list: { method: 'GET', path: 'collection' },
  getById: { method: 'GET', path: 'item' },
  create: { method: 'POST', path: 'collection' },
  update: { method: 'PUT', path: 'item' },
  patch: { method: 'PATCH', path: 'item' },
  delete: { method: 'DELETE', path: 'item' },
};

const DEFAULT_OPERATION_CONFIG = {
  enabled: true,
  mode: 'auto',
  querySensitive: false,
};

function resolveOperationConfig(operation, operationsConfig = {}) {
  const byOperationId = operation.operationId ? operationsConfig[operation.operationId] : undefined;
  const byKey = operationsConfig[operation.key];

  if (byOperationId && byKey) {
    throw new Error(
      `Operation config collision for "${operation.key}". Configure either "${operation.operationId}" or "${operation.key}", not both.`
    );
  }

  return {
    ...DEFAULT_OPERATION_CONFIG,
    ...(byOperationId ?? byKey ?? {}),
  };
}

function getCrudClaim(operation, resources) {
  for (const resource of resources) {
    for (const crudOperation of resource.methods) {
      const route = CRUD_ROUTE_MAP[crudOperation];
      if (!route) continue;

      const openApiPath =
        route.path === 'collection' ? resource.collectionPath : resource.itemPath;

      if (operation.key === `${route.method} ${openApiPath}`) {
        return { crudOperation, resource };
      }
    }
  }

  return null;
}

function extractCanonicalResponseSchema(operation) {
  if (operation.canonicalResponse?.schema) return operation.canonicalResponse.schema;

  const status = operation.canonicalResponse?.status;
  const contentType = operation.canonicalResponse?.contentType;
  if (!status || !contentType) return null;

  return operation.operation.responses?.[String(status)]?.content?.[contentType]?.schema ?? null;
}

function isObjectShapedSchema(schema) {
  return schema?.type === 'object' && typeof schema.properties === 'object' && schema.properties !== null;
}

function isArrayShapedSchema(schema) {
  return schema?.type === 'array' && !!schema.items;
}

function areSchemasCompatible(projectedSchema, resourceSchema) {
  if (!projectedSchema || !resourceSchema) return false;

  const projectedType = projectedSchema.type;
  const resourceType = resourceSchema.type;

  if (projectedType && resourceType && projectedType !== resourceType) return false;

  if (projectedType === 'object' || resourceType === 'object') {
    if (!isObjectShapedSchema(projectedSchema) || !isObjectShapedSchema(resourceSchema)) {
      return false;
    }

    return isProjectionSubset(projectedSchema, resourceSchema);
  }

  if (projectedType === 'array' || resourceType === 'array') {
    if (!isArrayShapedSchema(projectedSchema) || !isArrayShapedSchema(resourceSchema)) {
      return false;
    }

    return areSchemasCompatible(projectedSchema.items, resourceSchema.items);
  }

  if (!projectedType || !resourceType) return true;
  return projectedType === resourceType;
}

function isProjectionSubset(responseSchema, resourceSchema) {
  if (!isObjectShapedSchema(responseSchema) || !isObjectShapedSchema(resourceSchema)) {
    return false;
  }

  const responseProperties = responseSchema.properties ?? {};
  const resourceProperties = resourceSchema.properties ?? {};

  return Object.entries(responseProperties).every(([propertyName, propertySchema]) => {
    const resourceProperty = resourceProperties[propertyName];
    return resourceProperty && areSchemasCompatible(propertySchema, resourceProperty);
  });
}

function getProjectionCandidate(operation, resources) {
  for (const resource of resources) {
    if (!operation.openApiPath.startsWith(`${resource.itemPath}/`)) continue;
    if (!resource.idParam || !operation.pathParams.includes(resource.idParam)) continue;

    const responseSchema = extractCanonicalResponseSchema(operation);
    if (!isObjectShapedSchema(responseSchema)) {
      return { resource, projectionEligible: false };
    }

    if (!isObjectShapedSchema(resource.schema)) {
      return { resource, projectionEligible: false };
    }

    return {
      resource,
      projectionEligible: isProjectionSubset(responseSchema, resource.schema),
    };
  }

  return { resource: null, projectionEligible: false };
}

export function buildOperationRegistry(
  operations,
  resources,
  operationsConfig = {},
  options = {}
) {
  const warn = options.warn ?? console.warn;
  const registry = [];

  for (const operation of operations) {
    const operationConfig = resolveOperationConfig(operation, operationsConfig);
    if (operationConfig.enabled === false) continue;

    const crudClaim = getCrudClaim(operation, resources);
    const projection = crudClaim ? { resource: null, projectionEligible: false } : getProjectionCandidate(operation, resources);

    const routeKind = crudClaim ? 'resource' : 'operation-state';
    const projectionEligible = crudClaim ? false : projection.projectionEligible;
    const resource = crudClaim?.resource ?? projection.resource ?? null;
    const crudOperation = crudClaim?.crudOperation ?? null;

    if (!crudClaim && operationConfig.mode === 'resource-aware' && !projectionEligible) {
      warn(
        `resource-aware mode for "${operation.key}" failed build-time projection checks and was downgraded to operation-state.`
      );
    }

    registry.push({
      method: operation.method,
      path: operation.expressPath,
      routeKind,
      crudOperation,
      operation,
      resource,
      operationConfig,
      projectionEligible,
    });
  }

  return registry;
}
