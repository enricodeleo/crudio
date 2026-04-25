import { describe, it, expect } from 'vitest';
import { loadConfig } from '../../src/config.js';

describe('loadConfig', () => {
  it('returns defaults with no args', async () => {
    const config = await loadConfig({ specPath: './spec.yaml' });
    expect(config.specPath).toBe('./spec.yaml');
    expect(config.port).toBe(3000);
    expect(config.dataDir).toBe('./data');
    expect(config.seed).toEqual({
      strategy: 'config-first',
      count: undefined,
    });
    expect(config.resources).toEqual({});
    expect(config.operations).toEqual({});
    expect(config.validateResponses).toBe('warn');
  });

  it('overrides defaults with CLI args', async () => {
    const config = await loadConfig({
      specPath: './api.yaml',
      port: 8080,
      dataDir: '/tmp/data',
      seed: 10,
    });
    expect(config.port).toBe(8080);
    expect(config.dataDir).toBe('/tmp/data');
    expect(config.seed).toEqual({
      strategy: 'config-first',
      count: 10,
    });
  });

  it('merges config file when provided', async () => {
    const { writeFileSync, mkdirSync, rmSync } = await import('node:fs');
    const { join } = await import('node:path');
    const tmpDir = join(import.meta.dirname, '..', 'tmp-config');
    mkdirSync(tmpDir, { recursive: true });
    const configFile = join(tmpDir, 'crudio.config.js');
    writeFileSync(
      configFile,
      `
      export default {
        port: 9090,
        seed: {
          count: 10,
          strategy: 'config-first',
        },
        validateResponses: 'warn',
        resources: {
          posts: {
            foreignKeys: {
              authorId: 'users',
            },
            seed: {
              count: 3,
            },
          },
          pets: {
            methods: ['list'],
          },
        },
        operations: {
          'GET /pets': {
            enabled: true,
          },
        },
      };
      `
    );
    try {
      const config = await loadConfig({
        specPath: './spec.yaml',
        config: configFile,
      });
      expect(config.port).toBe(9090);
      expect(config.resources.posts.foreignKeys.authorId).toBe('users');
      expect(config.resources.posts.seed.count).toBe(3);
      expect(config.resources.pets.methods).toEqual(['list']);
      expect(config.operations['GET /pets'].enabled).toBe(true);
      expect(config.seed.count).toBe(10);
      expect(config.validateResponses).toBe('warn');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
