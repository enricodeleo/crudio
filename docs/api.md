# API Reference

## Endpoints

Crudio registers one Express route for every OpenAPI operation in the spec.

There are two runtime classes:

- `resource` routes: CRUD-shaped operations backed by shared resource state
- `operation-state` routes: every other operation, backed by persisted per-operation state

Any route can also be controlled by declarative rules or wrapped/replaced by a custom JavaScript handler from `crudio.config.js`.

## CRUD-Shaped Routes

When the spec exposes a collection/item pair like `/pets` and `/pets/{id}`, Crudio derives a shared resource and wires whichever CRUD methods are present.

| Method | Path | Operation | Success | Error |
|--------|------|-----------|---------|-------|
| `GET` | `/resources` | List all | `200` | — |
| `GET` | `/resources/:id` | Get by ID | `200` | `404` |
| `POST` | `/resources` | Create | `201` | `400` `409` |
| `PUT` | `/resources/:id` | Full update | `200` | `400` `404` |
| `PATCH` | `/resources/:id` | Partial update | `200` | `400` `404` |
| `DELETE` | `/resources/:id` | Delete | `204` | `404` |

Only methods defined in the spec are registered.

## Operation-State Routes

Non-CRUD operations are still mounted and persisted, but their state is keyed by operation plus scope instead of by shared collection.

Typical examples:

- `GET /countries/{code}/summary`
- `POST /auth/login`
- `POST /releases/{id}/start`

Default behavior:

- `GET` reads scoped state, then falls back to default state, then returns `404`
- `POST` and `PUT` derive a response-shaped body from default state, request body, and path params, then persist it as scope-specific state
- `PATCH` shallow-merges `req.body` and path params into existing scoped state (or into default state when no scoped state exists yet)
- `DELETE` removes the scoped state and returns `404` when the scope does not exist
- `204`-only operations return `204` and do not create response-shaped stored state

Default state for an operation comes from one of three sources, in priority order:

1. an explicit `operations.<key>.seed.default` from `crudio.config.js`
2. the response-fake fallback — a payload auto-generated from the documented response schema at boot when `responseFake` is `'auto'` (default)
3. otherwise: no default state, which makes `GET` return `404` and `POST`/`PUT` echo `req.body` merged with path params

