<h1 align="center">Crudio</h1>

<p align="center">
  <strong>Turn any OpenAPI spec into a working CRUD backend — instantly.</strong>
</p>

<p align="center">
  Stateful. Validated. Contract-first. No mock responses.
</p>

<p align="center">
  <a href="#install">Install</a> · <a href="#quick-start">Quick Start</a> · <a href="#how-it-works">How It Works</a> · <a href="#api-reference">API Reference</a> · <a href="#configuration">Configuration</a> · <a href="#programmatic-usage">Programmatic Usage</a>
</p>

---

## What is Crudio?

Crudio reads your OpenAPI 3.x specification and spins up a **real, stateful CRUD API** backed by JSON file storage. It validates every request against your schema. It persists every record to disk. It seeds fake data on demand.

This is **not** a mock server that returns canned responses. Crudio implements actual CRUD behavior — create, read, update, patch, delete — derived entirely from your API contract.

> If it's in the spec, Crudio implements it. If it's not in the spec, Crudio doesn't invent it.

## Install

```bash
npm install -g crudio
```

Or use it without installing:

```bash
npx crudio ./openapi.yaml
```

**Requirements:** Node.js >= 18

## Quick Start

Point Crudio at any OpenAPI 3.x file and you're live:

```bash
# Start the server
npx crudio ./petstore.yaml

# With fake data
npx crudio ./petstore.yaml --seed 10

# Custom port and storage directory
npx crudio ./petstore.yaml --port 8080 --data-dir /tmp/crudio-data
```

Given this spec:

```yaml
openapi: "3.0.3"
paths:
  /pets:
    get:
      responses:
        "200":
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/Pet"
    post:
      requestBody:
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/NewPet"
      responses:
        "201":
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Pet"
  /pets/{petId}:
    get: ...
    put: ...
    patch: ...
    delete: ...
components:
  schemas:
    NewPet:
      type: object
      required: [name]
      properties:
        name: { type: string }
        tag: { type: string, enum: [dog, cat, bird] }
    Pet:
      allOf:
        - $ref: "#/components/schemas/NewPet"
        - type: object
          required: [id]
          properties:
            id: { type: integer }
```

You get a fully working API:

```bash
# List pets
curl http://localhost:3000/pets

# Create a pet
curl -X POST http://localhost:3000/pets \
  -H 'Content-Type: application/json' \
  -d '{"name":"Rex","tag":"dog"}'
# → 201 {"id":1,"name":"Rex","tag":"dog"}

# Get by ID
curl http://localhost:3000/pets/1
# → 200 {"id":1,"name":"Rex","tag":"dog"}

# Update
curl -X PUT http://localhost:3000/pets/1 \
  -H 'Content-Type: application/json' \
  -d '{"id":1,"name":"Rex II","tag":"dog"}'
# → 200 {"id":1,"name":"Rex II","tag":"dog"}

# Partial update
curl -X PATCH http://localhost:3000/pets/1 \
  -H 'Content-Type: application/json' \
  -d '{"tag":"cat"}'
# → 200 {"id":1,"name":"Rex II","tag":"cat"}

# Delete
curl -X DELETE http://localhost:3000/pets/1
# → 204

# Filter and paginate
curl "http://localhost:3000/pets?tag=dog&limit=10&offset=0"
```

## How It Works

```
OpenAPI Spec (YAML/JSON)
        │
        ▼
  ┌─────────────┐
  │ OpenAPI      │   Loads, dereferences $ref,
  │ Loader       │   validates OpenAPI 3.x
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │ Schema       │   Merges allOf, normalizes
  │ Resolver     │   schemas, rejects oneOf/anyOf
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │ Resource     │   Detects CRUD pairs from
  │ Discovery    │   path patterns like /users + /users/{id}
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │ Route        │   Registers Express routes,
  │ Builder      │   binds validators and handlers
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │ CRUD Engine  │   Pure logic: list, getById,
  │              │   create, update, patch, delete
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │ JSON File    │   One file per resource,
  │ Storage      │   persists to data/
  └─────────────┘
```

