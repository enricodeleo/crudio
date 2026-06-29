#!/usr/bin/env bash
#
# Crudio demo — records the "stateful mock backend" story in ~30 seconds.
#
# Record a GIF:
#   1. brew install asciinema agg          # or: pip install asciinema
#   2. asciinema rec demo.cast -c "./scripts/demo.sh"
#   3. agg --theme monokai demo.cast docs/demo.gif
#
# Then put  ![demo](docs/demo.gif)  at the top of the README.
#
# Tip: set a small terminal (≈90x26) and a clean prompt before recording.

set -euo pipefail

PORT=4399
SPEC="$(mktemp -t crudio-petstore-XXXX).yaml"
DATA_DIR="$(mktemp -d -t crudio-data-XXXX)"
BASE="http://localhost:${PORT}"

# Pretty "someone is typing" helper.
TYPE_SPEED=0.018
prompt() { printf '\033[1;32m$\033[0m '; }
type_out() {
  local s="$1"
  for ((i = 0; i < ${#s}; i++)); do
    printf '%s' "${s:i:1}"
    sleep "$TYPE_SPEED"
  done
  printf '\n'
}
run() { prompt; type_out "$1"; sleep 0.35; eval "$1"; echo; sleep 0.9; }
show() { prompt; type_out "$1"; sleep 0.6; }   # types a command for the camera, does not run it
say() { printf '\033[1;36m# %s\033[0m\n' "$1"; sleep 0.7; }

cleanup() { kill "${SERVER_PID:-}" 2>/dev/null || true; rm -f "$SPEC"; rm -rf "$DATA_DIR"; }
trap cleanup EXIT

# A tiny pet store spec (enum-validated tag, integer ids).
cat > "$SPEC" <<'YAML'
openapi: "3.0.3"
info: { title: Petstore, version: "1.0" }
paths:
  /pets:
    get:  { operationId: listPets,  responses: { "200": { description: ok, content: { application/json: { schema: { type: array, items: { $ref: "#/components/schemas/Pet" } } } } } } }
    post: { operationId: createPet, requestBody: { required: true, content: { application/json: { schema: { $ref: "#/components/schemas/NewPet" } } } }, responses: { "201": { description: ok, content: { application/json: { schema: { $ref: "#/components/schemas/Pet" } } } } } }
  /pets/{petId}:
    patch:  { operationId: patchPet,  parameters: [{ name: petId, in: path, required: true, schema: { type: integer } }], requestBody: { required: true, content: { application/json: { schema: { $ref: "#/components/schemas/Pet" } } } }, responses: { "200": { description: ok, content: { application/json: { schema: { $ref: "#/components/schemas/Pet" } } } } } }
    delete: { operationId: deletePet, parameters: [{ name: petId, in: path, required: true, schema: { type: integer } }], responses: { "204": { description: gone } } }
components:
  schemas:
    NewPet: { type: object, required: [name], properties: { name: { type: string }, tag: { type: string, enum: [dog, cat, bird] } } }
    Pet:    { allOf: [{ $ref: "#/components/schemas/NewPet" }, { type: object, required: [id], properties: { id: { type: integer } } }] }
YAML

clear
say "One OpenAPI spec in. A real, stateful backend out."
show "npx crudio ./petstore.yaml --port ${PORT}"   # shown to the viewer; the real server starts below
# Start the real server (kept silent so the GIF stays clean).
node "$(dirname "$0")/../bin/crudio.js" "$SPEC" --port "$PORT" --data-dir "$DATA_DIR" >/dev/null 2>&1 &
SERVER_PID=$!
sleep 2

say "Create a pet — it gets an id from the spec."
run "curl -s --json '{\"name\":\"Rex\",\"tag\":\"dog\"}' ${BASE}/pets"

say "Send a bad enum — validated against your schema, rejected."
run "curl -s --json '{\"name\":\"Rex\",\"tag\":\"dragon\"}' ${BASE}/pets"

say "List pets — Rex is still there. This is the part Prism can't do."
run "curl -s ${BASE}/pets"

say "Partial update with PATCH..."
run "curl -s -X PATCH --json '{\"tag\":\"cat\"}' ${BASE}/pets/1"

say "Delete it..."
run "curl -s -o /dev/null -w '%{http_code}\\n' -X DELETE ${BASE}/pets/1"

say "...and now it's a real 404. State, end to end."
run "curl -s -o /dev/null -w '%{http_code}\\n' ${BASE}/pets/1"

say "No database. No handlers. Just your contract."
sleep 1.5
