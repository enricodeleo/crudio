import { executeOperationStateOperation } from './executeOperationStateOperation.js';
import { sendDescriptor } from './responseDescriptor.js';

export function createOperationStateHandler({
  operation,
  storage,
  operationConfig,
  projectionEligible = false,
  resource = null,
}) {
  return async (req, res, next) => {
    try {
      const { descriptor, commit } = await executeOperationStateOperation({
        operation,
        storage,
        operationConfig,
        projectionEligible,
        resource,
        req,
      });
      await commit(descriptor);
      return sendDescriptor(res, descriptor);
    } catch (err) {
      next(err);
    }
  };
}
