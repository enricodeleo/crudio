#!/usr/bin/env bash
# Crudio demo — boots the bundled petstore spec, then walks a stateful CRUD round-trip.
#
# Use it as a quick sanity check, or record the README asciinema with it:
#   asciinema rec -c "bash examples/demo.sh" crudio-demo.cast
#   # then upload: asciinema upload crudio-demo.cast
#
# Runs entirely offline against the local build (no npx fetch noise in the cast).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-3000}"
WORK="$(mktemp -d)"
PID=""
trap 'kill "$PID" 2>/dev/null || true; rm -rf "$WORK"' EXIT

cp "$ROOT/test/fixtures/petstore.yaml" "$WORK/openapi.yaml"
cd "$WORK"

printf '$ crudio ./openapi.yaml --seed 3\n'
node "$ROOT/bin/crudio.js" ./openapi.yaml --port "$PORT" --seed 3 >/dev/null 2>&1 &
PID=$!
until curl -sf "http://localhost:$PORT/_crudio/health" >/dev/null 2>&1; do sleep 0.3; done
printf 'Crudio running on port %s\n' "$PORT"

# Print the command as if typed, pause for readability, then run it.
run() { printf '\n$ %s\n' "$1"; sleep 0.6; eval "$1"; echo; sleep 0.9; }

run "curl -s localhost:$PORT/pets"
run "curl -s -XPOST localhost:$PORT/pets -H content-type:application/json -d '{\"name\":\"Rex\",\"tag\":\"dog\"}'"
run "curl -s localhost:$PORT/pets/4"
run "curl -s -XPOST localhost:$PORT/pets -H content-type:application/json -d '{\"tag\":\"dog\"}'"
