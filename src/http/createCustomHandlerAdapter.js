import { assertValidDescriptor, json } from './responseDescriptor.js';

export function createCustomHandlerAdapter({
  operation,
  customHandler,
  defaultExecutor,
  requestValidator,
  responseValidator,
  resources,
  stateFactory,
  storage,
}) {
  return async ({ req }) => {
    if (requestValidator) {
      requestValidator(req.body);
    }

    let defaultExecution = null;

    if (!customHandler) {
      defaultExecution = await defaultExecutor({ req });
      const descriptor = defaultExecution.descriptor;
      if (responseValidator) {
        responseValidator(descriptor.body);
      }
      await defaultExecution.commit?.(descriptor);
      return descriptor;
    }

    let consumed = false;
    const state = stateFactory ? stateFactory(req) : undefined;
    const ctx = {
      operation,
      req,
      state,
      resources,
      storage,
      json,
      nextDefault: async () => {
        if (consumed) {
          throw new Error(`nextDefault() already used for "${operation?.key ?? 'unknown operation'}".`);
        }
        consumed = true;
        defaultExecution = await defaultExecutor({ req });
        return defaultExecution.descriptor;
      },
    };

    const descriptor = assertValidDescriptor(await customHandler(ctx));
    if (responseValidator) {
      responseValidator(descriptor.body);
    }
    if (consumed) {
      await defaultExecution.commit?.(descriptor);
    }
    return descriptor;
  };
}
