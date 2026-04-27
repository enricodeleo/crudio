import { describe, expect, it } from 'vitest';
import { loadCustomHandler, StartupConfigurationError } from '../../src/http/loadCustomHandler.js';
import { join } from 'node:path';

const FIXTURE_BASE_DIR = join(import.meta.dirname, '..', 'fixtures');

describe('loadCustomHandler', () => {
  it('returns null when no handler is configured', async () => {
    expect(await loadCustomHandler(undefined, process.cwd())).toBeNull();
    expect(await loadCustomHandler(null, process.cwd())).toBeNull();
  });

  it('returns inline handlers unchanged', async () => {
    const inline = async () => ({ status: 200, body: { ok: true }, headers: {} });
    expect(await loadCustomHandler(inline, process.cwd())).toBe(inline);
  });

  it('throws on invalid configured handler types', async () => {
    await expect(loadCustomHandler(42, process.cwd())).rejects.toBeInstanceOf(
      StartupConfigurationError
    );
  });

  it('loads a module handler relative to the provided base dir', async () => {
    const handler = await loadCustomHandler('./handlers/loginHandler.js', FIXTURE_BASE_DIR);
    expect(typeof handler).toBe('function');
  });

  it('throws when the module has no default function export', async () => {
    await expect(loadCustomHandler('./handlers/invalidExport.js', FIXTURE_BASE_DIR)).rejects.toBeInstanceOf(
      StartupConfigurationError
    );
  });

  it('throws when the module path cannot be imported', async () => {
    await expect(loadCustomHandler('./handlers/missingHandler.js', FIXTURE_BASE_DIR)).rejects.toBeInstanceOf(
      StartupConfigurationError
    );
  });
});
