export function buildHandlerResourceHelpers(engines) {
  return {
    get: async (resourceName, id) => engines.get(resourceName).engine.getById(id),
    list: async (resourceName, query = {}) => engines.get(resourceName).engine.list(query),
    create: async (resourceName, body) => engines.get(resourceName).engine.create(body),
    update: async (resourceName, id, body) => engines.get(resourceName).engine.update(id, body),
    patch: async (resourceName, id, body) => engines.get(resourceName).engine.patch(id, body),
    delete: async (resourceName, id) => engines.get(resourceName).engine.delete(id),
  };
}