1. **Load** — Crudio reads your OpenAPI 3.x spec and dereferences all `$ref` pointers
2. **Resolve** — Schemas are normalized: `allOf` is merged, unsupported features (`oneOf`, `anyOf`) are rejected early with clear errors
3. **Discover** — Path pairs like `/users` + `/users/{userId}` are detected as CRUD resources
4. **Validate** — AJV validators are compiled from your schemas for strict request checking
5. **Route** — Express routes are registered for each CRUD operation
6. **Persist** — Data is stored in JSON files, one per resource

## CLI Reference

```
Usage: crudio <spec-file> [options]

Options:
  --port, -p <number>      Port to listen on (default: 3000)
  --data-dir, -d <path>    Directory for JSON storage (default: ./data)
  --seed, -s <number>      Seed N fake records per resource
  --config, -c <path>      Path to config file
  --help, -h               Show help
```

## API Reference

### CRUD Endpoints

Crudio automatically registers routes for every resource discovered in your spec:

| Method | Path | Operation | Status |
|--------|------|-----------|--------|
| `GET` | `/resources` | List all | `200` |
| `GET` | `/resources/:id` | Get by ID | `200` / `404` |
| `POST` | `/resources` | Create | `201` / `400` |
| `PUT` | `/resources/:id` | Full update | `200` / `400` / `404` |
| `PATCH` | `/resources/:id` | Partial update | `200` / `400` / `404` |
| `DELETE` | `/resources/:id` | Delete | `204` / `404` |

Only methods present in your spec are registered. If a resource has no `PATCH` operation, the `PATCH` route won't exist.

### Query Parameters

List endpoints support pagination and filtering:

```
GET /pets?limit=10&offset=20&tag=dog
```

| Parameter | Default | Max | Description |
|-----------|---------|-----|-------------|
| `limit` | 100 | 1000 | Number of items to return |
| `offset` | 0 | — | Skip N items |
| `<any field>` | — | — | Equality filter on top-level fields |

Multiple filters are combined with AND. Only top-level properties can be filtered (no nested paths like `?address.city=Rome`).

**List response format:**

```json
{
  "items": [{ "id": 1, "name": "Rex" }],
  "total": 42
}
```

`total` reflects the count after filtering but before pagination.

### Validation

Request bodies are validated against your OpenAPI schemas using AJV:

- **POST** and **PUT** — full schema validation (all required fields must be present)
- **PATCH** — partial validation (only provided fields are checked, no required-field enforcement)
- Invalid requests return `400` with error details:

```json
{
  "error": "Validation failed",
  "details": [
    {
      "instancePath": "/name",
      "schemaPath": "#/required",
      "keyword": "required",
      "params": { "missingProperty": "name" },
      "message": "must have required property 'name'"
    }
  ]
}
```

### ID Generation

IDs are generated based on the schema type of the ID parameter:

| Schema | Strategy | Example |
|--------|----------|---------|
| `{ type: "integer" }` | Auto-increment | `1`, `2`, `3` |
| `{ type: "string", format: "uuid" }` | UUID v4 | `"550e8400-e29b-41d4-a716-446655440000"` |
| `{ type: "string" }` | 8-char random | `"a1b2c3d4"` |
| No ID schema | Auto-increment fallback | `1`, `2`, `3` |

You can provide your own ID in a `POST` request — it will be validated against the schema type. Duplicate IDs return `409 Conflict`.

### Health Check

```
GET /_crudio/health
```

```json
{
  "status": "ok",
  "resources": ["pets", "users"]
}
```

### Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success (GET, PUT, PATCH) |
| `201` | Created (POST) |
| `204` | Deleted (DELETE) |
| `400` | Validation error |
| `404` | Resource not found |
| `405` | Method not allowed |
| `409` | Duplicate ID |
| `500` | Internal error |

## Configuration

### Zero Config

Crudio works out of the box against any valid OpenAPI 3.x spec. No config file needed.

### Config File

For overrides, create `crudio.config.js`:

```js
export default {
  port: 3000,
  dataDir: './data',

  // Per-resource overrides
  resources: {
    pets: {
      // Only expose list and getById (no create/update/delete)
      methods: ['list', 'getById'],
    },
    orders: {
      // Skip this resource entirely
      exclude: true,
    },
    users: {
      // Custom ID parameter name
      idParam: 'userId',
    },
  },

  // Seeding
  seed: {
    count: 10,              // Default: 10 records per resource
    resources: {
      pets: 20,             // Override: 20 pets
      users: 5,             // Override: 5 users
    },
  },
};
```

