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
│   │   ├── schemaResolver.js  # Schema normalization (allOf, rejects oneOf)
│   │   ├── resourceDiscovery.js # CRUD resource detection from paths
│   │   └── resourceRegistry.js  # Resource storage
│   ├── engine/
│   │   ├── crudEngine.js      # Pure CRUD logic (no HTTP)
│   │   └── idStrategy.js      # Schema-driven ID generation
│   ├── storage/
│   │   ├── adapter.js         # Storage interface
│   │   └── jsonFileAdapter.js # JSON file persistence
│   ├── http/
│   │   ├── routeBuilder.js    # Express route registration
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

- **`openapi/`** — spec loading, schema resolution, resource discovery
- **`engine/`** — pure CRUD logic with no HTTP awareness
- **`storage/`** — persistence interface and JSON file adapter
- **`http/`** — Express routing, validation, error handling
- **`seed/`** — fake data generation and seeding

The `CrudEngine` never touches HTTP or Express. The `RouteBuilder` never touches storage. Data flows through well-defined interfaces.

## Adding a Storage Adapter

Implement the `StorageAdapter` interface:

```js
class StorageAdapter {
  async findAll(resource, query) {}
  async findById(resource, id) {}
  async insert(resource, data) {}
  async update(resource, id, data) {}
  async delete(resource, id) {}
  async count(resource) {}
}
```

Then pass your adapter to `CrudEngine` instead of `JsonFileAdapter`.
