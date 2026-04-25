const ID_SUFFIX_RE = /^(.+?)(?:(_ids?)|(Ids?))$/;

function toKebab(s) {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

function italianPlurals(stem) {
  const out = new Set();
  if (stem.endsWith('io')) out.add(stem.slice(0, -1));
  else if (stem.endsWith('o') || stem.endsWith('e')) out.add(stem.slice(0, -1) + 'i');
  if (stem.endsWith('a')) out.add(stem.slice(0, -1) + 'e');
  return [...out];
}

export function resolveFK(propName, propSchema, resourceNames, overrides = {}) {
  if (!propName || !Array.isArray(resourceNames)) return null;

  const configured = overrides[propName];
  if (configured && resourceNames.includes(configured)) {
    return { target: configured, isArray: propSchema?.type === 'array' };
  }

  const explicit = propSchema?.['x-crudio-ref'];
  if (explicit) {
    if (resourceNames.includes(explicit)) {
      return { target: explicit, isArray: propSchema?.type === 'array' };
    }
    return null;
  }

  if (propName === 'id' || propName === '_id' || propName === 'ID') return null;

  const match = propName.match(ID_SUFFIX_RE);
  if (!match) return null;

  const stem = match[1];
  const snakeSuffix = match[2];
  const camelSuffix = match[3];

  if (snakeSuffix) {
    if (!/[A-Za-z0-9]$/.test(stem)) return null;
  } else {
    if (!/[a-z0-9]$/.test(stem)) return null;
  }

  const isArray = /s$/.test(snakeSuffix || camelSuffix || '');
  const kebab = toKebab(stem);
  const candidates = new Set([
    stem.toLowerCase(),
    stem.toLowerCase() + 's',
    kebab,
    kebab + 's',
    ...italianPlurals(stem.toLowerCase()),
    ...italianPlurals(kebab),
  ]);

  const lower = new Map(resourceNames.map((n) => [n.toLowerCase(), n]));
  for (const c of candidates) {
    if (lower.has(c)) return { target: lower.get(c), isArray };
  }
  return null;
}
