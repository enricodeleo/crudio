import { describe, expect, it } from 'vitest';

async function loadSubject() {
  try {
    return await import('../../src/http/evaluateRulePredicate.js');
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
      count: 2,
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
      status: 'draft',
    },
  },
};

describe('evaluateRulePredicate', () => {
  it('evaluates eq predicates', async () => {
    const { evaluateRulePredicate } = await loadSubject();

    expect(typeof evaluateRulePredicate).toBe('function');
    expect(
      evaluateRulePredicate(
        { eq: [{ ref: 'req.body.status' }, 'started'] },
        context
      )
    ).toBe(true);
    expect(
      evaluateRulePredicate(
        { eq: [{ ref: 'req.body.status' }, 'draft'] },
        context
      )
    ).toBe(false);
  });

  it('evaluates exists predicates', async () => {
    const { evaluateRulePredicate } = await loadSubject();

    expect(typeof evaluateRulePredicate).toBe('function');
    expect(evaluateRulePredicate({ exists: { ref: 'state.current.token' } }, context)).toBe(true);
    expect(evaluateRulePredicate({ exists: { ref: 'state.current.missing' } }, context)).toBe(false);
  });

  it('evaluates in predicates', async () => {
    const { evaluateRulePredicate } = await loadSubject();

    expect(typeof evaluateRulePredicate).toBe('function');
    expect(
      evaluateRulePredicate(
        { in: [{ ref: 'req.body.status' }, ['draft', 'started']] },
        context
      )
    ).toBe(true);
    expect(
      evaluateRulePredicate(
        { in: [{ ref: 'req.body.status' }, ['draft', 'stopped']] },
        context
      )
    ).toBe(false);
  });

  it('treats missing refs inside predicates as no match instead of throwing', async () => {
    const { evaluateRulePredicate } = await loadSubject();

    expect(typeof evaluateRulePredicate).toBe('function');
    expect(
      evaluateRulePredicate(
        { eq: [{ ref: 'req.body.missing' }, 'started'] },
        context
      )
    ).toBe(false);
    expect(
      evaluateRulePredicate(
        { in: [{ ref: 'resource.current.missing' }, ['draft']] },
        context
      )
    ).toBe(false);
    expect(
      evaluateRulePredicate(
        { exists: { ref: 'resource.current.missing' } },
        context
      )
    ).toBe(false);
  });
});
