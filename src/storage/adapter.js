export class StorageAdapter {
  async findAll(resource, query) {
    throw new Error('Not implemented');
  }

  async findById(resource, id) {
    throw new Error('Not implemented');
  }

  async insert(resource, data) {
    throw new Error('Not implemented');
  }

  async update(resource, id, data) {
    throw new Error('Not implemented');
  }

  async delete(resource, id) {
    throw new Error('Not implemented');
  }

  async count(resource, query) {
    throw new Error('Not implemented');
  }

  // Empty scope ('') is the concrete scope for path-less operations.
  // Default state is a separate fallback template, not the same entry.
  async readOperationState(operationKey, scopeKey) {
    throw new Error('Not implemented');
  }

  async writeOperationState(operationKey, scopeKey, state) {
    throw new Error('Not implemented');
  }

  async deleteOperationState(operationKey, scopeKey) {
    throw new Error('Not implemented');
  }

  async readOperationDefaultState(operationKey) {
    throw new Error('Not implemented');
  }

  async writeOperationDefaultState(operationKey, state) {
    throw new Error('Not implemented');
  }

  async writeRegistry(registry) {
    throw new Error('Not implemented');
  }
}
