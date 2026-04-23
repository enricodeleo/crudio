import { DuplicateIdError, NotFoundError } from '../http/errors.js';

export class CrudEngine {
  constructor(storage, idStrategy, schema, resourceName) {
    this.storage = storage;
    this.idStrategy = idStrategy;
    this.schema = schema;
    this.resourceName = resourceName;
  }

  async list(query = {}) {
    const limit = query.limit ?? 100;
    const offset = query.offset ?? 0;
    const filters = query.filters ?? {};

    const filtered = await this.storage.findAll(this.resourceName, {
      filters,
    });
    const total = filtered.length;

    const items = filtered.slice(offset, offset + limit);

    return { items, total };
  }

  async getById(id) {
    return this.storage.findById(this.resourceName, id);
  }

  async create(data) {
    let id = data.id;
    if (id === undefined) {
      const existing = await this.storage.findAll(this.resourceName);
      id = this.idStrategy.generate(existing);
    } else {
      if (!this.idStrategy.validate(id)) {
        throw new Error(`Invalid ID format: ${id}`);
      }
      const existing = await this.storage.findById(this.resourceName, id);
      if (existing) {
        throw new DuplicateIdError(this.resourceName, id);
      }
    }

    const item = { ...data, id };
    await this.storage.insert(this.resourceName, item);
    return item;
  }

  async update(id, data) {
    const existing = await this.storage.findById(this.resourceName, id);
    if (!existing) return null;

    const updated = { ...data, id: existing.id };
    await this.storage.update(this.resourceName, String(existing.id), updated);
    return updated;
  }

  async patch(id, data) {
    const existing = await this.storage.findById(this.resourceName, id);
    if (!existing) return null;

    const merged = { ...existing, ...data, id: existing.id };
    await this.storage.update(this.resourceName, String(existing.id), merged);
    return merged;
  }

  async delete(id) {
    return this.storage.delete(this.resourceName, id);
  }
}
