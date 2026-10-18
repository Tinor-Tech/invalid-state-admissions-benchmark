// Small helpers shared by the runner, the scorers and the reference adapters. No dependencies.
export const normalizeWs = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

export function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  const ka = Object.keys(a).filter((k) => a[k] !== undefined), kb = Object.keys(b).filter((k) => b[k] !== undefined);
  return ka.length === kb.length && ka.every((k) => deepEqual(a[k], b[k]));
}

export const sameSet = (a, b) => {
  if (a == null || b == null) return a == null && b == null;
  const sa = new Set(a), sb = new Set(b);
  return sa.size === sb.size && [...sa].every((x) => sb.has(x));
};

export const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

export function deepFreeze(o) {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

/** True if quote occurs verbatim (after collapsing whitespace) in text. */
export const quoteIn = (quote, text) => normalizeWs(text).includes(normalizeWs(quote));
