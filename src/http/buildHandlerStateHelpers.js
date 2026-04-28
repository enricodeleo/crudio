export function buildHandlerStateHelpers(storage, operationKey, scopeKey) {
  return {
    get: async () => (await storage.readOperationState(operationKey, scopeKey))?.body ?? null,
    setDescriptor: async (descriptor) =>
      storage.writeOperationState(operationKey, scopeKey, {
        status: descriptor.status,
        body: descriptor.body,
        headers: descriptor.headers ?? {},
      }),
    set: async (body, options = {}) =>
      storage.writeOperationState(operationKey, scopeKey, {
        status: options.status ?? 200,
        body,
        headers: options.headers ?? {},
      }),
    delete: async () => storage.deleteOperationState(operationKey, scopeKey),
    getDefault: async () => (await storage.readOperationDefaultState(operationKey))?.body ?? null,
    setDefault: async (body, options = {}) =>
      storage.writeOperationDefaultState(operationKey, {
        status: options.status ?? 200,
        body,
        headers: options.headers ?? {},
      }),
  };
}
