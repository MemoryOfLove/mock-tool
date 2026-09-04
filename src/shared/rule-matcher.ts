import type {
  UrlMatchCondition,
  KeyValueCondition,
  BodyMatchCondition,
  MockRule,
  NormalizedRequest,
} from "./types";

function wildcardToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const regexStr = escaped.replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(`^${regexStr}$`);
}

function extractPathname(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url.split("?")[0];
  }
}

function matchUrl(condition: UrlMatchCondition, url: string): boolean {
  const urlNoQuery = url.split("?")[0];
  const pathname = extractPathname(url);

  switch (condition.type) {
    case "contains":
      return url.includes(condition.value);
    case "equals":
      return urlNoQuery === condition.value || pathname === condition.value;
    case "wildcard": {
      const re = wildcardToRegex(condition.value);
      return re.test(urlNoQuery) || re.test(pathname);
    }
    case "regex":
      return new RegExp(condition.value).test(url);
  }
}

function matchKeyValue(
  conditions: KeyValueCondition[],
  actual: Record<string, string>,
): boolean {
  return conditions.every((cond) => {
    const val = actual[cond.key.toLowerCase()];
    switch (cond.operator) {
      case "exists":
        return val !== undefined;
      case "equals":
        return val === cond.value;
      case "contains":
        return val?.includes(cond.value ?? "") ?? false;
      case "regex":
        return new RegExp(cond.value ?? "").test(val ?? "");
    }
  });
}

/** 简易 JSONPath 取值：支持 $.a.b.c 和 $.a[0].b 格式 */
export function getByPath(obj: unknown, path: string): unknown {
  if (path === '$' || path === '') return obj;
  const parts: string[] = [];
  const tokenRe = /(?:^\$)|(?:\.([A-Za-z_$][\w$]*))|(?:\[['"]([^'\"]+)['"]\])|(?:\[(\d+)\])/g;
  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(path))) {
    const key = match[1] ?? match[2] ?? match[3];
    if (key != null) parts.push(key);
  }
  if (!parts.length) return undefined;
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function matchBody(condition: BodyMatchCondition, body: string): boolean {
  try {
    switch (condition.type) {
      case "contains":
        return body.includes(condition.expression);
      case "regex":
        return new RegExp(condition.expression).test(body);
      case "jsonpath": {
        const parsed = JSON.parse(body);
        const value = getByPath(parsed, condition.expression);
        return condition.expectedValue != null && condition.expectedValue !== ""
          ? String(value) === condition.expectedValue
          : value !== undefined;
      }
    }
  } catch {
    return false;
  }
}

export function findMatchingRule(
  rules: MockRule[],
  request: NormalizedRequest,
): MockRule | null {
  const enabled = rules
    .filter((r) => r.enabled)
    .sort((a, b) => a.priority - b.priority);

  for (const rule of enabled) {
    const mc = rule.matchCondition;
    if (mc.url && !matchUrl(mc.url, request.url)) continue;
    if (
      mc.methods?.length &&
      !mc.methods.includes(request.method.toUpperCase())
    )
      continue;
    if (
      mc.queryParams?.length &&
      !matchKeyValue(mc.queryParams, request.queryParams)
    )
      continue;
    if (
      mc.requestHeaders?.length &&
      !matchKeyValue(mc.requestHeaders, request.headers)
    )
      continue;
    if (
      mc.requestBody &&
      mc.requestBody.expression &&
      (!request.body || !matchBody(mc.requestBody, request.body))
    )
      continue;
    return rule;
  }
  return null;
}
