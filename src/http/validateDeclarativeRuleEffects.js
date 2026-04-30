import { StartupConfigurationError } from './loadCustomHandler.js';

function hasLinkedResourceTarget(operation, resource) {
  if (!resource?.itemPath) return false;
  return (
    operation.openApiPath === resource.itemPath ||
    operation.openApiPath.startsWith(`${resource.itemPath}/`)
  );
}

export function validateDeclarativeRuleEffects({ operation, rules, resource }) {
  if (!rules?.length) return;

  for (const [index, rule] of rules.entries()) {
    if (!('patchResource' in (rule.then ?? {}))) continue;
    if (hasLinkedResourceTarget(operation, resource)) continue;

    const label = rule.name ? `Rule "${rule.name}"` : `Rule at index ${index}`;
    throw new StartupConfigurationError(
      `${label} on "${operation.key}" uses patchResource, but the operation has no linked resource target.`
    );
  }
}
