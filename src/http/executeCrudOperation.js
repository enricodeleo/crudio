import { json } from './responseDescriptor.js';

function successStatus(operation, fallback) {
  return operation.canonicalResponse?.status ?? fallback;
}

function validationError(validation) {
  return json(400, { error: 'Validation failed', details: validation.errors });
}

function notFound(resourceName, id) {
  return json(404, { error: `Resource ${resourceName} with id ${id} not found` });
}

export async function executeCrudOperation({
  operation,
  crudOperation,
  resource,
  engine,
  validators,
  req,
}) {
  const idParam = resource.idParam;
  const resourceName = resource.name;
  let descriptor;

  switch (crudOperation) {
    case 'list': {
      const query = validators.parseQuery(req.query);
      descriptor = json(successStatus(operation, 200), await engine.list(query));
      break;
    }

    case 'getById': {
      const item = await engine.getById(req.params[idParam]);
      descriptor = item
        ? json(successStatus(operation, 200), item)
        : notFound(resourceName, req.params[idParam]);
      break;
    }

    case 'create': {
      const validation = validators.validateCreate(req.body);
      if (!validation.valid) {
        descriptor = validationError(validation);
        break;
      }

      descriptor = json(successStatus(operation, 201), await engine.create(req.body));
      break;
    }

    case 'update': {
      const validation = validators.validateBody(req.body);
      if (!validation.valid) {
        descriptor = validationError(validation);
        break;
      }

      const item = await engine.update(req.params[idParam], req.body);
      descriptor = item
        ? json(successStatus(operation, 200), item)
        : notFound(resourceName, req.params[idParam]);
      break;
    }

    case 'patch': {
      const validation = validators.validatePatch(req.body);
      if (!validation.valid) {
        descriptor = validationError(validation);
        break;
      }

      const item = await engine.patch(req.params[idParam], req.body);
      descriptor = item
        ? json(successStatus(operation, 200), item)
        : notFound(resourceName, req.params[idParam]);
      break;
    }

    case 'delete': {
      const deleted = await engine.delete(req.params[idParam]);
      if (!deleted) {
        descriptor = notFound(resourceName, req.params[idParam]);
        break;
      }

      const status = successStatus(operation, 204);
      descriptor = status === 204 ? json(204, undefined) : json(status, {});
      break;
    }

    default:
      descriptor = json(405, { error: 'Method not allowed' });
      break;
  }

  return {
    descriptor,
    async commit(finalDescriptor = descriptor) {
      return finalDescriptor;
    },
  };
}
