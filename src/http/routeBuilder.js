const METHOD_MAP = {
  list: { method: 'GET', target: 'collection' },
  getById: { method: 'GET', target: 'item' },
  create: { method: 'POST', target: 'collection' },
  update: { method: 'PUT', target: 'item' },
  patch: { method: 'PATCH', target: 'item' },
  delete: { method: 'DELETE', target: 'item' },
};

function toExpressPath(openApiPath) {
  return openApiPath.replace(/\{([^}]+)\}/g, ':$1');
}

export function buildRoutes(resources) {
  const routes = [];

  for (const resource of resources) {
    for (const operation of resource.methods) {
      const mapping = METHOD_MAP[operation];
      if (!mapping) continue;

      const path =
        mapping.target === 'collection'
          ? resource.collectionPath
          : toExpressPath(resource.itemPath);

      routes.push({
        method: mapping.method,
        path,
        operation,
        resourceName: resource.name,
      });
    }
  }

  return routes;
}
