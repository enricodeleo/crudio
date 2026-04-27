import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export class StartupConfigurationError extends Error {
  constructor(message, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = 'StartupConfigurationError';
    this.status = 500;
  }
}

export async function loadCustomHandler(handlerConfig, baseDir) {
  if (handlerConfig === undefined || handlerConfig === null) {
    return null;
  }

  if (typeof handlerConfig === 'function') {
    return handlerConfig;
  }

  if (typeof handlerConfig !== 'string') {
    throw new StartupConfigurationError(
      'Custom handler config must be a function or module path string.'
    );
  }

  const resolvedPath = isAbsolute(handlerConfig) ? handlerConfig : resolve(baseDir, handlerConfig);

  let moduleNamespace;
  try {
    moduleNamespace = await import(pathToFileURL(resolvedPath).href);
  } catch (cause) {
    throw new StartupConfigurationError(
      `Failed to import custom handler module "${resolvedPath}".`,
      cause
    );
  }

  if (typeof moduleNamespace.default !== 'function') {
    throw new StartupConfigurationError(
      `Custom handler module "${resolvedPath}" must export a default function.`
    );
  }

  return moduleNamespace.default;
}
