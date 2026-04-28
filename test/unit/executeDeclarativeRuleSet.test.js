import { describe, expect, it, vi } from 'vitest';

async function loadSubject() {
  try {
    return await import('../../src/http/executeDeclarativeRuleSet.js');
  } catch {
    return {};
  }
}

function createState(overrides = {}) {
  return {
    get: vi.fn().mockResolvedValue(null),
    getDefault: vi.fn().mockResolvedValue(null),
    setDescriptor: vi.fn().mockResolvedValue(),
    ...overrides,
  };
}

const operation = {
  key: 'POST /countries/{code}/summary',
  canonicalResponse: {
    status: 200,
  },
};

const req = {
  params: { code: 'IT' },
  query: {},
  body: { status: 'ready' },
  headers: {},
};

describe('executeDeclarativeRuleSet', () => {
  it('returns the first matching rule only', async () => {
    const { executeDeclarativeRuleSet } = await loadSubject();
    const state = createState();

    expect(typeof executeDeclarativeRuleSet).toBe('function');
    const result = await executeDeclarativeRuleSet({
      operation,
      req,
      rules: [
        {
          name: 'first',
          if: { exists: { ref: 'req.body.status' } },
          then: {
            respond: {
              status: 201,
              body: { winner: 'first' },
            },
          },
        },
        {
          name: 'second',
          then: {
            respond: {
              status: 202,
              body: { winner: 'second' },
            },
          },
        },
      ],
      state,
      resourceCurrent: null,
    });

    expect(result.matched).toBe(true);
    expect(result.descriptor).toEqual({
      status: 201,
      body: { winner: 'first' },
      headers: {},
    });
  });

  it('returns matched false when no rule matches', async () => {
    const { executeDeclarativeRuleSet } = await loadSubject();
    const state = createState();

    expect(typeof executeDeclarativeRuleSet).toBe('function');
    const result = await executeDeclarativeRuleSet({
      operation,
      req,
      rules: [
        {
          name: 'never',
          if: { eq: [{ ref: 'req.body.status' }, 'draft'] },
          then: {
            respond: {
              status: 200,
              body: { ok: true },
            },
          },
        },
      ],
      state,
      resourceCurrent: null,
    });

    expect(result).toMatchObject({
      matched: false,
      descriptor: null,
    });
    await result.commit();
    expect(state.setDescriptor).not.toHaveBeenCalled();
  });

  it('writes response-shaped current-scope state only when commit is invoked', async () => {
    const { executeDeclarativeRuleSet } = await loadSubject();
    const state = createState();

    expect(typeof executeDeclarativeRuleSet).toBe('function');
    const result = await executeDeclarativeRuleSet({
      operation,
      req,
      rules: [
        {
          name: 'write',
          then: {
            writeState: {
              status: { ref: 'req.body.status' },
              code: { ref: 'req.params.code' },
            },
            respond: {
              status: 200,
              body: { ref: 'state.current' },
            },
          },
        },
      ],
      state,
      resourceCurrent: null,
    });

    expect(result.descriptor).toEqual({
      status: 200,
      body: { status: 'ready', code: 'IT' },
      headers: {},
    });
    expect(state.setDescriptor).not.toHaveBeenCalled();

    await result.commit();

    expect(state.setDescriptor).toHaveBeenCalledWith(result.descriptor);
  });

  it('shallow-merges mergeState into current state before responding', async () => {
    const { executeDeclarativeRuleSet } = await loadSubject();
    const state = createState({
      get: vi.fn().mockResolvedValue({
        status: 'draft',
        meta: { count: 1 },
      }),
    });

    expect(typeof executeDeclarativeRuleSet).toBe('function');
    const result = await executeDeclarativeRuleSet({
      operation,
      req,
      rules: [
        {
          name: 'merge-current',
          then: {
            mergeState: {
              status: { ref: 'req.body.status' },
              meta: {
                changed: true,
              },
            },
            respond: {
              status: 200,
              body: { ref: 'state.current' },
            },
          },
        },
      ],
      state,
      resourceCurrent: null,
    });

    expect(result.descriptor.body).toEqual({
      status: 'ready',
      meta: { changed: true },
    });
  });

  it('falls back to default state for mergeState when current state is absent', async () => {
    const { executeDeclarativeRuleSet } = await loadSubject();
    const state = createState({
      getDefault: vi.fn().mockResolvedValue({
        status: 'seeded',
      }),
    });

    expect(typeof executeDeclarativeRuleSet).toBe('function');
    const result = await executeDeclarativeRuleSet({
      operation,
      req,
      rules: [
        {
          name: 'merge-default',
          then: {
            mergeState: {
              code: { ref: 'req.params.code' },
            },
            respond: {
              status: 200,
              body: { ref: 'state.current' },
            },
          },
        },
      ],
      state,
      resourceCurrent: null,
    });

    expect(result.descriptor.body).toEqual({
      status: 'seeded',
      code: 'IT',
    });
  });

  it('treats missing refs in then as no match and continues to later rules', async () => {
    const { executeDeclarativeRuleSet } = await loadSubject();
    const state = createState();

    expect(typeof executeDeclarativeRuleSet).toBe('function');
    const result = await executeDeclarativeRuleSet({
      operation,
      req,
      rules: [
        {
          name: 'broken',
          if: { exists: { ref: 'req.body.status' } },
          then: {
            writeState: {
              status: { ref: 'req.body.missing' },
            },
            respond: {
              status: 200,
              body: { ref: 'state.current' },
            },
          },
        },
        {
          name: 'fallback',
          then: {
            respond: {
              status: 202,
              body: { ok: true },
            },
          },
        },
      ],
      state,
      resourceCurrent: null,
    });

    expect(result.matched).toBe(true);
    expect(result.descriptor).toEqual({
      status: 202,
      body: { ok: true },
      headers: {},
    });
  });

  it('exposes linked resource as read-only snapshot input', async () => {
    const { executeDeclarativeRuleSet } = await loadSubject();
    const state = createState();
    const resourceCurrent = {
      id: 'IT',
      status: 'draft',
    };

    expect(typeof executeDeclarativeRuleSet).toBe('function');
    const result = await executeDeclarativeRuleSet({
      operation,
      req,
      rules: [
        {
          name: 'linked-resource',
          if: { eq: [{ ref: 'resource.current.status' }, 'draft'] },
          then: {
            respond: {
              status: 200,
              body: {
                code: { ref: 'req.params.code' },
                linkedStatus: { ref: 'resource.current.status' },
              },
            },
          },
        },
      ],
      state,
      resourceCurrent,
    });

    expect(result.descriptor.body).toEqual({
      code: 'IT',
      linkedStatus: 'draft',
    });
    expect(resourceCurrent).toEqual({
      id: 'IT',
      status: 'draft',
    });
    expect(state.setDescriptor).not.toHaveBeenCalled();
  });
});
