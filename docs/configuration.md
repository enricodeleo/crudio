# Configuration

## Zero Config

Crudio works with no configuration against any valid OpenAPI 3.x spec.

## CLI Flags

```bash
npx crudio ./openapi.yaml --port 8080 --seed 10
```

| Flag | Default | Description |
|------|---------|-------------|
| `--port, -p` | `3000` | Port to listen on |
| `--data-dir, -d` | `./data` | Directory for JSON storage |
| `--seed, -s` | — | Seed N fake records per resource |
| `--config, -c` | — | Path to config file |

CLI flags override config file values.

## Config File

Create `crudio.config.js` for persistent settings:

```js
export default {
  port: 3000,
  dataDir: './data',

  resources: {
    pets: {
      methods: ['list', 'getById'],
    },
    orders: {
      exclude: true,
    },
    users: {
      idParam: 'userId',
    },
  },

  seed: {
    count: 10,
    resources: {
      pets: 20,
      users: 5,
    },
  },
};
```

```bash
npx crudio ./openapi.yaml --config ./crudio.config.js
```

## Resource Overrides

| Option | Type | Description |
|--------|------|-------------|
| `methods` | `string[]` | Only expose these operations (`list`, `getById`, `create`, `update`, `patch`, `delete`) |
| `exclude` | `boolean` | Skip this resource entirely |
| `idParam` | `string` | Custom path parameter name for the ID |

## Seeding

Generate fake data from your schemas:

```bash
npx crudio ./openapi.yaml --seed 10
```

Schema-aware generation using `@faker-js/faker`:

| Schema | Generated Value |
|--------|----------------|
| `{ type: "string" }` | Random word |
| `{ type: "string", format: "email" }` | Email address |
| `{ type: "string", format: "uri" }` | URL |
| `{ type: "string", format: "uuid" }` | UUID v4 |
| `{ type: "string", format: "date-time" }` | ISO 8601 timestamp |
| `{ type: "string", enum: [...] }` | Random pick from enum |
| `{ type: "integer" }` | Random integer |
| `{ type: "number" }` | Random float |
| `{ type: "boolean" }` | Random boolean |
| `{ type: "array", items: {...} }` | 1–3 generated items |
| `{ type: "object", properties: {...} }` | Recursively generated |

Required properties are always generated. Optional properties have a ~50% chance of being included.

## Storage

Data is stored as JSON files, one per resource:

```
data/
  pets.json
  users.json
```

Format:

```json
{
  "items": [
    { "id": 1, "name": "Rex", "tag": "dog" }
  ]
}
```

Files are created on first write. Missing files are treated as empty collections.
