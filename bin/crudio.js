#!/usr/bin/env node

import { createApp } from '../src/app.js';
import { parseArgs } from '../src/cli/parseArgs.js';
import { loadConfig } from '../src/config.js';

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: crudio <spec-file> [options]

Options:
  --port, -p <number>      Port to listen on (default: 3000)
  --data-dir, -d <path>    Directory for JSON storage (default: ./data)
  --seed, -s <number>      Seed N records per resource
  --config, -c <path>      Path to config file
  --help, -h               Show this help
`);
  process.exit(0);
}

function toLegacySeedPerResource(resources) {
  return Object.fromEntries(
    Object.entries(resources)
      .filter(([, config]) => config.seed?.count !== undefined)
      .map(([resourceName, config]) => [resourceName, config.seed.count])
  );
}

async function main() {
  const parsed = parseArgs(args);
  const config = await loadConfig(parsed);

  const app = await createApp({
    specPath: config.specPath,
    dataDir: config.dataDir,
    resources: config.resources,
    seed: config.seed.count,
    seedPerResource: toLegacySeedPerResource(config.resources),
  });

  const server = app.listen(config.port, () => {
    console.log(`Crudio running on port ${config.port}`);
    console.log(`Spec: ${config.specPath}`);
    console.log(`Data: ${config.dataDir}`);
  });

  const shutdown = (reason) => {
    if (reason) console.log(`\n${reason}. Shutting down.`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  };

  process.on('SIGINT', () => shutdown('Received SIGINT'));
  process.on('SIGTERM', () => shutdown('Received SIGTERM'));

  const parentPid = process.ppid;
  setInterval(() => {
    if (process.ppid !== parentPid) shutdown('Parent process exited');
  }, 1000).unref();
}

main().catch((err) => {
  console.error('Failed to start Crudio:', err.message);
  process.exit(1);
});
