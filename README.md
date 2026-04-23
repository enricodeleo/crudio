# Crudio

Turn an OpenAPI 3.x specification into a working, stateful CRUD backend.

## Install

```bash
npm install -g crudio
```

## Usage

```bash
crudio ./openapi.yaml [options]
```

### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--port, -p` | `3000` | Port to listen on |
| `--data-dir, -d` | `./data` | Directory for JSON storage |
| `--seed, -s` | — | Seed N records per resource |
| `--config, -c` | — | Path to config file |

### Quick Start

```bash
# Install and run against any OpenAPI 3.x spec
npx crudio ./petstore.yaml

# With seeding
npx crudio ./petstore.yaml --seed 10

# Custom port and data directory
npx crudio ./petstore.yaml --port 8080 --data-dir /tmp/crudio-data
```

## How It Works

1. Loads and dereferences your OpenAPI 3.x spec
2. Discovers CRUD resources from path patterns (`/users` + `/users/{id}`)
3. Generates JSON Schema validators from the spec
4. Registers Express routes for each CRUD operation
5. Persists data to JSON files (one per resource)

## What Crudio Is

- Contract-first — implements only what the spec defines
- Stateful — data persists in JSON files
- Validated — requests are checked against the schema
- Predictable — no inferred behavior, no magic

## What Crudio Is Not

- A mock server with static responses
- A full backend framework
- A replacement for business logic

## Supported OpenAPI Features

- OpenAPI 3.0 and 3.1
- `$ref` resolution
- `allOf` schema merging
- Path parameter detection
- Basic query params (`limit`, `offset`, equality filters)

## Unsupported (v1)

- `oneOf`, `anyOf`, discriminators
- Swagger 2.0
- Authentication / authorization
- Complex query engines

## License

MIT
