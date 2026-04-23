import { describe, it, expect } from 'vitest';
import { loadConfig } from '../../src/config.js';

describe('loadConfig', () => {
  it('returns defaults with no args', () => {
    const config = loadConfig({ specPath: './spec.yaml' });
    expect(config.specPath).toBe('./spec.yaml');
    expect(config.port).toBe(3000);
    expect(config.dataDir).toBe('./data');
    expect(config.seed).toBeUndefined();
    expect(config.resources).toEqual({});
  });

  it('overrides defaults with CLI args', () => {
    const config = loadConfig({
      specPath: './api.yaml',
      port: 8080,
      dataDir: '/tmp/data',
      seed: 10,
    });
    expect(config.port).toBe(8080);
    expect(config.dataDir).toBe('/tmp/data');
    expect(config.seed).toBe(10);
  });

  it('merges config file when provided', async () => {
    const { writeFileSync, mkdirSync, rmSync } = await import('node:fs');
    const { join } = await import('node:path');
    const tmpDir = join(import.meta.dirname, '..', 'tmp-config');
    mkdirSync(tmpDir, { recursive: true });
    const configFile = join(tmpDir, 'crudio.config.js');
    writeFileSync(
      configFile,
      `export default { port: 9090, resources: { pets: { methods: ['list'] } } };`
    );
    try {
      const config = await loadConfig({
        specPath: './spec.yaml',
        config: configFile,
      });
      expect(config.port).toBe(9090);
      expect(config.resources.pets.methods).toEqual(['list']);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
