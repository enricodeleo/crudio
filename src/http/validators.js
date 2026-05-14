import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { ValidationError } from './errors.js';

function createAjv() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv;
}

export function createValidators(schema) {
  const ajv = createAjv();

  const bodyValidator = ajv.compile(schema);

  const createSchema = {
    ...schema,
    required: (schema.required ?? []).filter((r) => r !== 'id'),
  };
  const createValidator = ajv.compile(createSchema);

  const patchSchema = {
    ...schema,
    required: [],
  };
  const patchValidator = ajv.compile(patchSchema);

  function validateBody(data) {
    const valid = bodyValidator(data);
    return { valid, errors: valid ? [] : bodyValidator.errors };
  }

  function validateCreate(data) {
    const valid = createValidator(data);
    return { valid, errors: valid ? [] : createValidator.errors };
  }

  function validatePatch(data) {
    const valid = patchValidator(data);
    return { valid, errors: valid ? [] : patchValidator.errors };
  }

  function parseQuery(queryParams) {
    const limit = Math.min(parseInt(queryParams.limit, 10) || 100, 1000);
    const offset = parseInt(queryParams.offset, 10) || 0;

    const filters = {};
    for (const [key, value] of Object.entries(queryParams)) {
      if (key === 'limit' || key === 'offset') continue;
      filters[key] = value;
    }

    return { limit, offset, filters };
  }

  return { validateBody, validateCreate, validatePatch, parseQuery };
}

export function createOperationRequestValidator({ routeKind, crudOperation, validators } = {}) {
  if (routeKind !== 'resource' || !validators) {
    return null;
  }

  const validate =
    crudOperation === 'create'
      ? validators.validateCreate
      : crudOperation === 'patch'
        ? validators.validatePatch
        : crudOperation === 'update'
          ? validators.validateBody
          : null;

  if (!validate) {
    return null;
  }

  return (body) => {
    const result = validate(body);
    if (!result.valid) {
      throw new ValidationError(result.errors);
    }
  };
}

export function createOperationResponseValidator(operation, mode = 'warn') {
  if (mode === 'off') {
    return null;
  }

  const canonicalStatus = operation?.canonicalResponse?.status;
  const contentType = operation?.canonicalResponse?.contentType;
  const schema =
    canonicalStatus && contentType
      ? operation?.operation?.responses?.[String(canonicalStatus)]?.content?.[contentType]?.schema
      : null;

  if (!schema) {
    return null;
  }

  const ajv = createAjv();
  const validate = ajv.compile(schema);

  return (body, status) => {
    if (status !== undefined && status !== canonicalStatus) {
      return;
    }

    const valid = validate(body);
    if (valid) {
      return;
    }

    const message = `Response validation failed for ${operation.key}`;
    if (mode === 'strict') {
      throw new Error(message);
    }

    console.warn(message, validate.errors ?? []);
  };
}
