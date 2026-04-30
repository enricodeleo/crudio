import { describe, expect, it } from 'vitest';

async function loadSubject() {
  try {
    return await import('../../src/http/normalizeDeclarativeRules.js');
  } catch {
    return {};
  }
}

describe('normalizeDeclarativeRules', () => {
  it('returns undefined when rules are omitted', async () => {
    const { normalizeDeclarativeRules } = await loadSubject();

    expect(typeof normalizeDeclarativeRules).toBe('function');
    expect(normalizeDeclarativeRules(undefined)).toBeUndefined();
  });

  it('preserves valid rules in order', async () => {
    const { normalizeDeclarativeRules } = await loadSubject();
    const rules = [
      {
        name: 'first',
        if: { exists: { ref: 'req.body.status' } },
        then: {
          writeState: {
            status: { ref: 'req.body.status' },
          },
          respond: {
            status: 200,
            body: {
              status: { ref: 'req.body.status' },
            },
          },
        },
      },
      {
        name: 'second',
        then: {
          patchResource: {
            status: 'started',
          },
          mergeState: {
            count: 1,
          },
          respond: {
            status: 202,
            body: {
              accepted: true,
            },
          },
        },
      },
    ];

    expect(typeof normalizeDeclarativeRules).toBe('function');
    expect(normalizeDeclarativeRules(rules)).toEqual(rules);
  });

  it('throws when a rule is missing then', async () => {
    const { normalizeDeclarativeRules } = await loadSubject();

    expect(typeof normalizeDeclarativeRules).toBe('function');
    expect(() =>
      normalizeDeclarativeRules([
        {
          name: 'broken',
          if: { exists: { ref: 'req.body.status' } },
        },
      ])
    ).toThrow(/then/i);
  });

  it('throws when a rule uses an unknown predicate', async () => {
    const { normalizeDeclarativeRules } = await loadSubject();

    expect(typeof normalizeDeclarativeRules).toBe('function');
    expect(() =>
      normalizeDeclarativeRules([
        {
          name: 'broken',
          if: { gt: [{ ref: 'req.body.count' }, 1] },
          then: {
            respond: {
              status: 200,
              body: {
                ok: true,
              },
            },
          },
        },
      ])
    ).toThrow(/predicate/i);
  });

  it('throws when a rule uses an unknown effect', async () => {
    const { normalizeDeclarativeRules } = await loadSubject();

    expect(typeof normalizeDeclarativeRules).toBe('function');
    expect(() =>
      normalizeDeclarativeRules([
        {
          name: 'broken',
          then: {
            deleteResource: {
              status: 'started',
            },
            respond: {
              status: 200,
              body: {
                ok: true,
              },
            },
          },
        },
      ])
    ).toThrow(/effect/i);
  });
});
