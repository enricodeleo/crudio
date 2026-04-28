import { StartupConfigurationError } from './loadCustomHandler.js';

const ALLOWED_PREDICATES = new Set(['eq', 'exists', 'in']);
const ALLOWED_EFFECTS = new Set(['writeState', 'mergeState', 'respond']);

function assertRuleObject(rule, index) {
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
    throw new StartupConfigurationError(
      `Rule at index ${index} must be an object.`
    );
  }
}

function validatePredicate(predicate, index) {
  if (predicate === undefined) return;

  if (!predicate || typeof predicate !== 'object' || Array.isArray(predicate)) {
    throw new StartupConfigurationError(
      `Rule at index ${index} has an invalid predicate shape.`
    );
  }

  const predicateKeys = Object.keys(predicate);
  if (predicateKeys.length !== 1 || !ALLOWED_PREDICATES.has(predicateKeys[0])) {
    throw new StartupConfigurationError(
      `Rule at index ${index} uses an unsupported predicate.`
    );
  }
}

function validateEffects(effects, index) {
  if (!effects || typeof effects !== 'object' || Array.isArray(effects)) {
    throw new StartupConfigurationError(
      `Rule at index ${index} must define a then object.`
    );
  }

  const effectKeys = Object.keys(effects);
  if (effectKeys.length === 0) {
    throw new StartupConfigurationError(
      `Rule at index ${index} must define at least one effect in then.`
    );
  }

  for (const effectKey of effectKeys) {
    if (!ALLOWED_EFFECTS.has(effectKey)) {
      throw new StartupConfigurationError(
        `Rule at index ${index} uses an unsupported effect.`
      );
    }
  }
}

export function normalizeDeclarativeRules(rules) {
  if (rules === undefined) return undefined;

  if (!Array.isArray(rules)) {
    throw new StartupConfigurationError('Operation rules must be an array.');
  }

  return rules.map((rule, index) => {
    assertRuleObject(rule, index);
    validatePredicate(rule.if, index);
    if (rule.then === undefined) {
      throw new StartupConfigurationError(
        `Rule at index ${index} must define then.`
      );
    }
    validateEffects(rule.then, index);
    return rule;
  });
}
