import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { StorageAdapter } from './adapter.js';

export class JsonStateStore extends StorageAdapter {
  constructor(dataDir) {
    super();
    this.dataDir = dataDir;
    mkdirSync(join(dataDir, 'resources'), { recursive: true });
    mkdirSync(join(dataDir, '_meta'), { recursive: true });
  }

  resourcePath(resource) {
    return join(this.dataDir, 'resources', `${resource}.json`);
  }

  registryPath() {
    return join(this.dataDir, '_meta', 'registry.json');
  }

  #readItems(resource) {
    const file = this.resourcePath(resource);
    if (!existsSync(file)) return [];
    return JSON.parse(readFileSync(file, 'utf8')).items;
  }

  #writeItems(resource, items) {
    writeFileSync(this.resourcePath(resource), JSON.stringify({ items }, null, 2), 'utf8');
  }

  #applyFilters(items, filters = {}) {
    let filtered = items;
    for (const [key, value] of Object.entries(filters)) {
      filtered = filtered.filter((item) => item[key] === value);
    }
    return filtered;
  }

  async findAll(resource, query = {}) {
    const items = this.#applyFilters(this.#readItems(resource), query.filters);
    const offset = query.offset ?? 0;
    const limit = query.limit ?? items.length;
    return items.slice(offset, offset + limit);
  }

  async findById(resource, id) {
    const stringId = String(id);
    return this.#readItems(resource).find((item) => String(item.id) === stringId) ?? null;
  }

  async insert(resource, data) {
    const items = this.#readItems(resource);
    items.push(data);
    this.#writeItems(resource, items);
    return data;
  }

  async update(resource, id, data) {
    const items = this.#readItems(resource);
    const stringId = String(id);
    const index = items.findIndex((item) => String(item.id) === stringId);
    if (index === -1) return null;
    items[index] = data;
    this.#writeItems(resource, items);
    return data;
  }

  async delete(resource, id) {
    const items = this.#readItems(resource);
    const stringId = String(id);
    const index = items.findIndex((item) => String(item.id) === stringId);
    if (index === -1) return false;
    items.splice(index, 1);
    this.#writeItems(resource, items);
    return true;
  }

  async count(resource, query) {
    return this.#applyFilters(this.#readItems(resource), query?.filters).length;
  }

  async writeRegistry(registry) {
    writeFileSync(this.registryPath(), JSON.stringify(registry, null, 2), 'utf8');
  }
}
