# Development

## Setup

```bash
npm install
```

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch
```

The test suite uses [Vitest](https://vitest.dev/) and covers unit tests per module plus integration tests for the full HTTP stack.

## Running Locally

```bash
node bin/crudio.js test/fixtures/petstore.yaml --seed 5
```

Then test against `http://localhost:3000`.

## Project Structure

```
crudio/
├── bin/
│   └── crudio.js              # CLI entrypoint
├── src/
│   ├── app.js                 # Express app factory
│   ├── config.js              # Config loader
│   ├── openapi/
│   │   ├── loadSpec.js        # OpenAPI loading + dereferencing
│   │   ├── compileOperations.js # Normalized method + path compilation
│   │   ├── inferResources.js  # CRUD resource inference from operations
│   │   ├── schemaResolver.js  # Schema normalization (allOf, rejects oneOf)
│   ├── engine/
│   │   ├── crudEngine.js      # Pure CRUD logic (no HTTP)
│   │   └── idStrategy.js      # Schema-driven ID generation
│   ├── storage/
│   │   ├── adapter.js         # Storage interface
│   │   └── jsonStateStore.js  # JSON resource + metadata persistence
│   ├── http/
│   │   ├── buildOperationRegistry.js # CRUD operation route registry
│   │   ├── createOperationHandler.js # Request handlers from compiled operations
│   │   ├── validators.js      # AJV validation
│   │   └── errors.js          # Error classes
│   └── seed/
│       ├── seedEngine.js      # Seeding orchestrator
│       └── fakeGenerator.js   # Schema-aware fake data
├── test/
│   ├── fixtures/
│   │   └── petstore.yaml      # Sample OpenAPI 3.0 spec
│   ├── unit/
│   └── integration/
├── package.json
└── vitest.config.js
```

## Architecture

Each module has a single responsibility and no cross-cutting dependencies:

- **`openapi/`** — spec loading, schema resolution, operation compilation, CRUD inference
- **`engine/`** — pure CRUD logic with no HTTP awareness
- **`storage/`** — persistence interface and namespaced JSON state storage
- **`http/`** — operation registry, request handlers, validation, error handling
- **`seed/`** — fake data generation and seeding

The `CrudEngine` never touches HTTP or Express. `compileOperations()` is the app bootstrap source of truth, and `inferResources()` derives the CRUD-backed resources from that operation list. Data flows through well-defined interfaces.

## Adding a Storage Adapter

Implement the `StorageAdapter` interface:

```js
class StorageAdapter {
  async findAll(resource, query) {}
  async findById(resource, id) {}
  async insert(resource, data) {}
  async update(resource, id, data) {}
  async delete(resource, id) {}
  async count(resource, query) {}
  async writeRegistry(registry) {}
}
```

Then pass your adapter to `CrudEngine` instead of `JsonStateStore`.
