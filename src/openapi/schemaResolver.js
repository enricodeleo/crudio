import { UnsupportedSchemaError } from '../http/errors.js';

export function normalize(schema, location = 'unknown') {
  if (!schema) return null;

  if (schema.oneOf) {
    throw new UnsupportedSchemaError('oneOf', location);
  }
  if (schema.anyOf) {
    throw new UnsupportedSchemaError('anyOf', location);
  }
  if (schema.not) {
    throw new UnsupportedSchemaError('not', location);
  }

  if (schema.allOf) {
    const merged = { type: 'object', properties: {}, required: [] };

    for (const sub of schema.allOf) {
      const resolved = normalize(sub, location);
      if (resolved) {
        if (resolved.properties) {
          Object.assign(merged.properties, resolved.properties);
        }
        if (resolved.required) {
          merged.required.push(...resolved.required);
        }
      }
    }

    if (schema.properties) {
      Object.assign(merged.properties, schema.properties);
    }

    return merged;
  }

  return schema;
}
