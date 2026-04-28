import { describe, expect, it } from 'vitest';

async function loadSubject() {
  try {
    return await import('../../src/http/resolveRuleRef.js');
  } catch {
    return {};
  }
}

const context = {
  req: {
    params: {
      id: '42',
    },
    query: {
      locale: 'it',
    },
    body: {
      status: 'started',
      nested: {
        enabled: true,
      },
    },
  },
  state: {
    current: {
      token: 'abc',
    },
    default: {
      token: 'fallback',
    },
  },
  resource: {
    current: {
      id: '42',
      status: 'draft',
    },
  },
};

describe('resolveRuleRef', () => {
  it('resolves req.params, req.query, and req.body paths', async () => {
    const { resolveRuleRef } = await loadSubject();

    expect(typeof resolveRuleRef).toBe('function');
    expect(resolveRuleRef({ ref: 'req.params.id' }, context)).toEqual({
      found: true,
      value: '42',
    });
    expect(resolveRuleRef({ ref: 'req.query.locale' }, context)).toEqual({
      found: true,
      value: 'it',
    });
    expect(resolveRuleRef({ ref: 'req.body.nested.enabled' }, context)).toEqual({
      found: true,
      value: true,
    });
  });

  it('resolves state.current and state.default paths', async () => {
    const { resolveRuleRef } = await loadSubject();

    expect(typeof resolveRuleRef).toBe('function');
    expect(resolveRuleRef({ ref: 'state.current.token' }, context)).toEqual({
      found: true,
      value: 'abc',
    });
    expect(resolveRuleRef({ ref: 'state.default.token' }, context)).toEqual({
      found: true,
      value: 'fallback',
    });
  });

  it('resolves resource.current paths', async () => {
    const { resolveRuleRef } = await loadSubject();

    expect(typeof resolveRuleRef).toBe('function');
    expect(resolveRuleRef({ ref: 'resource.current.status' }, context)).toEqual({
      found: true,
      value: 'draft',
    });
  });

  it('returns a not-found sentinel for missing refs', async () => {
    const { resolveRuleRef } = await loadSubject();

    expect(typeof resolveRuleRef).toBe('function');
    expect(resolveRuleRef({ ref: 'req.body.missing' }, context)).toEqual({
      found: false,
      value: undefined,
    });
    expect(resolveRuleRef({ ref: 'resource.current.missing' }, context)).toEqual({
      found: false,
      value: undefined,
    });
  });
});
