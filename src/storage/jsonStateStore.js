import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { StorageAdapter } from './adapter.js';

export class JsonStateStore extends StorageAdapter {
  constructor(dataDir) {
    super();
    this.dataDir = dataDir;
    mkdirSync(join(dataDir, 'resources'), { recursive: true });
    mkdirSync(join(dataDir, 'operations'), { recursive: true });
    mkdirSync(join(dataDir, '_meta'), { recursive: true });
  }

  resourcePath(resource) {
    return join(this.dataDir, 'resources', `${resource}.json`);
  }

  registryPath() {
    return join(this.dataDir, '_meta', 'registry.json');
  }

  operationPath(hash) {
    return join(this.dataDir, 'operations', `${hash}.json`);
  }

  #readItems(resource) {
    const file = this.resourcePath(resource);
    if (!existsSync(file)) return [];
    return JSON.parse(readFileSync(file, 'utf8')).items;
  }

  #writeItems(resource, items) {
    writeFileSync(this.resourcePath(resource), JSON.stringify({ items }, null, 2), 'utf8');
  }

  #readRegistry() {
    const file = this.registryPath();
    if (!existsSync(file)) return {};
    return JSON.parse(readFileSync(file, 'utf8'));
  }

  #writeRegistryFile(registry) {
    writeFileSync(this.registryPath(), JSON.stringify(registry, null, 2), 'utf8');
  }

  #hashOperationKey(operationKey) {
    return createHash('sha256').update(operationKey).digest('hex').slice(0, 8);
  }

  #ensureOperationHash(operationKey) {
    const hash = this.#hashOperationKey(operationKey);
    const registry = this.#readRegistry();
    const operationStateHashes = { ...(registry.operationStateHashes ?? {}) };
    const registeredKey = operationStateHashes[hash];
    if (registeredKey && registeredKey !== operationKey) {
      throw new Error(
        `Operation state hash collision for "${operationKey}" and "${registeredKey}" (${hash}).`
      );
    }

    const file = this.operationPath(hash);
    if (existsSync(file)) {
      const record = JSON.parse(readFileSync(file, 'utf8'));
      if (record.operationKey !== operationKey) {
        throw new Error(
          `Operation state hash collision for "${operationKey}" and "${record.operationKey}" (${hash}).`
        );
      }
    }

    if (!registeredKey) {
      operationStateHashes[hash] = operationKey;
      this.#writeRegistryFile({ ...registry, operationStateHashes });
    }

    return hash;
  }

  #readOperationRecord(operationKey) {
    const hash = this.#ensureOperationHash(operationKey);
    const file = this.operationPath(hash);
    if (!existsSync(file)) {
      return {
        hash,
        record: {
          operationKey,
          defaultState: null,
          scopes: {},
        },
      };
    }

    return {
      hash,
      record: JSON.parse(readFileSync(file, 'utf8')),
    };
  }

  #writeOperationRecord(hash, record) {
    writeFileSync(this.operationPath(hash), JSON.stringify(record, null, 2), 'utf8');
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

  async readOperationState(operationKey, scopeKey) {
    const { record } = this.#readOperationRecord(operationKey);
    return record.scopes[scopeKey] ?? null;
  }

  async writeOperationState(operationKey, scopeKey, state) {
    const { hash, record } = this.#readOperationRecord(operationKey);
    record.scopes[scopeKey] = state;
    this.#writeOperationRecord(hash, record);
    return state;
  }

  async deleteOperationState(operationKey, scopeKey) {
    const { hash, record } = this.#readOperationRecord(operationKey);
    if (!(scopeKey in record.scopes)) return false;
    delete record.scopes[scopeKey];
    this.#writeOperationRecord(hash, record);
    return true;
  }

  async readOperationDefaultState(operationKey) {
    const { record } = this.#readOperationRecord(operationKey);
    return record.defaultState ?? null;
  }

  async writeOperationDefaultState(operationKey, state) {
    const { hash, record } = this.#readOperationRecord(operationKey);
    record.defaultState = state;
    this.#writeOperationRecord(hash, record);
    return state;
  }

  async writeRegistry(registry) {
    const existing = this.#readRegistry();
    const nextRegistry = { ...registry };
    if (existing.operationStateHashes && Object.keys(existing.operationStateHashes).length > 0) {
      nextRegistry.operationStateHashes = existing.operationStateHashes;
    }
    this.#writeRegistryFile(nextRegistry);
  }
}
