import { normalize } from './schemaResolver.js';

function deriveResourceName(collectionPath) {
  return collectionPath.replace(/^\//, '').replace(/\//g, '-');
}

function getOperation(byKey, method, openApiPath) {
  return byKey.get(`${method} ${openApiPath}`) ?? null;
}

function isItemPath(openApiPath) {
  return /\{[^}]+\}$/.test(openApiPath);
}

function getCollectionPath(itemPath) {
  return itemPath.replace(/\/\{[^}]+\}$/, '');
}

function extractMethods(byKey, collectionPath, itemPath) {
  const methods = [];

  if (getOperation(byKey, 'GET', collectionPath)) methods.push('list');
  if (getOperation(byKey, 'POST', collectionPath)) methods.push('create');
  if (getOperation(byKey, 'GET', itemPath)) methods.push('getById');
  if (getOperation(byKey, 'PUT', itemPath)) methods.push('update');
  if (getOperation(byKey, 'PATCH', itemPath)) methods.push('patch');
  if (getOperation(byKey, 'DELETE', itemPath)) methods.push('delete');

  return methods;
}

function normalizeResourceSchema(schema, resourceName) {
  if (!schema) return null;

  let normalized = normalize(schema, resourceName) ?? { type: 'object', properties: {} };

  if (normalized.type === 'array' && normalized.items) {
    normalized = normalize(normalized.items, resourceName) ?? normalized;
  }

  return normalized;
}

function extractCanonicalResponseSchema(operation) {
  const status = operation?.canonicalResponse?.status;
  const contentType = operation?.canonicalResponse?.contentType;

  if (!status || !contentType) return null;

  return operation.operation.responses?.[String(status)]?.content?.[contentType]?.schema ?? null;
}

function extractResourceSchema(byKey, itemPath, resourceName) {
  return normalizeResourceSchema(
    extractCanonicalResponseSchema(getOperation(byKey, 'GET', itemPath)),
    resourceName
  );
}

function extractFallbackSchema(byKey, collectionPath, resourceName) {
  const listSchema = extractCanonicalResponseSchema(getOperation(byKey, 'GET', collectionPath));
  if (listSchema) {
    return normalizeResourceSchema(listSchema, resourceName);
  }

  const createSchema = getOperation(byKey, 'POST', collectionPath)?.requestBodySchema ?? null;
  return normalizeResourceSchema(createSchema, resourceName) ?? { type: 'object', properties: {} };
}

function extractIdSchema(byKey, itemPath, idParam) {
  const itemOperation =
    getOperation(byKey, 'GET', itemPath) ??
    getOperation(byKey, 'DELETE', itemPath) ??
    getOperation(byKey, 'PUT', itemPath) ??
    getOperation(byKey, 'PATCH', itemPath);

  return (
    itemOperation?.operation.parameters?.find(
      (parameter) => parameter.in === 'path' && parameter.name === idParam
    )?.schema ?? null
  );
}

function buildResourceFromPair(collectionPath, itemPath, byKey) {
  const itemOperation =
    getOperation(byKey, 'GET', itemPath) ??
    getOperation(byKey, 'DELETE', itemPath) ??
    getOperation(byKey, 'PUT', itemPath) ??
    getOperation(byKey, 'PATCH', itemPath);
  const idParam = itemOperation?.pathParams[0] ?? null;
  const name = deriveResourceName(collectionPath);

  const schema =
    extractResourceSchema(byKey, itemPath, name) ??
    extractFallbackSchema(byKey, collectionPath, name);

  return {
    name,
    collectionPath,
    itemPath,
    idParam,
    idSchema: extractIdSchema(byKey, itemPath, idParam),
    schema,
    methods: extractMethods(byKey, collectionPath, itemPath),
  };
}

export function inferResources(operations) {
  const byKey = new Map(operations.map((operation) => [operation.key, operation]));
  const resources = [];
  const nameToPath = new Map();
  const pairedPaths = new Set();

  for (const operation of operations) {
    const openApiPath = operation.openApiPath;
    if (pairedPaths.has(openApiPath) || isItemPath(openApiPath)) continue;

    const itemCandidate = operations.find(
      (candidate) =>
        candidate.pathParams.length === 1 &&
        getCollectionPath(candidate.openApiPath) === openApiPath
    );

    if (!itemCandidate) continue;

    const resource = buildResourceFromPair(openApiPath, itemCandidate.openApiPath, byKey);
    const existing = nameToPath.get(resource.name);

    if (existing && existing !== resource.collectionPath) {
      throw new Error(
        `Resource name collision: "${existing}" and "${resource.collectionPath}" both derive to "${resource.name}". ` +
          `Update the collection paths to disambiguate them.`
      );
    }

    nameToPath.set(resource.name, resource.collectionPath);
    pairedPaths.add(resource.collectionPath);
    resources.push(resource);
  }

  return resources;
}
