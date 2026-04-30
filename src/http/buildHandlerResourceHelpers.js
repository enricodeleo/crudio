export function buildHandlerResourceHelpers(engines) {
  return {
    get: async (resourceName, id) => engines.get(resourceName).engine.getById(id),
    getLinked: async (resource, params = {}) => {
      if (!resource || !resource.name || !resource.idParam) return null;
      if (!(resource.idParam in params)) return null;
      return engines.get(resource.name).engine.getById(params[resource.idParam]);
    },
    patchLinked: async (resource, params = {}, body) => {
      if (!resource || !resource.name || !resource.idParam) return null;
      if (!(resource.idParam in params)) return null;
      return engines.get(resource.name).engine.patch(params[resource.idParam], body);
    },
    list: async (resourceName, query = {}) => engines.get(resourceName).engine.list(query),
    create: async (resourceName, body) => engines.get(resourceName).engine.create(body),
    update: async (resourceName, id, body) => engines.get(resourceName).engine.update(id, body),
    patch: async (resourceName, id, body) => engines.get(resourceName).engine.patch(id, body),
    delete: async (resourceName, id) => engines.get(resourceName).engine.delete(id),
  };
}
