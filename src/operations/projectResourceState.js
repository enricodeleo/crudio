function isObjectLike(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export async function projectResourceState({ storage, resource, resourceId, body }) {
  if (!resource || resourceId === undefined || !isObjectLike(body)) {
    return false;
  }

  const existing = await storage.findById(resource.name, resourceId);
  if (!existing) return false;

  const next = { ...existing, ...body };
  // TODO(stage3): validate against canonicalResponse schema
  await storage.update(resource.name, resourceId, next);
  return true;
}
