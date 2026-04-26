function hasSeed(seed = {}) {
  return seed.default !== undefined || Object.keys(seed.scopes ?? {}).length > 0;
}

function buildState(operation, body) {
  return {
    status: operation.canonicalResponse?.status ?? 200,
    body,
    headers: {},
  };
}

export async function seedOperationState({ registry = [], storage, warn = console.warn }) {
  for (const route of registry) {
    const seed = route.operationConfig?.seed ?? {};
    if (!hasSeed(seed)) continue;

    if (route.routeKind === 'resource') {
      warn(`Operation seed for CRUD-claimed route "${route.operation.key}" was skipped.`);
      continue;
    }

    if (seed.default !== undefined) {
      await storage.writeOperationDefaultState(
        route.operation.key,
        buildState(route.operation, seed.default)
      );
    }

    for (const [scopeKey, body] of Object.entries(seed.scopes ?? {})) {
      await storage.writeOperationState(
        route.operation.key,
        scopeKey,
        buildState(route.operation, body)
      );
    }
  }
}
