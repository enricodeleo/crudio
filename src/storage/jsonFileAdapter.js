import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { StorageAdapter } from './adapter.js';

export class JsonFileAdapter extends StorageAdapter {
  constructor(dataDir) {
    super();
    this.dataDir = dataDir;
    mkdirSync(dataDir, { recursive: true });
  }

  #filePath(resource) {
    return join(this.dataDir, `${resource}.json`);
  }

  #readFile(resource) {
    const file = this.#filePath(resource);
    if (!existsSync(file)) return [];
    return JSON.parse(readFileSync(file, 'utf-8')).items;
  }

  #writeFile(resource, items) {
    const file = this.#filePath(resource);
    writeFileSync(file, JSON.stringify({ items }, null, 2), 'utf-8');
  }

  async findAll(resource, query = {}) {
    let items = this.#readFile(resource);

    if (query.filters) {
      for (const [key, value] of Object.entries(query.filters)) {
        items = items.filter((item) => item[key] === value);
      }
    }

    const offset = query.offset ?? 0;
    const limit = query.limit ?? items.length;
    return items.slice(offset, offset + limit);
  }

  async findById(resource, id) {
    const items = this.#readFile(resource);
    const stringId = String(id);
    return items.find((item) => String(item.id) === stringId) ?? null;
  }

  async insert(resource, data) {
    const items = this.#readFile(resource);
    items.push(data);
    this.#writeFile(resource, items);
    return data;
  }

  async update(resource, id, data) {
    const items = this.#readFile(resource);
    const stringId = String(id);
    const index = items.findIndex((item) => String(item.id) === stringId);
    if (index === -1) return null;
    items[index] = data;
    this.#writeFile(resource, items);
    return data;
  }

  async delete(resource, id) {
    const items = this.#readFile(resource);
    const stringId = String(id);
    const index = items.findIndex((item) => String(item.id) === stringId);
    if (index === -1) return false;
    items.splice(index, 1);
    this.#writeFile(resource, items);
    return true;
  }

  async count(resource) {
    return this.#readFile(resource).length;
  }
}