Use it with:

```bash
npx crudio ./openapi.yaml --config ./crudio.config.js
```

CLI flags override config file values.

## Programmatic Usage

Use Crudio as a library in your own Node.js application:

```js
import { createApp } from 'crudio';

const app = await createApp({
  specPath: './openapi.yaml',
  dataDir: './data',
  seed: 10,
  seedPerResource: { pets: 20 },
});

app.listen(3000, () => {
  console.log('Running on port 3000');
});
```

### Resource Discovery

Crudio detects resources by matching path pairs:

| Collection | Item | Resource |
|------------|------|----------|
| `/users` | `/users/{userId}` | `users` |
| `/api/v1/orders` | `/api/v1/orders/{orderId}` | `orders` |

Rules:
- Both a collection path (no parameters) and an item path (one parameter) must exist
- The resource name is derived from the last segment of the collection path
- If only one side of the pair exists, the path is skipped — Crudio never infers missing routes

### Storage

Data is persisted as JSON files in the configured data directory:

```
data/
  pets.json
  users.json
```

Each file contains:

```json
{
  "items": [
    { "id": 1, "name": "Rex", "tag": "dog" },
    { "id": 2, "name": "Whiskers", "tag": "cat" }
  ]
}
```

Files are created on first write. Missing files are treated as empty collections.

## Seeding

Generate realistic fake data from your schemas:

```bash
npx crudio ./openapi.yaml --seed 10
```

Crudio maps schema types to fake data generators:

| Schema | Generated Value |
|--------|----------------|
| `{ type: "string" }` | Random word |
| `{ type: "string", format: "email" }` | `user@example.com` |
| `{ type: "string", format: "uri" }` | `https://example.com` |
| `{ type: "string", format: "uuid" }` | UUID v4 |
| `{ type: "string", format: "date-time" }` | ISO 8601 timestamp |
| `{ type: "string", enum: ["a","b"] }` | Random pick from enum |
| `{ type: "integer" }` | Random integer 1–10000 |
| `{ type: "number" }` | Random float |
| `{ type: "boolean" }` | Random boolean |
| `{ type: "array", items: {...} }` | 1–3 generated items |
| `{ type: "object", properties: {...} }` | Recursively generated |

Required properties are always generated. Optional properties have a ~50% chance of being included.

Seeded records go through the same `create` path as real requests — they get real auto-generated IDs and are persisted to disk.

## Supported OpenAPI Features

- OpenAPI **3.0** and **3.1**
- `$ref` resolution (internal and external)
- `allOf` schema merging (shallow)
- Path parameters (`/users/{userId}`)
- Request body and response schemas
- `enum` constraints
- String `format` hints (`email`, `uri`, `uuid`, `date-time`)
- Basic query parameters (`limit`, `offset`, equality filters)

## Unsupported in v1

- `oneOf`, `anyOf`, `not`, discriminators — Crudio fails fast with a clear error message if these are present
- Swagger 2.0 (`swagger: "2.0"`) — only OpenAPI 3.x is supported
- Authentication and authorization
- Complex query engines (sorting, nested filters, full-text search)
- WebSockets, SSE, or async workflows
- File uploads / multipart requests

When an unsupported feature is encountered, Crudio reports exactly what's wrong:

```
Unsupported schema feature: "oneOf" in schema "User.address".
Crudio v1 does not support oneOf, anyOf, or discriminators.
```

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
│   │   ├── schemaResolver.js  # Schema normalization
│   │   ├── resourceDiscovery.js # CRUD resource detection
│   │   └── resourceRegistry.js  # Resource storage
│   ├── engine/
│   │   ├── crudEngine.js      # Pure CRUD logic
│   │   └── idStrategy.js      # ID generation/validation
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
│   │   └── petstore.yaml      # Sample spec
│   ├── unit/                  # Unit tests per module
│   └── integration/           # Full CRUD route tests
├── package.json
└── vitest.config.js
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Watch mode
npm run test:watch

# Start locally
node bin/crudio.js test/fixtures/petstore.yaml --seed 5
```

## License

MIT
