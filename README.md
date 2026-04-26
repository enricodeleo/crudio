<h1 align="center">Crudio</h1>

<p align="center">
  <strong>Turn an OpenAPI 3.x spec into a working, stateful mock backend.</strong>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> · <a href="#how-it-works">How It Works</a> · <a href="#supported--unsupported">Scope</a> · <a href="docs/api.md">Full API Docs</a> · <a href="docs/configuration.md">Configuration</a>
</p>

---

## What is Crudio?

Crudio reads an OpenAPI 3.x specification and spins up a working mock API with persistence — stateful, schema-driven, derived entirely from your contract. CRUD endpoints behave like a small real backend; non-CRUD endpoints keep per-operation state so the whole spec is servable from one runtime.

## Why

Mock servers return canned responses. That's fine for smoke tests, but not enough when you need to verify that your frontend actually handles pagination, validation errors, 404s, and partial updates correctly.

Crudio gives you a backend that behaves like a real one — because it derives everything from your API contract:

- CRUD request bodies are validated against your schema
- data persists across calls (JSON files, no database needed)
- IDs are generated based on your spec (integers, UUIDs, etc.)
- CRUD routes use shared resource state
- non-CRUD routes use persisted operation state

**Use it for:** integration testing, frontend development, API prototyping, contract verification.

**Don't use it for:** production backends, load testing, or anything that needs domain-specific business logic without custom handlers.

## Quick Start

```bash
# Run against any OpenAPI 3.x spec
npx crudio ./openapi.yaml

# With fake data
npx crudio ./openapi.yaml --seed 10

# Custom port and storage
npx crudio ./openapi.yaml --port 8080 --data-dir /tmp/data
```

Given a standard CRUD spec with paths like `/pets` and `/pets/{petId}`, you get:

```bash
# Create
curl -X POST http://localhost:3000/pets \
  -H 'Content-Type: application/json' \
  -d '{"name":"Rex","tag":"dog"}'
# → 201 {"id":1,"name":"Rex","tag":"dog"}

# List (with filtering and pagination)
curl http://localhost:3000/pets?tag=dog&limit=10&offset=0
# → 200 {"items":[{"id":1,"name":"Rex","tag":"dog"}],"total":1}

# Get by ID
curl http://localhost:3000/pets/1
# → 200 {"id":1,"name":"Rex","tag":"dog"}

# Partial update
curl -X PATCH http://localhost:3000/pets/1 \
  -H 'Content-Type: application/json' \
  -d '{"tag":"cat"}'
# → 200 {"id":1,"name":"Rex","tag":"cat"}

# Delete
curl -X DELETE http://localhost:3000/pets/1
# → 204
```

Invalid CRUD requests are rejected against your schema:

```bash
curl -X POST http://localhost:3000/pets \
  -H 'Content-Type: application/json' \
  -d '{"tag":"dog"}'
# → 400 {"error":"Validation failed","details":[...]}
```

## How It Works

1. **Load** — reads your OpenAPI 3.x spec and dereferences all `$ref` pointers
2. **Compile** — normalizes every OpenAPI operation into a single registry entry
3. **Infer** — detects CRUD resource pairs from path patterns (`/users` + `/users/{id}`)
4. **Validate** — compiles AJV validators from your CRUD resource schemas for strict request checking
5. **Route** — registers Express routes for every operation defined in the spec
6. **Persist** — stores CRUD-backed resources and operation-state payloads in JSON files

CRUD-shaped operations share resource state. Everything else is served as operation-state: the response body is persisted per operation scope and replayed on later reads, with optional projection into a parent resource when the response schema is a compatible subset.

## Supported / Unsupported

### Supported

- OpenAPI 3.0 (`$ref`, `allOf`, path parameters, request/response schemas)
- CRUD operations: list, getById, create, update, patch, delete
- non-CRUD operations with persisted per-operation state
- CRUD request validation against schema
- Pagination (`limit`, `offset`) and equality filters
- Schema-driven ID generation (incremental integer, UUID, string)
- Fake data seeding for CRUD resources
- explicit default and per-scope seeding for non-CRUD operations
- Programmatic usage as a Node.js library

### Not supported (v1)

- `oneOf`, `anyOf`, discriminators — Crudio fails fast with a clear error if these are present
- Swagger 2.0
- domain-specific business logic inference
- Sorting, nested filters, full-text search
- File uploads / multipart

## CLI

```
Usage: crudio <spec-file> [options]

  --port, -p <number>      Port (default: 3000)
  --data-dir, -d <path>    Storage directory (default: ./data)
  --seed, -s <number>      Seed N fake records per resource
  --config, -c <path>      Path to config file
```

## Documentation

- [API Reference](docs/api.md) — endpoints, status codes, validation, query params, ID generation
- [Configuration](docs/configuration.md) — config file, resource/operation overrides, seeding options
- [Development](docs/development.md) — project structure, running tests, architecture

## Ecosystem

Crudio pairs well with [AquaSDK](https://github.com/enricodeleo/aquasdk), a JavaScript SDK generator for OpenAPI specs.

- **Crudio**: run the backend from the spec
- **AquaSDK**: generate the client from the same spec

## License

MIT
