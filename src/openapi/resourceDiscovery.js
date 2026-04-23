import { normalize } from './schemaResolver.js';

const ITEM_PATH_RE = /^\/(.+)\/\{([^}]+)\}$/;

function extractSchema(operation, direction) {
  if (direction === 'request') {
    const content = operation.requestBody?.content?.['application/json'];
    return content?.schema ?? null;
  }
  const response200 = operation.responses?.['200'];
  const content = response200?.content?.['application/json'];
  return content?.schema ?? null;
}

function extractMethods(collectionOps, itemOps) {
  const methods = [];
  if (collectionOps.get) methods.push('list');
  if (collectionOps.post) methods.push('create');
  if (itemOps.get) methods.push('getById');
  if (itemOps.put) methods.push('update');
  if (itemOps.patch) methods.push('patch');
  if (itemOps.delete) methods.push('delete');
  return methods;
}

function extractIdParam(pathStr) {
  const match = pathStr.match(ITEM_PATH_RE);
  return match ? match[2] : null;
}

export function discoverResources(spec, resourceConfig = {}) {
  const paths = spec.paths ?? {};
  const resources = [];

  const candidates = new Map();

  for (const [pathStr, pathObj] of Object.entries(paths)) {
    const itemMatch = pathStr.match(ITEM_PATH_RE);
    if (itemMatch) {
      const collectionPath = `/${itemMatch[1]}`;
      if (!candidates.has(collectionPath)) {
        candidates.set(collectionPath, { collectionOps: null, itemPath: pathStr, itemOps: null });
      }
      const entry = candidates.get(collectionPath);
      entry.itemPath = pathStr;
      entry.itemOps = pathObj;
    } else if (!pathStr.includes('{')) {
      if (!candidates.has(pathStr)) {
        candidates.set(pathStr, { collectionOps: null, itemPath: null, itemOps: null });
      }
      candidates.get(pathStr).collectionOps = pathObj;
    }
  }

  for (const [collectionPath, { collectionOps, itemPath, itemOps }] of candidates) {
    if (!collectionOps || !itemPath || !itemOps) continue;

    const segments = collectionPath.split('/');
    const name = segments[segments.length - 1];
    const idParam = extractIdParam(itemPath);

    const config = resourceConfig[name];
    if (config?.exclude) continue;

    const methods = extractMethods(collectionOps, itemOps);
    const finalMethods = config?.methods ?? methods;

    const schema =
      normalize(extractSchema(itemOps.get, 'response'), name) ??
      normalize(extractSchema(collectionOps.get, 'response'), name) ??
      normalize(extractSchema(collectionOps.post, 'request'), name) ??
      { type: 'object', properties: {} };

    const itemPathParams = itemOps.get?.parameters ?? itemOps.delete?.parameters ?? [];
    const idParamObj = itemPathParams.find((p) => p.name === idParam);
    const idSchema = idParamObj?.schema ?? null;

    resources.push({
      name,
      collectionPath,
      itemPath,
      idParam,
      idSchema,
      schema,
      methods: finalMethods,
    });
  }

  return resources;
}
