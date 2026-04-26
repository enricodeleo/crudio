export function buildScopeKey(scopeParts = {}) {
  return Object.entries(scopeParts)
    .filter(([, value]) => value !== undefined)
    .sort(([leftName], [rightName]) => leftName.localeCompare(rightName))
    .map(([name, value]) => `${name}=${encodeURIComponent(String(value))}`)
    .join('&');
}
