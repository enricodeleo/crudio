export default async function startRelease(ctx) {
  const started = await ctx.nextDefault();
  return ctx.json(started.status, { ...started.body, source: 'module' });
}
