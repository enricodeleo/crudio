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
6. **Adapt** — optionally applies declarative rules or wraps an operation with a custom JavaScript handler
7. **Persist** — stores CRUD-backed resources and operation-state payloads in JSON files

CRUD-shaped operations share resource state. Everything else is served as operation-state: the response body is persisted per operation scope and replayed on later reads, with optional projection into a parent resource when the response schema is a compatible subset.

For non-CRUD operations without an explicit seed, Crudio generates a fake payload from the documented response schema at boot and serves it on the first call (then stays consistent per scope). Set `responseFake: 'off'` to restore the legacy echo-input behavior — see [Configuration](docs/configuration.md#response-fake-fallback) for the full rules.

## Declarative Rules

For many non-trivial endpoints you can stay in config and avoid JavaScript entirely.

```js
export default {
  operations: {
    login: {
      rules: [
        {
          name: 'admin-login',
          if: { eq: [{ ref: 'req.body.email' }, 'ada@example.com'] },
          then: {
            writeState: {
              token: 'mock-token',
              role: 'admin',
            },
            respond: {
              status: 200,
              body: { ref: 'state.current' },
            },
          },
        },
      ],
    },
  },
};
```

Stage 5 rules are:

- `first match wins`
- limited to `eq`, `exists`, and `in`
- limited to `writeState`, `mergeState`, `patchResource`, and `respond`
- operation-state writes stay local to the current operation
- `patchResource` can shallow-patch only the inferred linked CRUD resource item

If a route has `rules` and no rule matches, Crudio falls back to the built-in runtime. If a route has both `rules` and a JS `handler`, no-match is an explicit `500` instead of a silent handler fallback.

When `patchResource` runs, `resource.current` becomes the post-patch snapshot for the rest of that rule, so `respond` can return the updated linked resource without JavaScript. If the linked item does not exist, the rule returns `404`.

## Custom Handlers

When declarative rules are not enough, you can override or wrap any operation with JavaScript in `crudio.config.js`.

```js
export default {
  operations: {
    createPet: {
      handler: async (ctx) => {
        const created = await ctx.nextDefault();
        return ctx.json(created.status, { ...created.body, source: 'custom' });
      },
    },
    startRelease: {
      handler: './handlers/startRelease.js',
    },
  },
};
```

Available `ctx` helpers:

- `ctx.req` — normalized `params`, `query`, `body`, `headers`
- `ctx.state` — read/write operation-state for the current scope
- `ctx.resources` — CRUD helpers over inferred resources
- `ctx.storage` — raw storage access
- `ctx.json(status, body, headers?)` — return a normalized response descriptor
- `ctx.nextDefault()` — run the built-in runtime once, then wrap or replace it

Custom handlers work on both CRUD and non-CRUD routes. CRUD request validation still runs before the handler, and response validation follows `validateResponses`. When `rules` and `handler` coexist on the same operation, rules run first.

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
- auto-fake fallback from response schema for non-CRUD operations (opt-out via `responseFake: 'off'`)
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
