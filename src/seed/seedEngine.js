import { generateFake } from './fakeGenerator.js';

export async function seedResource(engine, schema, count) {
  for (let i = 0; i < count; i++) {
    const fakeData = generateFake(schema, true);
    if (fakeData) {
      const { id, ...data } = fakeData;
      await engine.create(data);
    }
  }
}
