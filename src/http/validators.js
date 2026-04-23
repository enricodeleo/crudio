import Ajv from 'ajv';

export function createValidators(schema) {
  const ajv = new Ajv({ allErrors: true });

  const bodyValidator = ajv.compile(schema);

  const patchSchema = {
    ...schema,
    required: [],
  };
  const patchValidator = ajv.compile(patchSchema);

  function validateBody(data) {
    const valid = bodyValidator(data);
    return { valid, errors: valid ? [] : bodyValidator.errors };
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

  return { validateBody, validatePatch, parseQuery };
}
