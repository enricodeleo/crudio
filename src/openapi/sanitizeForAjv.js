export function sanitizeForAjv(schema, seen = new WeakMap()) {
  if (schema === null || typeof schema !== 'object') {
    return schema;
  }

  if (seen.has(schema)) {
    return seen.get(schema);
  }

  if (Array.isArray(schema)) {
    const out = [];
    seen.set(schema, out);
    for (const item of schema) {
      out.push(sanitizeForAjv(item, seen));
    }
    return out;
  }

  const out = {};
  seen.set(schema, out);
  for (const [key, value] of Object.entries(schema)) {
    out[key] = sanitizeForAjv(value, seen);
  }

  if ('nullable' in out && !('type' in out)) {
    delete out.nullable;
  }

  return out;
}
