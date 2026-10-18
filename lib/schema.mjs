// A minimal validator for the JSON Schema subset used in schemas/ (type, required, properties,
// additionalProperties, enum, const, items, minItems, minLength, pattern, anyOf, $ref to #/$defs
// or to a sibling file "name.schema.json" supplied in the registry).
const typeOf = (v) => (v === null ? "null" : Array.isArray(v) ? "array" : Number.isInteger(v) ? "integer" : typeof v);
export function validate(schema, value, registry = {}, root = schema, path = "$") {
  const errs = [];
  const v = (s, val, p, r = root) => validate(s, val, registry, r, p);
  if (schema.$ref) {
    if (schema.$ref.startsWith("#/$defs/")) return v(root.$defs[schema.$ref.slice(8)], value, path);
    const ext = registry[schema.$ref];
    if (!ext) return [`${path}: unresolved $ref ${schema.$ref}`];
    return v(ext, value, path, ext);
  }
  if (schema.anyOf) {
    const ok = schema.anyOf.some((s) => v(s, value, path).length === 0);
    if (!ok) errs.push(`${path}: does not match any allowed form`);
    return errs;
  }
  if (schema.type) {
    const t = typeOf(value), types = [].concat(schema.type);
    const match = types.some((x) => x === t || (x === "number" && t === "integer"));
    if (!match) return [`${path}: expected ${types.join("|")}, got ${t}`];
  }
  if (schema.const !== undefined && value !== schema.const) errs.push(`${path}: must be ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) errs.push(`${path}: ${JSON.stringify(value)} not in enum`);
  if (typeof value === "string") {
    if (schema.minLength && value.length < schema.minLength) errs.push(`${path}: too short`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errs.push(`${path}: does not match ${schema.pattern}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems && value.length < schema.minItems) errs.push(`${path}: fewer than ${schema.minItems} items`);
    if (schema.items) value.forEach((x, i) => errs.push(...v(schema.items, x, `${path}[${i}]`)));
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const k of schema.required ?? []) if (!(k in value)) errs.push(`${path}: missing ${k}`);
    for (const [k, x] of Object.entries(value)) {
      if (schema.properties && k in schema.properties) errs.push(...v(schema.properties[k], x, `${path}.${k}`));
      else if (schema.additionalProperties === false) errs.push(`${path}: unexpected property ${k}`);
      else if (typeof schema.additionalProperties === "object") errs.push(...v(schema.additionalProperties, x, `${path}.${k}`));
    }
  }
  return errs;
}

/** Load all schemas in schemas/ into a registry keyed by file name. */
export async function schemaRegistry() {
  const { readdirSync, readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { ROOT } = await import("./load.mjs");
  const dir = join(ROOT, "schemas");
  return Object.fromEntries(readdirSync(dir).filter((f) => f.endsWith(".schema.json")).map((f) => [f, JSON.parse(readFileSync(join(dir, f), "utf8"))]));
}
