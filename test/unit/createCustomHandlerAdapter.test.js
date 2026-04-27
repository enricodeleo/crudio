import { describe, expect, it, vi } from 'vitest';
import { createCustomHandlerAdapter } from '../../src/http/createCustomHandlerAdapter.js';

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
});
