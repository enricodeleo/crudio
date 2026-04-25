function normalizeResourceConfig(resourceConfig = {}) {
  return Object.fromEntries(
    Object.entries(resourceConfig).map(([resourceName, config]) => [
      resourceName,
      {
        ...config,
        foreignKeys: config.foreignKeys ?? {},
        seed: {
          ...(config.seed ?? {}),
          count: config.seed?.count,
        },
      },
    ])
  );
}

function normalizeOperationConfig(operationConfig = {}) {
  return Object.fromEntries(
    Object.entries(operationConfig).map(([key, config]) => [
      key,
      {
        ...config,
        enabled: config.enabled ?? true,
      },
    ])
  );
}

export async function loadConfig(args) {
  const fileConfig = args.config ? (await import(args.config)).default : {};

  return {
    specPath: args.specPath,
    port: args.port ?? fileConfig.port ?? 3000,
    dataDir: args.dataDir ?? fileConfig.dataDir ?? './data',
    seed: {
      strategy: fileConfig.seed?.strategy ?? 'config-first',
      count: args.seed ?? fileConfig.seed?.count,
    },
    resources: normalizeResourceConfig(fileConfig.resources ?? {}),
    operations: normalizeOperationConfig(fileConfig.operations ?? {}),
    validateResponses: fileConfig.validateResponses ?? 'warn',
  };
}
