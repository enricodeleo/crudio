import { dirname, isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { normalizeDeclarativeRules } from './http/normalizeDeclarativeRules.js';

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
        mode: config.mode ?? 'auto',
        querySensitive: config.querySensitive ?? false,
        responseFake: config.responseFake,
        rules: normalizeDeclarativeRules(config.rules),
        seed: {
          default: config.seed?.default,
          scopes: config.seed?.scopes ?? {},
        },
      },
    ])
  );
}

export async function loadConfig(args) {
  const resolvedConfigPath = args.config
    ? isAbsolute(args.config)
      ? args.config
      : resolve(process.cwd(), args.config)
    : null;
  const fileConfig = resolvedConfigPath
    ? (await import(pathToFileURL(resolvedConfigPath).href)).default
    : {};

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
    responseFake: fileConfig.responseFake ?? 'auto',
    handlerBaseDir: resolvedConfigPath ? dirname(resolvedConfigPath) : process.cwd(),
  };
}
