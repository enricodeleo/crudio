import { evaluateRulePredicate } from './evaluateRulePredicate.js';
import { json } from './responseDescriptor.js';
import { resolveRuleRef } from './resolveRuleRef.js';

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isRefObject(value) {
  return isPlainObject(value) && typeof value.ref === 'string' && Object.keys(value).length === 1;
}

function asObject(value) {
  return isPlainObject(value) ? value : {};
}

function materializeRuleValue(input, context) {
  if (isRefObject(input)) {
    return resolveRuleRef(input, context);
  }

  if (Array.isArray(input)) {
    const values = [];
    for (const item of input) {
      const resolved = materializeRuleValue(item, context);
      if (!resolved.found) return resolved;
      values.push(resolved.value);
    }
    return { found: true, value: values };
  }

  if (isPlainObject(input)) {
    const value = {};
    for (const [key, child] of Object.entries(input)) {
      const resolved = materializeRuleValue(child, context);
      if (!resolved.found) return resolved;
      value[key] = resolved.value;
    }
    return { found: true, value };
  }

  return { found: true, value: input };
}

function buildRuleContext(req, currentState, defaultState, resourceCurrent) {
  return {
    req,
    state: {
      current: currentState,
      default: defaultState,
    },
    resource: {
      current: resourceCurrent,
    },
  };
}

function buildMissingLinkedResourceDescriptor(resource, req) {
  const id = resource?.idParam ? req.params?.[resource.idParam] : undefined;
  return json(404, {
    error: `Linked resource ${resource?.name ?? 'unknown'} with id ${id ?? 'unknown'} not found`,
  });
}

function applyResourceEffects(rule, context) {
  let nextResource = context.resource.current;
  let patchPayload = null;
  let touchesResource = false;

  if ('patchResource' in rule.then) {
    if (context.resource.current == null) {
      return { found: true, missingLinkedResource: true };
    }

    const patch = materializeRuleValue(rule.then.patchResource, context);
    if (!patch.found) return { found: false };

    patchPayload = asObject(patch.value);
    nextResource = {
      ...asObject(context.resource.current),
      ...patchPayload,
    };
    touchesResource = true;
  }

  return {
    found: true,
    touchesResource,
    nextResource,
    patchPayload,
    missingLinkedResource: false,
  };
}

function applyStateEffects(rule, context) {
  let nextState = context.state.current;
  let touchesState = false;

  if ('writeState' in rule.then) {
    const written = materializeRuleValue(rule.then.writeState, context);
    if (!written.found) return { found: false };
    nextState = written.value;
    touchesState = true;
  }

  if ('mergeState' in rule.then) {
    const merged = materializeRuleValue(rule.then.mergeState, context);
    if (!merged.found) return { found: false };
    const base = touchesState
      ? asObject(nextState)
      : asObject(context.state.current ?? context.state.default);
    nextState = {
      ...base,
      ...asObject(merged.value),
    };
    touchesState = true;
  }

  return {
    found: true,
    touchesState,
    nextState,
  };
}

function buildDescriptor(response, context, fallbackStatus) {
  const status = materializeRuleValue(response.status ?? fallbackStatus, context);
  const body = materializeRuleValue(response.body, context);
  const headers = materializeRuleValue(response.headers ?? {}, context);
  if (!status.found || !body.found || !headers.found) {
    return { found: false };
  }

  return {
    found: true,
    descriptor: json(status.value, body.value, headers.value),
  };
}

export async function executeDeclarativeRuleSet({
  operation,
  rules,
  req,
  state,
  resource = null,
  resources = null,
  resourceCurrent = null,
}) {
  const currentState = (await state.get()) ?? null;
  const defaultState = (await state.getDefault()) ?? null;
  const fallbackStatus = operation.canonicalResponse?.status ?? 200;

  for (const rule of rules) {
    const initialContext = buildRuleContext(req, currentState, defaultState, resourceCurrent);
    if (rule.if && !evaluateRulePredicate(rule.if, initialContext)) {
      continue;
    }

    const effectResource = applyResourceEffects(rule, initialContext);
    if (!effectResource.found) {
      continue;
    }

    if (effectResource.missingLinkedResource) {
      const descriptor = buildMissingLinkedResourceDescriptor(resource, req);
      return {
        matched: true,
        descriptor,
        commit: async (finalDescriptor = descriptor) => finalDescriptor,
      };
    }

    const resourceForState =
      effectResource.touchesResource ? effectResource.nextResource : resourceCurrent;
    const stateContext = buildRuleContext(
      req,
      currentState,
      defaultState,
      resourceForState
    );
    const effectState = applyStateEffects(rule, stateContext);
    if (!effectState.found) {
      continue;
    }

    const responseContext = buildRuleContext(
      req,
      effectState.touchesState ? effectState.nextState : currentState,
      defaultState,
      resourceForState
    );
    const descriptorResult = buildDescriptor(rule.then.respond, responseContext, fallbackStatus);
    if (!descriptorResult.found) {
      continue;
    }

    const descriptor = descriptorResult.descriptor;
    const commit = async (finalDescriptor = descriptor) => {
      if (effectResource.touchesResource) {
        const patched = await resources.patchLinked(resource, req.params, effectResource.patchPayload);
        if (patched == null) {
          return buildMissingLinkedResourceDescriptor(resource, req);
        }
      }
      if (effectState.touchesState) {
        await state.setDescriptor(finalDescriptor);
      }
      return finalDescriptor;
    };

    return {
      matched: true,
      descriptor,
      commit,
    };
  }

  return {
    matched: false,
    descriptor: null,
    commit: async (finalDescriptor = null) => finalDescriptor,
  };
}
