# API Reference

## Endpoints

For each resource discovered in your spec, Crudio registers routes based on which HTTP methods are present.

| Method | Path | Operation | Success | Error |
|--------|------|-----------|---------|-------|
| `GET` | `/resources` | List all | `200` | — |
| `GET` | `/resources/:id` | Get by ID | `200` | `404` |
| `POST` | `/resources` | Create | `201` | `400` |
| `PUT` | `/resources/:id` | Full update | `200` | `400` `404` |
| `PATCH` | `/resources/:id` | Partial update | `200` | `400` `404` |
| `DELETE` | `/resources/:id` | Delete | `204` | `404` |

Only methods defined in your spec are registered. If a resource has no `PATCH`, the route won't exist.

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

## List Endpoint

```
GET /pets?tag=dog&limit=10&offset=20
```

**Response:**

```json
{
  "items": [{ "id": 1, "name": "Rex", "tag": "dog" }],
  "total": 42
}
```

- `total` is the count **after filtering, before pagination**
- `items` is the sliced page

### Query Parameters

| Parameter | Default | Max | Description |
|-----------|---------|-----|-------------|
| `limit` | 100 | 1000 | Items to return |
| `offset` | 0 | — | Items to skip |
| `<field>` | — | — | Equality filter on top-level fields |

- Multiple filters are AND-combined
- Only top-level properties (no `?address.city=Rome`)

## Validation

Request bodies are validated against your OpenAPI schemas using AJV.

| Operation | Validation |
|-----------|------------|
| `POST` (create) | Schema with `id` removed from required (auto-generated) |
| `PUT` (update) | Full schema including required fields |
| `PATCH` (partial) | Schema with `required: []` — only provided fields are type-checked |

**Error response** (`400`):

```json
{
  "error": "Validation failed",
  "details": [
    {
      "instancePath": "/name",
      "keyword": "required",
      "message": "must have required property 'name'",
      "params": { "missingProperty": "name" },
      "schemaPath": "#/required"
    }
  ]
}
```

## ID Generation

IDs are determined by the schema type of the path parameter:

| Schema | Strategy | Example |
|--------|----------|---------|
| `{ type: "integer" }` | Auto-increment | `1`, `2`, `3` |
| `{ type: "string", format: "uuid" }` | UUID v4 | `"550e8400-e29b-41d4-a716-446655440000"` |
| `{ type: "string" }` | 8-char random | `"a1b2c3d4"` |
| Not specified | Auto-increment | `1`, `2`, `3` |

- Client-provided IDs are validated against the expected type
- Duplicate IDs on create return `409 Conflict`
- Missing IDs are auto-generated

## Status Codes

| Code | When |
|------|------|
| `200` | Success (GET, PUT, PATCH) |
| `201` | Created (POST) |
| `204` | Deleted (DELETE, no body) |
| `400` | Validation error or unsupported schema feature |
| `404` | Resource or item not found |
| `405` | Method not registered for this path |
| `409` | Duplicate ID on create |
| `500` | Unexpected error |

## Programmatic Usage

```js
import { createApp } from 'crudio';

const app = await createApp({
  specPath: './openapi.yaml',
  dataDir: './data',
  seed: 10,
  seedPerResource: { pets: 20 },
});

app.listen(3000);
```

### `createApp(options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `specPath` | `string` | required | Path to OpenAPI spec |
| `dataDir` | `string` | `./data` | JSON storage directory |
| `resources` | `object` | `{}` | Per-resource config overrides |
| `seed` | `number` | — | Seed N records per resource |
| `seedPerResource` | `object` | `{}` | Per-resource seed count override |
