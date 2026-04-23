import Ajv from 'ajv';

export function createValidators(schema) {
  const ajv = new Ajv({ allErrors: true, strict: false });

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
