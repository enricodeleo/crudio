export function parseArgs(argv) {
  const parsed = { specPath: argv[0] };

  for (let i = 1; i < argv.length; i++) {
    switch (argv[i]) {
      case '--port':
      case '-p':
        parsed.port = parseInt(argv[++i], 10);
        break;
      case '--data-dir':
      case '-d':
        parsed.dataDir = argv[++i];
        break;
      case '--seed':
      case '-s':
        parsed.seed = parseInt(argv[++i], 10);
        break;
      case '--config':
      case '-c':
        parsed.config = argv[++i];
        break;
    }
  }

  return parsed;
}
