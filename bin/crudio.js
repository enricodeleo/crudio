#!/usr/bin/env node

import { createApp } from '../src/app.js';
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

function parseArgs(args) {
  const result = { specPath: args[0] };
  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '--port':
      case '-p':
        result.port = parseInt(args[++i], 10);
        break;
      case '--data-dir':
      case '-d':
        result.dataDir = args[++i];
        break;
      case '--seed':
      case '-s':
        result.seed = parseInt(args[++i], 10);
        break;
      case '--config':
      case '-c':
        result.config = args[++i];
        break;
    }
  }
  return result;
}

async function main() {
  const parsed = parseArgs(args);
  const config = await loadConfig(parsed);

  const app = await createApp({
    specPath: config.specPath,
    dataDir: config.dataDir,
    resources: config.resources,
  });

  app.listen(config.port, () => {
    console.log(`Crudio running on port ${config.port}`);
    console.log(`Spec: ${config.specPath}`);
    console.log(`Data: ${config.dataDir}`);
  });
}

main().catch((err) => {
  console.error('Failed to start Crudio:', err.message);
  process.exit(1);
});
