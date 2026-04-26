function isObjectLike(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function pickProjectableFields(body, projectableFields = []) {
  return Object.fromEntries(
    Object.entries(body).filter(([field]) => projectableFields.includes(field))
  );
}

export async function projectResourceState({
  storage,
  resource,
  resourceId,
  body,
  projectableFields = [],
}) {
  if (
    !resource ||
    resourceId === undefined ||
    !isObjectLike(body) ||
    projectableFields.length === 0
  ) {
    return false;
  }

  const existing = await storage.findById(resource.name, resourceId);
  if (!existing) return false;

  const next = { ...existing, ...pickProjectableFields(body, projectableFields) };
  // TODO(stage3): validate against canonicalResponse schema
  await storage.update(resource.name, resourceId, next);
  return true;
}
