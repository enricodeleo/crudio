import { executeCrudOperation } from './executeCrudOperation.js';
import { sendDescriptor } from './responseDescriptor.js';

export function createOperationHandler({ operation, crudOperation, resource, engine, validators }) {
  return async (req, res, next) => {
    try {
      const { descriptor, commit } = await executeCrudOperation({
        operation,
        crudOperation,
        resource,
        engine,
        validators,
        req,
      });
      await commit(descriptor);
      return sendDescriptor(res, descriptor);
    } catch (err) {
      next(err);
    }
  };
}
