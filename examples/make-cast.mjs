// Generates examples/demo.cast — a real asciinema v2 recording of the Crudio demo.
// Boots the bundled spec, captures live HTTP output, and lays it on an animated
// timeline (typed commands + pauses). No interactive terminal required.
//
//   node examples/make-cast.mjs
//   asciinema play examples/demo.cast        # preview locally
//   asciinema upload examples/demo.cast      # publish a badge for the README
//   agg examples/demo.cast examples/demo.gif # or render an inline GIF
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4755;
const BASE = `http://localhost:${PORT}`;
const DATA = `/tmp/crudio-cast-${PORT}`;

const srv = spawn('node', [
  join(ROOT, 'bin/crudio.js'), join(ROOT, 'test/fixtures/petstore.yaml'),
  '--port', String(PORT), '--seed', '3', '--data-dir', DATA,
], { stdio: 'ignore' });

const text = async (p, opts) => (await fetch(BASE + p, opts)).text();
for (let i = 0; i < 60; i++) { try { if ((await fetch(`${BASE}/_crudio/health`)).ok) break; } catch {} await sleep(300); }

const post = (body) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body });
const pets = await text('/pets');
const created = await text('/pets', post('{"name":"Rex","tag":"dog"}'));
const got = await text('/pets/4');
const bad = await text('/pets', post('{"tag":"dog"}'));
srv.kill();

const G = '[32m', C = '[36m', D = '[90m', R = '[0m';
const events = [];
let t = 0;
const emit = (s) => events.push([Number(t.toFixed(3)), 'o', s]);
const typeCmd = (cmd) => { emit(`${G}➜${R}  ${C}crudio${R} `); for (const ch of cmd) { t += 0.045; emit(ch); } t += 0.35; emit('\r\n'); };
const out = (s, pre = 0.5) => { t += pre; emit(s.replace(/\n/g, '\r\n')); };
const note = (s) => { t += 0.25; emit(`${D}# ${s}${R}\r\n`); };
const beat = (s = 0.9) => { t += s; emit('\r\n'); };

typeCmd('npx @enricodeleo/crudio ./openapi.yaml --seed 3');
out('Crudio running on port 3000\r\n', 0.9); beat();
typeCmd('curl -s localhost:3000/pets');
out(pets + '\r\n'); note('3 seeded records — schema-shaped, real IDs'); beat();
typeCmd(`curl -s -XPOST localhost:3000/pets -d '{"name":"Rex","tag":"dog"}'`);
out(created + '\r\n'); note('persisted — next id, written to disk'); beat();
typeCmd('curl -s localhost:3000/pets/4');
out(got + '\r\n'); note('still there on the next request'); beat();
typeCmd(`curl -s -XPOST localhost:3000/pets -d '{"tag":"dog"}'`);
out(bad + '\r\n'); note('rejected — `name` is required by your schema'); t += 1.5;

const header = { version: 2, width: 118, height: 22, timestamp: Math.floor(Date.now() / 1000), env: { SHELL: '/bin/zsh', TERM: 'xterm-256color' }, title: 'Crudio — OpenAPI spec to stateful backend' };
writeFileSync(join(ROOT, 'examples/demo.cast'), [JSON.stringify(header), ...events.map((e) => JSON.stringify(e))].join('\n') + '\n');
console.log(`wrote examples/demo.cast — ${events.length} events, ${t.toFixed(1)}s`);
console.log('preview:', JSON.stringify({ pets: JSON.parse(pets).length + ' pets', created: JSON.parse(created), bad: JSON.parse(bad) }));
