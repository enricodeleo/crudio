import { faker } from '@faker-js/faker';

export function generateFake(schema, isRequired = true) {
  if (!schema) return null;

  if (!isRequired && Math.random() < 0.5) return undefined;

  if (schema.enum) {
    return faker.helpers.arrayElement(schema.enum);
  }

  switch (schema.type) {
    case 'string':
      return generateFakeString(schema);
    case 'integer':
      return faker.number.int({ min: 1, max: 10000 });
    case 'number':
      return faker.number.float({ min: 0, max: 1000, fractionDigits: 2 });
    case 'boolean':
      return faker.datatype.boolean();
    case 'array':
      return generateFakeArray(schema);
    case 'object':
      return generateFakeObject(schema);
    default:
      return null;
  }
}

function generateFakeString(schema) {
  if (schema.format === 'email') return faker.internet.email();
  if (schema.format === 'uri') return faker.internet.url();
  if (schema.format === 'uuid') return faker.string.uuid();
  if (schema.format === 'date-time') return faker.date.recent().toISOString();
  return faker.lorem.word();
}

function generateFakeArray(schema) {
  const count = faker.number.int({ min: 1, max: 3 });
  const items = [];
  for (let i = 0; i < count; i++) {
    const value = generateFake(schema.items, true);
    if (value !== null) items.push(value);
  }
  return items;
}

function generateFakeObject(schema) {
  const obj = {};
  const required = schema.required ?? [];

  for (const [key, propSchema] of Object.entries(schema.properties ?? {})) {
    const isReq = required.includes(key);
    const value = generateFake(propSchema, isReq);
    if (value !== undefined) obj[key] = value;
  }

  return obj;
}
