# Configuration

## Zero Config

Crudio works without a config file against any valid OpenAPI 3.x spec. The config file is only for persistence, seeding, FK overrides, and per-operation behavior the spec does not express clearly.

## CLI Flags

```bash
npx crudio ./openapi.yaml --port 8080 --seed 10
```

| Flag | Default | Description |
|------|---------|-------------|
| `--port, -p` | `3000` | Port to listen on |
| `--data-dir, -d` | `./data` | Directory for JSON storage |
| `--seed, -s` | — | Sets top-level `seed.count` for CRUD resource seeding |
| `--config, -c` | — | Path to config file |

CLI flags override config file values.

## Config File

Create `crudio.config.js` for persistent settings:

```js
export default {
  port: 3000,
  dataDir: './data',

  seed: {
    count: 10,
  },

  validateResponses: 'warn',

  resources: {
    users: {
      foreignKeys: {
        managerId: 'users',
      },
      seed: {
        count: 5,
      },
    },
  },

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
    startRelease: {
      rules: [
        {
          name: 'start-linked-release',
          then: {
            patchResource: {
              status: { ref: 'req.body.status' },
            },
            respond: {
              status: 200,
              body: {
                id: { ref: 'resource.current.id' },
                status: { ref: 'resource.current.status' },
              },
            },
          },
        },
      ],
    },
    'GET /countries/{code}/summary': {
      querySensitive: true,
      seed: {
        default: { status: 'draft' },
        scopes: {
          'code=IT&locale=it': { status: 'ready' },
        },
      },
    },
    createPet: {
      handler: async (ctx) => {
        const created = await ctx.nextDefault();
        return ctx.json(created.status, { ...created.body, source: 'custom' });
      },
    },
    'POST /auth/login': {
      enabled: false,
    },
    startRelease: {
      mode: 'resource-aware',
      handler: './handlers/startRelease.js',
      seed: {
        scopes: {
          'id=1': { status: 'started' },
        },
      },
    },
  },
};
```

```bash
npx crudio ./openapi.yaml --config ./crudio.config.js
```

Crudio does not extend OpenAPI. Per-operation and per-resource behavior the spec cannot express is configured only in `crudio.config.js`.

## Top-Level Options

| Option | Type | Description |
|--------|------|-------------|
| `port` | `number` | HTTP port |
| `dataDir` | `string` | Storage directory |
| `seed.count` | `number` | Default CRUD seed count |
| `seed.strategy` | `'config-first' \| 'examples-first' \| 'fakes-only'` | Parsed config field reserved for future resource-seeding policy |
| `validateResponses` | `'strict' \| 'warn' \| 'off'` | Response validation policy for built-in routes, declarative rules, and custom handlers |
| `responseFake` | `'auto' \| 'off'` | When `'auto'` (default), non-CRUD operations without an explicit seed are auto-populated with a fake payload generated from the documented response schema. Set to `'off'` to restore the legacy echo-input behavior. |

`--seed N` maps only to `seed.count`. Per-resource and per-operation seeding must come from config.

## Resource Options

```js
resources: {
  posts: {
    foreignKeys: {
      authorId: 'users',
    },
    seed: {
      count: 20,
    },
  },
}
```

| Option | Type | Description |
|--------|------|-------------|
| `foreignKeys` | `Record<string, string>` | Override FK inference for schema properties like `authorId` |
| `seed.count` | `number` | Seed count override for that CRUD resource |

Resource names come from inferred CRUD collection/item path pairs. The old `methods`, `exclude`, and `idParam` overrides are not part of the operation-first config model.

## Operation Options

Operations can be addressed either by canonical key (`'POST /releases/{id}/start'`) or by `operationId` when present. If both point to the same operation, config loading fails.

