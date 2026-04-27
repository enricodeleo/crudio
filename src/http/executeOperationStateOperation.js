import { buildScopeKey } from '../operations/scopeKey.js';
import { projectResourceState } from '../operations/projectResourceState.js';
import { json } from './responseDescriptor.js';

function successStatus(operation, fallback = 200) {
  return operation.canonicalResponse?.status ?? fallback;
}

function notFound(operation) {
  return json(404, { error: `Operation state for ${operation.key} not found` });
}

function is204Only(operation) {
  return successStatus(operation, 200) === 204;
}

function asObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function buildScopeParts(req, operationConfig) {
  return operationConfig.querySensitive ? { ...req.params, ...req.query } : { ...req.params };
}

function buildStateBody(...parts) {
  return Object.assign({}, ...parts.map(asObject));
}

function extractProjectableFields(operation) {
  const status = operation.canonicalResponse?.status;
  const contentType = operation.canonicalResponse?.contentType;
  if (!status || !contentType) return [];

  const schema =
    operation.operation?.responses?.[String(status)]?.content?.[contentType]?.schema ?? null;

  return Object.keys(schema?.properties ?? {});
}

async function maybeProject({
  operation,
  storage,
  resource,
  operationConfig,
  projectionEligible,
  req,
  body,
}) {
  if (!projectionEligible) return;
  if (operationConfig.mode !== 'auto' && operationConfig.mode !== 'resource-aware') return;
  const projectableFields = extractProjectableFields(operation);
  if (projectableFields.length === 0) return;

  await projectResourceState({
    storage,
    resource,
    resourceId: req.params?.[resource?.idParam],
    body,
    projectableFields,
  });
}

export async function executeOperationStateOperation({
  operation,
  storage,
  operationConfig,
  projectionEligible = false,
  resource = null,
  req,
}) {
  const scopeKey = buildScopeKey(buildScopeParts(req, operationConfig));
  let descriptor;
  let commit = async (finalDescriptor = descriptor) => finalDescriptor;

  switch (operation.method) {
    case 'GET': {
      const state =
        (await storage.readOperationState(operation.key, scopeKey)) ??
        (await storage.readOperationDefaultState(operation.key));

      descriptor = state
        ? json(state.status ?? successStatus(operation, 200), state.body, state.headers ?? {})
        : notFound(operation);
      break;
    }

    case 'POST':
    case 'PUT': {
      if (is204Only(operation)) {
        descriptor = json(204, undefined);
        break;
      }

      const defaultState = await storage.readOperationDefaultState(operation.key);
      descriptor = json(
        successStatus(operation, 200),
        buildStateBody(defaultState?.body, req.body, req.params)
      );
      commit = async (finalDescriptor = descriptor) => {
        const state = {
          status: finalDescriptor.status,
          body: finalDescriptor.body,
          headers: finalDescriptor.headers ?? {},
        };
        await storage.writeOperationState(operation.key, scopeKey, state);
        await maybeProject({
          operation,
          storage,
          resource,
          operationConfig,
          projectionEligible,
          req,
          body: finalDescriptor.body,
        });
        return finalDescriptor;
      };
      break;
    }

    case 'PATCH': {
      if (is204Only(operation)) {
        descriptor = json(204, undefined);
        break;
      }

      const existingState = await storage.readOperationState(operation.key, scopeKey);
      const defaultState = existingState ? null : await storage.readOperationDefaultState(operation.key);
      descriptor = json(
        successStatus(operation, 200),
        buildStateBody(existingState?.body ?? defaultState?.body, req.body, req.params)
      );
      commit = async (finalDescriptor = descriptor) => {
        const state = {
          status: finalDescriptor.status,
          body: finalDescriptor.body,
          headers: finalDescriptor.headers ?? {},
        };
        await storage.writeOperationState(operation.key, scopeKey, state);
        await maybeProject({
          operation,
          storage,
          resource,
          operationConfig,
          projectionEligible,
          req,
          body: finalDescriptor.body,
        });
        return finalDescriptor;
      };
      break;
    }

    case 'DELETE': {
      const existingState = await storage.readOperationState(operation.key, scopeKey);
      if (!existingState) {
        descriptor = notFound(operation);
        break;
      }

      const status = successStatus(operation, 204);
      descriptor = status === 204 ? json(204, undefined) : json(status, {});
      commit = async (finalDescriptor = descriptor) => {
        await storage.deleteOperationState(operation.key, scopeKey);
        return finalDescriptor;
      };
      break;
    }

    default:
      descriptor = json(405, { error: 'Method not allowed' });
      break;
  }

  return { descriptor, commit };
}
