import { describe, it, expect } from 'vitest';
import { buildScopeKey } from '../../src/operations/scopeKey.js';

describe('buildScopeKey', () => {
  it('sorts scope names alphabetically and url-encodes values', () => {
    expect(buildScopeKey({ cityId: '42', code: 'IT/it', locale: undefined })).toBe(
      'cityId=42&code=IT%2Fit'
    );
  });

  it('includes all present query params when the caller passes them in', () => {
    expect(buildScopeKey({ code: 'IT', view: 'compact', locale: 'it' })).toBe(
      'code=IT&locale=it&view=compact'
    );
  });
});
