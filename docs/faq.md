# FAQ: Crudio vs. Prism, json-server, Mockoon, WireMock

Short answers to the questions people ask most. The recurring theme: most mock
tools are either **spec-driven** or **stateful**, rarely both. Crudio is the
overlap.

## How is this different from Stoplight Prism?

Prism is excellent and it's the closest comparison — both read an OpenAPI spec
and serve it. The difference is **state**.

Prism is [stateless by design](https://docs.stoplight.io/docs/prism/83dbbd75532cf-http-mocking).
Every request is answered independently from the schema/examples, so:

```
POST /pets {"name":"Rex"}   → 201 {"id": 1, "name": "Rex"}
GET  /pets                  → returns example data — your Rex is NOT there
DELETE /pets/1              → 204, but nothing was actually deleted
GET  /pets/1               → still 200, never a real 404
```

Crudio persists. The same sequence creates Rex, lists Rex, deletes Rex, then
returns a genuine `404`. That's what lets you test pagination, optimistic UI
updates, delete-then-refetch, and partial `PATCH` flows — the things that
actually break frontends.

**Use Prism instead of Crudio if** you only need spec-compliant canned
responses (contract smoke tests, content negotiation, a quick stub for a
single call). It's lighter and more mature for that. **Reach for Crudio when**
the thing you're testing depends on what happened in the previous request.

## Isn't this just json-server?

json-server is stateful and persists to disk — but it's **not spec-driven**.
You point it at a `db.json`, and it infers routes from your data. That means:

- no OpenAPI as the source of truth (your mock and your contract can drift)
- no request validation — it'll happily store `{"tag": "dragon"}` when your
  schema says `enum: [dog, cat, bird]`
- no schema-driven ID strategy (integer vs UUID vs string per your spec)

Crudio derives everything — routes, ID types, validation, list/wrapper response
shapes — from the contract itself. If you don't have a spec, json-server is the
simpler tool. If your spec *is* the source of truth, Crudio keeps the mock
honest to it.

## What about Mockoon? It imports OpenAPI and has CRUD routes.

It does, but they're separate features. Mockoon's
[OpenAPI import creates **stateless** routes](https://mockoon.com/docs/latest/openapi/import-export-openapi-format/);
its [stateful CRUD routes + data buckets](https://mockoon.com/docs/latest/api-endpoints/crud-routes/)
are a manual conversion you do afterward in the GUI, and that state is
**in-memory only — it resets on restart**. Crudio goes spec → stateful CRUD in
one command, and persists to disk by default. Mockoon wins on GUI ergonomics
and templating; Crudio wins on "zero manual wiring from the contract."

## How does it compare to WireMock?

WireMock is a powerful, mature stubbing/service-virtualization tool with
stateful **scenarios** — but you build those stubs and state transitions by
hand (and it's JVM-centric). Crudio is the opposite trade: no hand-written
stubs, the behavior falls out of your OpenAPI document automatically. Different
jobs — WireMock for fine-grained, scripted edge cases; Crudio for "make my
whole spec behave like a real backend, now."

## At a glance

| | From OpenAPI spec | Stateful CRUD | Request validation | Setup |
| --- | --- | --- | --- | --- |
| **Crudio** | ✅ | ✅ persists to disk | ✅ from schema | one command |
| Prism | ✅ | ❌ stateless by design | ✅ | one command |
| json-server | ❌ uses a `db.json` | ✅ persists to disk | ❌ | needs a data file |
| Mockoon | ⚠️ import is stateless | ✅ in-memory, resets | ❌ | manual CRUD wiring |
| WireMock | ❌ | ✅ via scenarios | partial | manual stubs |

## What does Crudio deliberately NOT do?

Honesty matters more than coverage here:

- **Not a production backend** and not for load testing.
- **No `oneOf` / `anyOf` / discriminators (v1).** It fails fast with a clear
  error rather than guessing wrong.
- **No Swagger 2.0**, no sorting/nested filters/full-text search, no
  multipart/file uploads yet.
- **No domain logic inference.** For real behavior beyond CRUD, you drop in
  [declarative rules](../README.md#declarative-rules) or a
  [JS handler](../README.md#custom-handlers).

If your spec leans on the unsupported features above, Crudio will tell you up
front instead of silently misbehaving.
