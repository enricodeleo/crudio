import { resolveRuleRef } from './resolveRuleRef.js';

function resolvePredicateValue(input, context) {
  if (input && typeof input === 'object' && !Array.isArray(input) && 'ref' in input) {
    return resolveRuleRef(input, context);
  }

  return {
    found: true,
    value: input,
  };
}

export function evaluateRulePredicate(predicate, context) {
  if (!predicate || typeof predicate !== 'object' || Array.isArray(predicate)) {
    return false;
  }

  if ('eq' in predicate) {
    const [left, right] = predicate.eq ?? [];
    const leftResult = resolvePredicateValue(left, context);
    const rightResult = resolvePredicateValue(right, context);
    if (!leftResult.found || !rightResult.found) return false;
    return Object.is(leftResult.value, rightResult.value);
  }

  if ('exists' in predicate) {
    return resolvePredicateValue(predicate.exists, context).found;
  }

  if ('in' in predicate) {
    const [needle, haystack] = predicate.in ?? [];
    const needleResult = resolvePredicateValue(needle, context);
    const haystackResult = resolvePredicateValue(haystack, context);
    if (!needleResult.found || !haystackResult.found || !Array.isArray(haystackResult.value)) {
      return false;
    }

    return haystackResult.value.some((candidate) => Object.is(candidate, needleResult.value));
  }

  return false;
}
