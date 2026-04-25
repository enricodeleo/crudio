function successStatus(operation, fallback) {
  return operation.canonicalResponse?.status ?? fallback;
}

function validationError(res, validation) {
  return res.status(400).json({ error: 'Validation failed', details: validation.errors });
}

export function createOperationHandler({ operation, crudOperation, resource, engine, validators }) {
  const idParam = resource.idParam;
  const resourceName = resource.name;

  switch (crudOperation) {
    case 'list':
      return async (req, res, next) => {
        try {
          const query = validators.parseQuery(req.query);
          const result = await engine.list(query);
          res.status(successStatus(operation, 200)).json(result);
        } catch (err) {
          next(err);
        }
      };

    case 'getById':
      return async (req, res, next) => {
        try {
          const item = await engine.getById(req.params[idParam]);
          if (!item) {
            return res
              .status(404)
              .json({ error: `Resource ${resourceName} with id ${req.params[idParam]} not found` });
          }
          res.status(successStatus(operation, 200)).json(item);
        } catch (err) {
          next(err);
        }
      };

    case 'create':
      return async (req, res, next) => {
        try {
          const validation = validators.validateCreate(req.body);
          if (!validation.valid) return validationError(res, validation);

          const item = await engine.create(req.body);
          res.status(successStatus(operation, 201)).json(item);
        } catch (err) {
          next(err);
        }
      };

    case 'update':
      return async (req, res, next) => {
        try {
          const validation = validators.validateBody(req.body);
          if (!validation.valid) return validationError(res, validation);

          const item = await engine.update(req.params[idParam], req.body);
          if (!item) {
            return res
              .status(404)
              .json({ error: `Resource ${resourceName} with id ${req.params[idParam]} not found` });
          }
          res.status(successStatus(operation, 200)).json(item);
        } catch (err) {
          next(err);
        }
      };

    case 'patch':
      return async (req, res, next) => {
        try {
          const validation = validators.validatePatch(req.body);
          if (!validation.valid) return validationError(res, validation);

          const item = await engine.patch(req.params[idParam], req.body);
          if (!item) {
            return res
              .status(404)
              .json({ error: `Resource ${resourceName} with id ${req.params[idParam]} not found` });
          }
          res.status(successStatus(operation, 200)).json(item);
        } catch (err) {
          next(err);
        }
      };

    case 'delete':
      return async (req, res, next) => {
        try {
          const deleted = await engine.delete(req.params[idParam]);
          if (!deleted) {
            return res
              .status(404)
              .json({ error: `Resource ${resourceName} with id ${req.params[idParam]} not found` });
          }

          const status = successStatus(operation, 204);
          if (status === 204) {
            return res.status(204).end();
          }

          res.status(status).json({});
        } catch (err) {
          next(err);
        }
      };

    default:
      return (_req, res) => res.status(405).json({ error: 'Method not allowed' });
  }
}
