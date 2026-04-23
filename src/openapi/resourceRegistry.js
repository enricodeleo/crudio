export class ResourceRegistry {
  #resources = new Map();

  add(resource) {
    this.#resources.set(resource.name, resource);
  }

  get(name) {
    return this.#resources.get(name) ?? null;
  }

  getAll() {
    return Array.from(this.#resources.values());
  }

  get names() {
    return Array.from(this.#resources.keys());
  }
}
