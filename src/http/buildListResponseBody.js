import { generateFake } from '../seed/fakeGenerator.js';

const COUNT_FIELD_NAMES = new Set(['total', 'count', 'totalitems', 'totalcount']);

function isNumericType(propSchema) {
  return propSchema?.type === 'integer' || propSchema?.type === 'number';
}

function isCountFieldName(name) {
  return COUNT_FIELD_NAMES.has(name.toLowerCase());
}

export function buildListResponseBody({ schema, items, total }) {
  if (!schema || typeof schema !== 'object') {
    return { items, total };
  }

  if (schema.type === 'array') {
    return items;
  }

  if (schema.type !== 'object' || !schema.properties) {
    return { items, total };
  }

  const body = {};
  let itemsAssigned = false;

  for (const [name, propSchema] of Object.entries(schema.properties)) {
    if (!itemsAssigned && propSchema?.type === 'array') {
      body[name] = items;
      itemsAssigned = true;
      continue;
    }

    if (isNumericType(propSchema) && isCountFieldName(name)) {
      body[name] = total;
      continue;
    }

    const fake = generateFake(propSchema);
    if (fake !== undefined) {
      body[name] = fake;
    }
  }

  if (!itemsAssigned) {
    return { items, total };
  }

  return body;
}
