import { executeDeclarativeRuleSet } from './executeDeclarativeRuleSet.js';
import { CrudioError } from './errors.js';
import { assertValidDescriptor, json } from './responseDescriptor.js';

export function createCustomHandlerAdapter({
  operation,
  declarativeRules,
  customHandler,
  defaultExecutor,
  requestValidator,
  responseValidator,
  resource,
  resources,
  resourceCurrentFactory,
  stateFactory,
  storage,
}) {
  return async ({ req }) => {
    if (requestValidator) {
      requestValidator(req.body);
    }

    const state = stateFactory ? stateFactory(req) : undefined;
    const runDefault = async () => {
      const defaultExecution = await defaultExecutor({ req });
      const descriptor = defaultExecution.descriptor;
      if (responseValidator) {
        responseValidator(descriptor.body);
      }
      await defaultExecution.commit?.(descriptor);
      return descriptor;
    };

    if (declarativeRules?.length) {
      const resourceCurrent = resourceCurrentFactory ? await resourceCurrentFactory(req) : null;
      const ruleExecution = await executeDeclarativeRuleSet({
        operation,
        rules: declarativeRules,
        req,
        state,
        resource,
        resources,
        resourceCurrent,
      });

      if (ruleExecution.matched) {
        const descriptor = ruleExecution.descriptor;
        if (responseValidator) {
          responseValidator(descriptor.body);
        }
        await ruleExecution.commit?.(descriptor);
        return descriptor;
      }

      if (customHandler) {
        throw new CrudioError(
          `Declarative rules and handler both configured for "${operation?.key ?? 'unknown operation'}", but no rule matched.`
        );
      }

      return runDefault();
    }

    let defaultExecution = null;

    if (!customHandler) {
      return runDefault();
    }

    let consumed = false;
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