```js
operations: {
  'GET /countries/{code}/summary': {
    mode: 'operation-state',
    querySensitive: true,
    seed: {
      default: { code: 'IT', status: 'draft' },
      scopes: {
        'code=IT&locale=it': { code: 'IT', status: 'published' },
      },
    },
  },
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Disable a single route when `false` |
| `mode` | `'auto' \| 'operation-state' \| 'resource-aware'` | `'auto'` | State resolution mode for non-CRUD operations |
| `rules` | `Array<object>` | — | Ordered declarative rules evaluated before built-in runtime and JS handlers |
| `handler` | `Function \| string` | — | Inline custom handler or module path resolved relative to the config file |
| `querySensitive` | `boolean` | `false` | Include all present query params in the operation scope key |
| `seed.default` | `object` | — | Default response-shaped state for that operation |
| `seed.scopes` | `Record<string, object>` | `{}` | Explicit scope-keyed response-shaped state |
| `responseFake` | `'auto' \| 'off'` | inherits top-level | Per-operation override of the response-fake fallback policy |

`mode` applies only to non-CRUD operations. CRUD-claimed operations always use shared resource state.

### Custom Handler Contract

`handler` can be:

- an inline async function
- a module path like `'./handlers/startRelease.js'`

Module paths are resolved relative to the config file location. For direct `createApp()` usage without `loadConfig()`, relative handler paths resolve from `process.cwd()`.

The handler context exposes:

- `ctx.req`
- `ctx.state`
- `ctx.resources`
- `ctx.storage`
- `ctx.json(status, body, headers?)`
- `ctx.nextDefault()`

`ctx.nextDefault()` runs the built-in runtime once and returns its descriptor so you can wrap or replace it.

### Declarative Rules

`rules` is an ordered array. Stage 5 supports:

- predicates: `eq`, `exists`, `in`
- effects: `writeState`, `mergeState`, `patchResource`, `respond`
- refs from `req.params`, `req.query`, `req.body`, `state.current`, `state.default`, and `resource.current`

Example:

```js
operations: {
  updateRelease: {
    rules: [
      {
        name: 'preview-update',
        if: { eq: [{ ref: 'resource.current.status' }, 'draft'] },
        then: {
          writeState: {
            id: { ref: 'resource.current.id' },
            name: { ref: 'resource.current.name' },
            status: { ref: 'req.body.status' },
          },
          respond: {
            status: 200,
            body: { ref: 'state.current' },
          },
        },
      },
    ],
  },
}
```

Semantics:

- first matching rule wins
- missing refs do not throw; they make the predicate/effect path no-match
- `rules` without a match fall back to the built-in runtime
- `rules` plus `handler` without a match return an explicit runtime error
- `writeState` and `mergeState` write only current operation state
- `patchResource` may shallow-patch only the inferred linked CRUD resource item for the current route
- after `patchResource`, `resource.current` is the post-patch snapshot for later effects in the same rule
- if the linked resource item does not exist, the matched rule returns `404`

### Mode Semantics

- `auto`: keep operation state isolated unless the runtime can safely project into a parent resource
- `operation-state`: always isolate state per operation scope
- `resource-aware`: request projection into a parent resource; if the rule is unsatisfied at startup, Crudio warns and falls back to `operation-state`

### Scope Keys

Operation scope keys use `name=value` pairs joined by `&`, ordered alphabetically by parameter name, with values URL-encoded.

Examples:

- `id=1`
- `code=IT&locale=it`
- `code=IT&cityId=42`

An empty string scope key (`''`) is valid for path-less operations. When `querySensitive: true`, all present query params participate in the scope key.

## Response Fake Fallback

For non-CRUD operations, Crudio derives a fake response payload from the documented response schema at boot whenever:

- the operation is not CRUD-claimed and is not projection-eligible into a parent CRUD resource
- no explicit `seed.default` or `seed.scopes` is configured
- a canonical 2xx JSON response schema is present in the spec
- `responseFake` is `'auto'` (the default) — both top-level and per-operation

The generated payload is persisted as the operation's default state with an internal `origin: 'auto-fake'` marker. While that marker is in effect:

- `GET` returns the fake until a scoped write replaces it
- `POST` and `PUT` return the fake unchanged (no merge with `req.body`) and persist it as scope-specific state, so later reads on the same scope stay consistent
- `PATCH` returns the fake unchanged when the body is an array; for object bodies it still applies merge semantics

Set `responseFake: 'off'` either top-level or per-operation to keep the legacy behavior, where POST/PUT echo `req.body` merged with any configured default and GET returns `404` until something writes state.

Explicit `seed.default` or `seed.scopes` always wins — auto-fake never overrides an opinion the developer expressed in config.

## Seeding

CRUD resources use schema-driven fake generation. Non-CRUD operations use explicit response-shaped seed data.

CRUD seed precedence is:

1. `resources.<name>.seed`
2. top-level `seed.count`

Operation-state seeds come only from `operations.<key>.seed`.

`seed.strategy` is already accepted by config loading, but the current runtime still behaves like `config-first` for CRUD seeding. The named values reserved for that future policy are:

- `config-first`
- `examples-first`
- `fakes-only`

## Storage

Crudio stores CRUD resource state and operation state separately:

```text
data/
  _meta/
    registry.json
  resources/
    pets.json
    users.json
  operations/
    8d4d6b4a....json
```

- `resources/*.json` contains shared CRUD collections
- `operations/*.json` contains hashed operation-state buckets
- `_meta/registry.json` maps operation keys, methods, paths, and operationIds to stable storage entries
