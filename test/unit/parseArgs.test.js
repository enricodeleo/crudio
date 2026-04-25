import { describe, it, expect } from 'vitest';
import { parseArgs } from '../../src/cli/parseArgs.js';

describe('parseArgs', () => {
  it('maps --seed to parsed.seed only', () => {
    expect(parseArgs(['./spec.yaml', '--seed', '5'])).toEqual({
      specPath: './spec.yaml',
      seed: 5,
    });
  });

  it('parses the remaining supported CLI flags', () => {
    expect(
      parseArgs([
        './spec.yaml',
        '--port',
        '8080',
        '--data-dir',
        './tmp/data',
        '--config',
        './crudio.config.js',
      ])
    ).toEqual({
      specPath: './spec.yaml',
      port: 8080,
      dataDir: './tmp/data',
      config: './crudio.config.js',
    });
  });
});
