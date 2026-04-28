import { describe, it, expect } from 'vitest';
import { loadConfig } from '../../src/config.js';
import { loadCustomHandler } from '../../src/http/loadCustomHandler.js';

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
    expect(config.handlerBaseDir).toBe(process.cwd());
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

  it('preserves inline handlers and records the config directory as handlerBaseDir', async () => {
    const { writeFileSync, mkdirSync, rmSync } = await import('node:fs');
    const { join } = await import('node:path');
    const tmpDir = join(import.meta.dirname, '..', 'tmp-handler-config');
    mkdirSync(tmpDir, { recursive: true });
    const configFile = join(tmpDir, 'crudio.config.js');
    writeFileSync(
      configFile,
      `
      export default {
        operations: {
          'POST /sessions': {
            handler: async () => ({ status: 200, body: { ok: true }, headers: {} }),
          },
          'GET /sessions': {
            handler: './handlers/loginHandler.js',
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

      expect(typeof config.operations['POST /sessions'].handler).toBe('function');
      expect(config.operations['GET /sessions'].handler).toBe('./handlers/loginHandler.js');
      expect(config.handlerBaseDir).toBe(tmpDir);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('resolves a relative config path from the current working directory', async () => {
    const { writeFileSync, mkdirSync, rmSync } = await import('node:fs');
    const { join, relative, resolve } = await import('node:path');
    const tmpDir = join(import.meta.dirname, '..', 'tmp-relative-config');
    const handlersDir = join(tmpDir, 'handlers');
    mkdirSync(tmpDir, { recursive: true });
    mkdirSync(handlersDir, { recursive: true });
    const configFile = join(tmpDir, 'crudio.config.js');
    const handlerFile = join(handlersDir, 'loginHandler.js');
    writeFileSync(
      handlerFile,
      `
      export default async function loginHandler() {
        return { status: 200, body: { token: 'relative-config-token' }, headers: {} };
      }
      `
    );
    writeFileSync(
      configFile,
      `
      export default {
        port: 3210,
        operations: {
          login: {
            handler: './handlers/loginHandler.js',
          },
        },
      };
      `
    );
    try {
      const config = await loadConfig({
        specPath: './spec.yaml',
        config: relative(process.cwd(), configFile),
      });
      const handler = await loadCustomHandler(
        config.operations.login.handler,
        config.handlerBaseDir
      );

      expect(config.port).toBe(3210);
      expect(config.operations.login.handler).toBe('./handlers/loginHandler.js');
      expect(config.handlerBaseDir).toBe(resolve(tmpDir));
      await expect(handler()).resolves.toEqual({
        status: 200,
        body: { token: 'relative-config-token' },
        headers: {},
      });
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('normalizes Stage 2 operation config fields from a config file', async () => {
    const { writeFileSync, mkdirSync, rmSync } = await import('node:fs');
    const { join } = await import('node:path');
    const tmpDir = join(import.meta.dirname, '..', 'tmp-operation-config');
    mkdirSync(tmpDir, { recursive: true });
    const configFile = join(tmpDir, 'crudio.config.js');
    writeFileSync(
      configFile,
      `
      export default {
        operations: {
          'GET /countries/{code}/summary': {
            querySensitive: true,
            seed: {
              default: { status: 'unavailable' },
              scopes: {
                'code=IT&locale=it': { code: 'IT', status: 'ready' },
              },
            },
          },
          'POST /sessions': {},
        },
      };
      `
    );
    try {
      const config = await loadConfig({
        specPath: './spec.yaml',
        config: configFile,
      });

      expect(config.operations['GET /countries/{code}/summary']).toEqual({
        enabled: true,
        mode: 'auto',
        querySensitive: true,
        seed: {
          default: { status: 'unavailable' },
          scopes: {
            'code=IT&locale=it': { code: 'IT', status: 'ready' },
          },
        },
      });
      expect(config.operations['POST /sessions']).toEqual({
        enabled: true,
        mode: 'auto',
        querySensitive: false,
        seed: {
          default: undefined,
          scopes: {},
        },
      });
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('preserves explicit operation overrides and unrelated fields during normalization', async () => {
    const { writeFileSync, mkdirSync, rmSync } = await import('node:fs');
    const { join } = await import('node:path');
    const tmpDir = join(import.meta.dirname, '..', 'tmp-operation-overrides');
    mkdirSync(tmpDir, { recursive: true });
    const configFile = join(tmpDir, 'crudio.config.js');
    writeFileSync(
      configFile,
      `
      export default {
        operations: {
          'GET /countries/{code}/summary': {
            enabled: false,
            mode: 'resource-aware',
            handler: './handlers/country-summary.js',
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

      expect(config.operations['GET /countries/{code}/summary']).toEqual({
        enabled: false,
        mode: 'resource-aware',
        handler: './handlers/country-summary.js',
        querySensitive: false,
        seed: {
          default: undefined,
          scopes: {},
        },
      });
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('normalizes declarative rules and allows them to coexist with handlers at config load time', async () => {
    const { writeFileSync, mkdirSync, rmSync } = await import('node:fs');
    const { join } = await import('node:path');
    const tmpDir = join(import.meta.dirname, '..', 'tmp-rules-config');
    mkdirSync(tmpDir, { recursive: true });
    const configFile = join(tmpDir, 'crudio.config.js');
    writeFileSync(
      configFile,
      `
      export default {
        operations: {
          startRelease: {
            handler: './handlers/startRelease.js',
            rules: [
              {
                name: 'start',
                if: { eq: [{ ref: 'req.body.action' }, 'start'] },
                then: {
                  writeState: {
                    status: { ref: 'req.body.action' },
                  },
                  respond: {
                    status: 200,
                    body: {
                      status: { ref: 'req.body.action' },
                    },
                  },
                },
              },
            ],
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

      expect(config.operations.startRelease).toEqual({
        enabled: true,
        mode: 'auto',
        handler: './handlers/startRelease.js',
        querySensitive: false,
        rules: [
          {
            name: 'start',
            if: { eq: [{ ref: 'req.body.action' }, 'start'] },
            then: {
              writeState: {
                status: { ref: 'req.body.action' },
              },
              respond: {
                status: 200,
                body: {
                  status: { ref: 'req.body.action' },
                },
              },
            },
          },
        ],
        seed: {
          default: undefined,
          scopes: {},
        },
      });
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
