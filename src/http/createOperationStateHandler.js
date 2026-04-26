import { buildScopeKey } from '../operations/scopeKey.js';
import { projectResourceState } from '../operations/projectResourceState.js';

function successStatus(operation, fallback = 200) {
  return operation.canonicalResponse?.status ?? fallback;
}

function notFound(res, operation) {
  return res.status(404).json({ error: `Operation state for ${operation.key} not found` });
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

function applyHeaders(res, headers = {}) {
  if (Object.keys(headers).length > 0 && typeof res.set === 'function') {
    res.set(headers);
  }
}

async function maybeProject({
  storage,
  resource,
  operationConfig,
  projectionEligible,
  req,
  body,
}) {
  if (!projectionEligible) return;
  if (operationConfig.mode !== 'auto' && operationConfig.mode !== 'resource-aware') return;

  // TODO(stage3): validate against canonicalResponse schema
  await projectResourceState({
    storage,
    resource,
    resourceId: req.params?.[resource?.idParam],
    body,
  });
}

export function createOperationStateHandler({
  operation,
  storage,
  operationConfig,
  projectionEligible = false,
  resource = null,
}) {
  return async (req, res, next) => {
    try {
      const scopeKey = buildScopeKey(buildScopeParts(req, operationConfig));

      switch (operation.method) {
        case 'GET': {
          const state =
            (await storage.readOperationState(operation.key, scopeKey)) ??
            (await storage.readOperationDefaultState(operation.key));

          if (!state) return notFound(res, operation);

          applyHeaders(res, state.headers);
          return res.status(state.status ?? successStatus(operation, 200)).json(state.body);
        }

        case 'POST':
        case 'PUT': {
          if (is204Only(operation)) {
            return res.status(204).end();
          }

          const defaultState = await storage.readOperationDefaultState(operation.key);
          const body = buildStateBody(defaultState?.body, req.body, req.params);
          const state = {
            status: successStatus(operation, 200),
            body,
            headers: {},
          };

          // TODO(stage3): validate against canonicalResponse schema
          await storage.writeOperationState(operation.key, scopeKey, state);
          await maybeProject({ storage, resource, operationConfig, projectionEligible, req, body });
          return res.status(state.status).json(state.body);
        }

        case 'PATCH': {
          if (is204Only(operation)) {
            return res.status(204).end();
          }

          const existingState = await storage.readOperationState(operation.key, scopeKey);
          const defaultState = existingState ? null : await storage.readOperationDefaultState(operation.key);
          const body = buildStateBody(existingState?.body ?? defaultState?.body, req.body, req.params);
          const state = {
            status: successStatus(operation, 200),
            body,
            headers: {},
          };

          // TODO(stage3): validate against canonicalResponse schema
          await storage.writeOperationState(operation.key, scopeKey, state);
          await maybeProject({ storage, resource, operationConfig, projectionEligible, req, body });
          return res.status(state.status).json(state.body);
        }

        case 'DELETE': {
          const deleted = await storage.deleteOperationState(operation.key, scopeKey);
          if (!deleted) return notFound(res, operation);

          const status = successStatus(operation, 204);
          if (status === 204) {
            return res.status(204).end();
          }

          return res.status(status).json({});
        }

        default:
          return res.status(405).json({ error: 'Method not allowed' });
      }
    } catch (err) {
      next(err);
    }
  };
}
