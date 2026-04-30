import { describe, expect, it, vi } from 'vitest';
import { createCustomHandlerAdapter } from '../../src/http/createCustomHandlerAdapter.js';

function createRuleState(overrides = {}) {
  return {
    get: vi.fn().mockResolvedValue(null),
    getDefault: vi.fn().mockResolvedValue(null),
    setDescriptor: vi.fn().mockResolvedValue(),
    ...overrides,
  };
}

describe('createCustomHandlerAdapter', () => {
  it('uses the default executor unchanged when no custom handler exists', async () => {
    const defaultExecutor = vi.fn().mockResolvedValue({
      descriptor: { status: 200, body: { ok: true }, headers: {} },
      commit: vi.fn(),
    });
    const handler = createCustomHandlerAdapter({ defaultExecutor, customHandler: null });

    const result = await handler({ req: { params: {}, query: {}, body: {}, headers: {} } });

    expect(result).toEqual({ status: 200, body: { ok: true }, headers: {} });
    expect(defaultExecutor).toHaveBeenCalledTimes(1);
  });

  it('allows a custom handler to wrap the default exactly once', async () => {
    const commit = vi.fn();
    const defaultExecutor = vi.fn().mockResolvedValue({
      descriptor: { status: 201, body: { id: 1 }, headers: {} },
      commit,
    });
    const customHandler = async (ctx) => {
      const created = await ctx.nextDefault();
      return ctx.json(created.status, { ...created.body, source: 'custom' });
    };
    const handler = createCustomHandlerAdapter({
      operation: { key: 'POST /pets' },
      defaultExecutor,
      customHandler,
      stateFactory: () => ({}),
    });

    const result = await handler({ req: { params: {}, query: {}, body: {}, headers: {} } });

    expect(result.body).toEqual({ id: 1, source: 'custom' });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(result);
  });

  it('throws if nextDefault is called more than once', async () => {
    const handler = createCustomHandlerAdapter({
      operation: { key: 'POST /pets' },
      defaultExecutor: async () => ({
        descriptor: { status: 200, body: {}, headers: {} },
        commit: async () => {},
      }),
      customHandler: async (ctx) => {
        await ctx.nextDefault();
        await ctx.nextDefault();
      },
      stateFactory: () => ({}),
    });

    await expect(handler({ req: { params: {}, query: {}, body: {}, headers: {} } })).rejects.toThrow(
      /nextDefault/i
    );
  });

  it('does not commit operation-state side effects when response validation rejects the final descriptor', async () => {
    const commit = vi.fn();
    const handler = createCustomHandlerAdapter({
      operation: { key: 'POST /reports/{id}/publish' },
      defaultExecutor: async () => ({
        descriptor: { status: 200, body: { status: 'ready' }, headers: {} },
        commit,
      }),
      customHandler: async (ctx) => {
        await ctx.nextDefault();
        return ctx.json(200, { invalid: true });
      },
      responseValidator: () => {
        throw new Error('invalid response');
      },
      stateFactory: () => ({}),
    });

    await expect(handler({ req: { params: {}, query: {}, body: {}, headers: {} } })).rejects.toThrow(
      /invalid response/
    );
    expect(commit).not.toHaveBeenCalled();
  });

  it('uses declarative rules before the built-in runtime when a rule matches', async () => {
    const defaultExecutor = vi.fn().mockResolvedValue({
      descriptor: { status: 200, body: { source: 'default' }, headers: {} },
      commit: vi.fn(),
    });
    const state = createRuleState();
    const handler = createCustomHandlerAdapter({
      operation: {
        key: 'POST /reports/{id}/publish',
        canonicalResponse: { status: 200 },
      },
      declarativeRules: [
        {
          name: 'publish',
          if: { eq: [{ ref: 'req.body.status' }, 'published'] },
          then: {
            writeState: {
              id: { ref: 'req.params.id' },
              status: { ref: 'req.body.status' },
            },
            respond: {
              status: 202,
              body: { ref: 'state.current' },
            },
          },
        },
      ],
      defaultExecutor,
      stateFactory: () => state,
      resourceCurrentFactory: async () => null,
    });

    const result = await handler({
      req: {
        params: { id: '42' },
        query: {},
        body: { status: 'published' },
        headers: {},
      },
    });

    expect(result).toEqual({
      status: 202,
      body: { id: '42', status: 'published' },
      headers: {},
    });
    expect(defaultExecutor).not.toHaveBeenCalled();
    expect(state.setDescriptor).toHaveBeenCalledWith(result);
  });

  it('passes linked-resource patch helpers through to declarative rules', async () => {
    const defaultExecutor = vi.fn().mockResolvedValue({
      descriptor: { status: 200, body: { source: 'default' }, headers: {} },
      commit: vi.fn(),
    });
    const state = createRuleState();
    const resources = {
      patchLinked: vi.fn().mockResolvedValue({
        id: '42',
        status: 'published',
      }),
    };
    const handler = createCustomHandlerAdapter({
      operation: {
        key: 'POST /reports/{id}/publish',
        canonicalResponse: { status: 200 },
      },
      declarativeRules: [
        {
          name: 'publish-linked-resource',
          then: {
            patchResource: {
              status: { ref: 'req.body.status' },
            },
            respond: {
              status: 202,
              body: { ref: 'resource.current' },
            },
          },
        },
      ],
      defaultExecutor,
      resource: { name: 'reports', idParam: 'id' },
      resources,
      stateFactory: () => state,
      resourceCurrentFactory: async () => ({
        id: '42',
        status: 'draft',
      }),
    });

    const result = await handler({
      req: {
        params: { id: '42' },
        query: {},
        body: { status: 'published' },
        headers: {},
      },
    });

    expect(result).toEqual({
      status: 202,
      body: { id: '42', status: 'published' },
      headers: {},
    });
    expect(defaultExecutor).not.toHaveBeenCalled();
    expect(resources.patchLinked).toHaveBeenCalledWith(
      { name: 'reports', idParam: 'id' },
      { id: '42' },
      { status: 'published' }
    );
  });

  it('falls back to the built-in runtime when rules exist but none match and no JS handler is configured', async () => {
    const commit = vi.fn();
    const defaultExecutor = vi.fn().mockResolvedValue({
      descriptor: { status: 200, body: { source: 'default' }, headers: {} },
      commit,
    });
    const state = createRuleState();
    const handler = createCustomHandlerAdapter({
      operation: {
        key: 'POST /reports/{id}/publish',
        canonicalResponse: { status: 200 },
      },
      declarativeRules: [
        {
          name: 'publish',
          if: { eq: [{ ref: 'req.body.status' }, 'published'] },
          then: {
            respond: {
              status: 202,
              body: { source: 'rules' },
            },
          },
        },
      ],
      defaultExecutor,
      stateFactory: () => state,
      resourceCurrentFactory: async () => null,
    });

    const result = await handler({
      req: {
        params: { id: '42' },
        query: {},
        body: { status: 'draft' },
        headers: {},
      },
    });

    expect(result).toEqual({
      status: 200,
      body: { source: 'default' },
      headers: {},
    });
    expect(defaultExecutor).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(result);
  });

  it('lets matching rules win over a configured JS handler', async () => {
    const customHandler = vi.fn(async (ctx) => ctx.json(200, { source: 'handler' }));
    const state = createRuleState();
    const handler = createCustomHandlerAdapter({
      operation: {
        key: 'POST /reports/{id}/publish',
        canonicalResponse: { status: 200 },
      },
      declarativeRules: [
        {
          name: 'publish',
          then: {
            respond: {
              status: 201,
              body: { source: 'rules' },
            },
          },
        },
      ],
      customHandler,
      defaultExecutor: vi.fn(),
      stateFactory: () => state,
      resourceCurrentFactory: async () => null,
    });

    const result = await handler({
      req: {
        params: { id: '42' },
        query: {},
        body: { status: 'published' },
        headers: {},
      },
    });

    expect(result).toEqual({
      status: 201,
      body: { source: 'rules' },
      headers: {},
    });
    expect(customHandler).not.toHaveBeenCalled();
  });

  it('throws an explicit error when rules and JS handler coexist but no rule matches', async () => {
    const customHandler = vi.fn(async (ctx) => ctx.json(200, { source: 'handler' }));
    const defaultExecutor = vi.fn();
    const state = createRuleState();
    const handler = createCustomHandlerAdapter({
      operation: {
        key: 'POST /reports/{id}/publish',
        canonicalResponse: { status: 200 },
      },
      declarativeRules: [
        {
          name: 'publish',
          if: { eq: [{ ref: 'req.body.status' }, 'published'] },
          then: {
            respond: {
              status: 201,
              body: { source: 'rules' },
            },
          },
        },
      ],
      customHandler,
      defaultExecutor,
      stateFactory: () => state,
      resourceCurrentFactory: async () => null,
    });

    await expect(
      handler({
        req: {
          params: { id: '42' },
          query: {},
          body: { status: 'draft' },
          headers: {},
        },
      })
    ).rejects.toThrow(/rules.*handler.*no rule matched/i);

    expect(customHandler).not.toHaveBeenCalled();
    expect(defaultExecutor).not.toHaveBeenCalled();
  });
});
