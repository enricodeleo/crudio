export function json(status, body, headers = {}) {
  return { status, body, headers };
}

export function assertValidDescriptor(value) {
  if (!value || typeof value.status !== 'number' || !('body' in value)) {
    throw new Error('Custom handler must return { status, body, headers? }.');
  }

  return {
    status: value.status,
    body: value.body,
    headers: value.headers ?? {},
  };
}

export function sendDescriptor(res, descriptor) {
  const normalized = assertValidDescriptor(descriptor);

  if (Object.keys(normalized.headers).length > 0 && typeof res.set === 'function') {
    res.set(normalized.headers);
  }

  if (normalized.status === 204) {
    return res.status(204).end();
  }

  return res.status(normalized.status).json(normalized.body);
}