When the default state was produced by the response-fake fallback, `POST` and `PUT` return its body **unchanged** (no merge with `req.body`) so that the response shape matches the documented schema rather than the input shape. Array-bodied defaults are likewise returned unchanged across `POST`, `PUT`, and `PATCH`. See [Response Fake Fallback](configuration.md#response-fake-fallback) for the full rules and the `responseFake: 'off'` opt-out.

When an operation descends from a CRUD resource item path and its response schema is a compatible subset, `mode: 'auto'` or `mode: 'resource-aware'` can also project overlapping fields back into the parent resource item. Projection-eligible operations are exempted from the response-fake fallback so that the projection flow keeps persisting the caller's input.

## Health Check

```http
GET /_crudio/health
```

```json
{
  "status": "ok",
  "resources": ["pets", "users"]
}
```

`resources` lists the inferred CRUD-backed resource names.

## CRUD List Semantics

The list response **shape follows the documented response schema** in the spec. Crudio adapts the same internal `{items, total}` projection to whatever the contract declares.

### `type: array` response

```yaml
/pets:
  get:
    responses:
      "200":
        content:
          application/json:
            schema:
              type: array
              items: { $ref: "#/components/schemas/Pet" }
```

```http
GET /pets?tag=dog&limit=10&offset=20
```

```json
[{ "id": 1, "name": "Rex", "tag": "dog" }]
```

A plain array is returned. The filter/limit/offset pipeline runs first; the result is the sliced page.

### `type: object` response (e.g. paginated wrapper)

```yaml
/pets:
  get:
    responses:
      "200":
        content:
          application/json:
            schema:
              type: object
              properties:
                items: { type: array, items: { $ref: "#/components/schemas/Pet" } }
                total: { type: integer }
                nextCursor: { type: string }
```

```http
GET /pets?tag=dog&limit=10
```

```json
{
  "items": [{ "id": 1, "name": "Rex", "tag": "dog" }],
  "total": 42,
  "nextCursor": "..."
}
```

How the object body is filled:

- the **first array property** in the schema (any name — `items`, `data`, `results`, …) receives the paginated page
- integer/number properties named `total`, `count`, `totalItems`, or `totalCount` receive the post-filter pre-pagination count
- every other property is filled with a fake value generated from its sub-schema (so `nextCursor`, `links`, `meta`, etc. round-trip with type-correct payloads)

### No response schema documented

If the spec leaves the success response schemaless, Crudio falls back to the legacy `{ items, total }` wrapper so existing callers keep working. Document a response schema to opt into the contract-driven shape.

### Query Parameters

| Parameter | Default | Max | Description |
|-----------|---------|-----|-------------|
| `limit` | `100` | `1000` | Items to return |
| `offset` | `0` | — | Items to skip |
| `<field>` | — | — | Equality filter on top-level fields |

- Multiple filters are AND-combined
- Only top-level properties are filterable
- `limit` and `offset` are accepted on all list routes as a Crudio runtime extension, even when the spec does not declare them as parameters. They do not appear in the response body unless the response schema includes a matching `total`/`count` property.

## Validation

Request bodies are validated against OpenAPI schemas using AJV.

| Operation | Validation |
|-----------|------------|
| CRUD `POST` | Schema with generated `id` removed from required |
| CRUD `PUT` | Full resource schema including required fields |
| CRUD `PATCH` | Partial schema with only provided fields checked |
| Operation-state routes | No request validator yet beyond Express JSON parsing |
| Custom handlers on CRUD routes | Same built-in CRUD request validation before the handler runs |

Response validation is also available for declarative rules, custom handlers, and built-in routes through `validateResponses`.

## Declarative Rules Contract

Declarative rules run inside the same descriptor-based lifecycle as built-in routes and custom handlers.

Stage 5 supports:

- predicates: `eq`, `exists`, `in`
- effects: `writeState`, `mergeState`, `patchResource`, `respond`
- refs from `req.params`, `req.query`, `req.body`, `state.current`, `state.default`, and `resource.current`

Precedence:

- `rules only`: first match wins, otherwise built-in fallback
- `handler only`: Stage 3 custom-handler behavior
- `rules + handler`: matching rule wins; no-match is an explicit `500`

`writeState` and `mergeState` still touch only current operation state. `patchResource` is limited to the inferred linked CRUD resource item for the current route, applies a shallow top-level patch, and exposes the post-patch snapshot through `resource.current` for the rest of the rule. If the linked item does not exist, the rule returns `404`.

## Custom Handler Contract

Custom handlers return a descriptor:

```js
{ status, body, headers }
```

or use the helper:

```js
return ctx.json(200, { ok: true });
```

Available `ctx` members:

- `req`
- `state`
- `resources`
- `storage`
- `json()`
- `nextDefault()`

`nextDefault()` can be called at most once and returns the built-in descriptor for that route, whether the route is CRUD-backed or operation-state.

**Error response** (`400`)

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

CRUD resource IDs are determined by the schema type of the item path parameter:

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
| `200` | Success |
| `201` | Created |
| `204` | Success with no response body |
| `400` | Validation error or unsupported schema feature |
| `404` | Missing resource, item, or operation-state scope |
| `405` | Method not registered for that path |
| `409` | Duplicate ID on create |
| `500` | Unexpected internal error |

## Programmatic Usage

```js
import { createApp } from 'crudio';

const app = await createApp({
  specPath: './openapi.yaml',
  dataDir: './data',
  resources: {
    users: {
      seed: { count: 5 },
    },
  },
  operations: {
    'GET /countries/{code}/summary': {
      querySensitive: true,
      seed: {
        default: { code: 'IT', status: 'draft' },
      },
    },
  },
  seed: 10,
});

app.listen(3000);
```

### `createApp(options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `specPath` | `string` | — | Path to the OpenAPI spec |
| `dataDir` | `string` | — | JSON storage directory |
| `resources` | `object` | `{}` | Per-resource config |
| `operations` | `object` | `{}` | Per-operation config |
| `seed` | `number` | — | Default CRUD seed count |
| `seedPerResource` | `Record<string, number>` | — | Internal CLI-style override map for CRUD resource seed counts |
| `handlerBaseDir` | `string` | `process.cwd()` | Base directory used to resolve relative custom-handler module paths |
| `validateResponses` | `'strict' \| 'warn' \| 'off'` | `'warn'` | Response validation policy for built-in routes, declarative rules, and custom handlers |
| `responseFake` | `'auto' \| 'off'` | `'auto'` | Non-CRUD response-fake fallback policy. See [Response Fake Fallback](configuration.md#response-fake-fallback). |

For the full config surface, prefer `crudio.config.js` plus `loadConfig()` semantics documented in [configuration.md](configuration.md).
