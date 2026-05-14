import { normalize } from './schemaResolver.js';

export function extractRawResponseSchema(operation) {
  const status = operation?.canonicalResponse?.status;
  const contentType = operation?.canonicalResponse?.contentType;
  if (!status || !contentType) return null;

  return (
    operation?.operation?.responses?.[String(status)]?.content?.[contentType]?.schema ?? null
  );
}

export function extractResponseSchema(operation, locationHint) {
  const raw = extractRawResponseSchema(operation);
  if (!raw) return null;
  return normalize(raw, locationHint ?? operation?.key ?? 'response');
}
