const NOT_FOUND = {
  found: false,
  value: undefined,
};

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

export function resolveRuleRef(reference, context) {
  if (!reference || typeof reference !== 'object' || Array.isArray(reference)) {
    return NOT_FOUND;
  }

  if (typeof reference.ref !== 'string' || reference.ref.length === 0) {
    return NOT_FOUND;
  }

  const segments = reference.ref.split('.');
  let current = context;

  for (const segment of segments) {
    if (current === null || typeof current !== 'object' || !hasOwn(current, segment)) {
      return NOT_FOUND;
    }

    current = current[segment];
  }

  return {
    found: true,
    value: current,
  };
}
