export class CrudioError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
  }
}

export class NotFoundError extends CrudioError {
  constructor(resource, id) {
    super(`Resource ${resource} with id ${id} not found`, 404);
  }
}

export class ValidationError extends CrudioError {
  constructor(errors) {
    super('Validation failed', 400);
    this.errors = errors;
  }
}

export class DuplicateIdError extends CrudioError {
  constructor(resource, id) {
    super(`Resource ${resource} already has an item with id ${id}`, 409);
  }
}

export class UnsupportedSchemaError extends CrudioError {
  constructor(feature, location) {
    super(
      `Unsupported schema feature: "${feature}" in schema "${location}". ` +
        `Crudio v1 does not support oneOf, anyOf, or discriminators.`,
      400
    );
  }
}

export class MethodNotAllowedError extends CrudioError {
  constructor(method, path) {
    super(`Method ${method} not allowed on ${path}`, 405);
  }
}
