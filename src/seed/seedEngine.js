import { faker } from '@faker-js/faker';
import { generateFake } from './fakeGenerator.js';
import { resolveFK } from './fkResolver.js';

function walkSchema(schema, visit, seen = new Set()) {
  if (!schema || typeof schema !== 'object' || seen.has(schema)) return;
  seen.add(schema);
  if (schema.properties) {
    for (const [name, propSchema] of Object.entries(schema.properties)) {
      visit(name, propSchema);
      walkSchema(propSchema, visit, seen);
    }
  }
  if (schema.items) walkSchema(schema.items, visit, seen);
  if (Array.isArray(schema.allOf)) schema.allOf.forEach((s) => walkSchema(s, visit, seen));
}

export function buildFKGraph(resources) {
  const names = resources.map((r) => r.name);
  const graph = new Map();
  for (const r of resources) {
    const deps = new Set();
    walkSchema(r.schema, (propName, propSchema) => {
      const fk = resolveFK(propName, propSchema, names);
      if (fk && fk.target !== r.name) deps.add(fk.target);
    });
    graph.set(r.name, deps);
  }
  return graph;
}

export function topoSort(resources, graph) {
  const sorted = [];
  const visited = new Set();
  const visiting = new Set();
  const cycles = new Set();

  function visit(name) {
    if (visited.has(name)) return;
    if (visiting.has(name)) {
      cycles.add(name);
      return;
    }
    visiting.add(name);
    for (const dep of graph.get(name) ?? []) {
      if (graph.has(dep)) visit(dep);
    }
    visiting.delete(name);
    visited.add(name);
    sorted.push(name);
  }

  for (const r of resources) visit(r.name);
  return { sorted, cycles };
}

export async function seedResource(engine, schema, count, ctx = null) {
  for (let i = 0; i < count; i++) {
    const fakeData = generateFake(schema, true, ctx);
    if (fakeData) {
      const { id: _discardedId, ...data } = fakeData;
      await engine.create(data);
    }
  }
}

export async function seedAll(resources, engines, seedCount, perResource = {}) {
  const graph = buildFKGraph(resources);
  const { sorted, cycles } = topoSort(resources, graph);
  if (cycles.size > 0) {
    console.warn(
      `Cyclic FK dependencies detected for: ${[...cycles].join(', ')}. ` +
        `Seeding may contain dangling references for those resources.`
    );
  }

  const names = resources.map((r) => r.name);
  const byName = new Map(resources.map((r) => [r.name, r]));
  const idPools = new Map(names.map((n) => [n, []]));

  const ctx = {
    resolveFK: (propName, propSchema) => resolveFK(propName, propSchema, names),
    sampleId: (target) => {
      const pool = idPools.get(target);
      if (!pool || pool.length === 0) return null;
      return pool[faker.number.int({ min: 0, max: pool.length - 1 })];
    },
    sampleIds: (target, count) => {
      const pool = idPools.get(target);
      if (!pool || pool.length === 0) return [];
      const out = [];
      for (let i = 0; i < count; i++) {
        out.push(pool[faker.number.int({ min: 0, max: pool.length - 1 })]);
      }
      return out;
    },
  };

  for (const name of sorted) {
    const resource = byName.get(name);
    const engine = engines.get(name);
    if (!resource || !engine) continue;
    const count = perResource[name] ?? seedCount;
    for (let i = 0; i < count; i++) {
      const fakeData = generateFake(resource.schema, true, ctx);
      if (!fakeData) continue;
      const { id: _discardedId, ...data } = fakeData;
      const created = await engine.create(data);
      idPools.get(name).push(created.id);
    }
  }
}
