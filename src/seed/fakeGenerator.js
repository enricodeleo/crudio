import { faker } from '@faker-js/faker';

export function generateFake(schema, options = {}) {
  if (!schema) return null;

  const { ctx = null, useExamples = true } = options;

  if (useExamples && schema.example !== undefined) {
    return structuredClone(schema.example);
  }

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
      return generateFakeArray(schema, ctx, useExamples);
    case 'object':
      return generateFakeObject(schema, ctx, useExamples);
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

function generateFakeArray(schema, ctx, useExamples) {
  const count = useExamples ? 1 : faker.number.int({ min: 1, max: 3 });
  const items = [];
  for (let i = 0; i < count; i++) {
    const value = generateFake(schema.items, { ctx, useExamples });
    if (value !== null) items.push(value);
  }
  return items;
}

function generateFakeObject(schema, ctx, useExamples) {
  const obj = {};

  for (const [key, propSchema] of Object.entries(schema.properties ?? {})) {
    if (ctx?.resolveFK) {
      const fk = ctx.resolveFK(key, propSchema);
      if (fk) {
        const val = fk.isArray
          ? ctx.sampleIds(fk.target, faker.number.int({ min: 1, max: 3 }))
          : ctx.sampleId(fk.target);
        if (val !== null && !(Array.isArray(val) && val.length === 0)) {
          obj[key] = val;
          continue;
        }
      }
    }

    const value = generateFake(propSchema, { ctx, useExamples });
    if (value !== undefined) obj[key] = value;
  }

  return obj;
}
