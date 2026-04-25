const SUPPORTED_METHODS = ['get', 'post', 'put', 'patch', 'delete'];
const STRUCTURED_CONTENT_TYPES = [
  'application/json',
  'application/*+json',
  'application/x-ndjson',
];

function extractPathParamNames(openApiPath) {
  return [...openApiPath.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
}

function readJsonBodySchema(operation) {
  return operation.requestBody?.content?.['application/json']?.schema ?? null;
}

function isSuccessStatus(status) {
  return /^\d+$/.test(status) && Number(status) >= 200 && Number(status) < 300;
}

function isStructuredContentType(contentType) {
  return (
    STRUCTURED_CONTENT_TYPES.includes(contentType) ||
    contentType.endsWith('+json')
  );
}

function selectCanonicalResponse(operation) {
  const responses = Object.entries(operation.responses ?? {})
    .filter(([status]) => isSuccessStatus(status))
    .sort(([left], [right]) => Number(left) - Number(right));

  for (const [status, response] of responses) {
    if (response.content?.['application/json']) {
      return { status: Number(status), contentType: 'application/json' };
    }
  }

  for (const [status, response] of responses) {
    const contentType = Object.keys(response.content ?? {}).find(isStructuredContentType);
    if (contentType) {
      return { status: Number(status), contentType };
    }
  }

  const [status] = responses[0] ?? [];
  return status ? { status: Number(status), contentType: null } : null;
}

export function compileOperations(spec) {
  return Object.entries(spec.paths ?? {}).flatMap(([openApiPath, pathItem]) =>
    SUPPORTED_METHODS.flatMap((method) => {
      const operation = pathItem?.[method];
      if (!operation) return [];

      return [
        {
          key: `${method.toUpperCase()} ${openApiPath}`,
          method: method.toUpperCase(),
          openApiPath,
          expressPath: openApiPath.replace(/\{([^}]+)\}/g, ':$1'),
          operationId: operation.operationId ?? null,
          pathParams: extractPathParamNames(openApiPath),
          requestBodySchema: readJsonBodySchema(operation),
          canonicalResponse: selectCanonicalResponse(operation),
          operation,
        },
      ];
    })
  );
}
