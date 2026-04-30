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
│   │   └── jsonStateStore.js  # JSON resource + operation-state persistence
│   ├── http/
│   │   ├── buildOperationRegistry.js # Full operation registry
│   │   ├── normalizeDeclarativeRules.js # Startup validation for operations.<key>.rules
│   │   ├── resolveRuleRef.js   # Declarative ref resolver with found/not-found sentinel
│   │   ├── evaluateRulePredicate.js # eq / exists / in predicate evaluator
│   │   ├── executeDeclarativeRuleSet.js # Declarative rules executor with deferred commit
│   │   ├── executeCrudOperation.js # Descriptor-based CRUD executor
│   │   ├── executeOperationStateOperation.js # Descriptor-based operation-state executor
│   │   ├── createCustomHandlerAdapter.js # Unified custom-handler wrapper
│   │   ├── buildHandlerStateHelpers.js # ctx.state helper factory
│   │   ├── buildHandlerResourceHelpers.js # ctx.resources helper factory
│   │   ├── loadCustomHandler.js # Inline/module handler resolution
│   │   ├── responseDescriptor.js # Descriptor helpers + Express response writer
│   │   ├── createOperationHandler.js # Thin CRUD wrapper over descriptor executor
│   │   ├── createOperationStateHandler.js # Thin operation-state wrapper over descriptor executor
│   │   ├── validators.js      # AJV validation + operation-level validator hooks
│   │   └── errors.js          # Error classes
│   ├── operations/
│   │   ├── projectResourceState.js # Safe projection into parent resources
│   │   └── scopeKey.js        # Canonical operation scope key builder
│   └── seed/
│       ├── operationSeedEngine.js # Non-CRUD operation-state seeding
│       ├── seedEngine.js      # CRUD resource seeding orchestrator
│       └── fakeGenerator.js   # Schema-aware fake data
├── test/
│   ├── fixtures/
│   │   ├── operation-state.yaml # Stage 2 operation-state fixture
│   │   └── petstore.yaml        # CRUD conformance fixture
│   ├── unit/
│   └── integration/
├── package.json
└── vitest.config.js
```

## Architecture

Each module has a single responsibility and no cross-cutting dependencies:

- **`openapi/`** — spec loading, schema resolution, full operation compilation, CRUD inference
- **`engine/`** — pure CRUD logic with no HTTP awareness
- **`storage/`** — persistence interface and namespaced JSON storage for resources and operations
- **`http/`** — operation registry, descriptor executors, custom-handler adapter, validation, error handling
- **`operations/`** — scope key construction and safe resource projection helpers
- **`seed/`** — fake data generation plus resource and operation-state seeding

`compileOperations()` is the bootstrap source of truth. `inferResources()` derives only the CRUD-backed subset from that operation list; everything else is mounted as operation-state. `CrudEngine` never touches HTTP or Express, and non-CRUD state persistence goes through `StorageAdapter` instead of the engine layer.

Stage 3 adds a unified custom-handler adapter above both route kinds. Built-in CRUD and operation-state behavior now run as descriptor-based executors, so custom handlers can call `nextDefault()` and still let the runtime validate, persist, and project through one consistent contract.

Stage 4 layers declarative rules into that same adapter instead of creating a third runtime. `operations.<key>.rules` are normalized at startup, evaluated with `first match wins`, and either return a descriptor immediately or fall through to the same built-in/custom-handler lifecycle.

Stage 5 extends the declarative executor with `patchResource` for the inferred linked CRUD item only. The executor now builds a post-patch resource snapshot in memory, lets later effects read it through `resource.current`, and commits linked-resource patching before any operation-state write.

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
  async readOperationState(operationKey, scopeKey) {}
  async writeOperationState(operationKey, scopeKey, state) {}
  async deleteOperationState(operationKey, scopeKey) {}
  async readOperationDefaultState(operationKey) {}
  async writeOperationDefaultState(operationKey, state) {}
  async writeRegistry(registry) {}
}
```

`JsonStateStore` is the built-in implementation. If you add another adapter, keep the same contract for both CRUD resource state and operation-state persistence and wire it in at the app composition layer.
