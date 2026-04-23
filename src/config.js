export function loadConfig(args) {
  if (!args.config) {
    return {
      specPath: args.specPath,
      port: args.port ?? 3000,
      dataDir: args.dataDir ?? './data',
      seed: args.seed ?? undefined,
      seedPerResource: {},
      resources: {},
    };
  }

  return (async () => {
    const { default: fileConfig } = await import(args.config);

    return {
      specPath: args.specPath,
      port: args.port ?? fileConfig.port ?? 3000,
      dataDir: args.dataDir ?? fileConfig.dataDir ?? './data',
      seed: args.seed ?? fileConfig.seed?.count ?? undefined,
      seedPerResource: fileConfig.seed?.resources ?? {},
      resources: fileConfig.resources ?? {},
    };
  })();
}
