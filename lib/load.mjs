// Loading. Cases (system-visible) and ground truth (scorer-only) are loaded by separate functions;
// the runner only ever calls loadCases and loadSpec.
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const listJson = (dir) => readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
export function loadSpec(root = ROOT) {
  return { vocabulary: readJson(join(root, "spec/vocabulary.json")), contracts: readJson(join(root, "spec/contracts.json")), rules: readJson(join(root, "spec/rules.json")) };
}
export function loadCases(root = ROOT, dir = "cases") {
  return listJson(join(root, dir)).map((f) => readJson(join(root, dir, f)));
}
export function loadGroundTruth(root = ROOT, dir = "ground-truth") {
  return Object.fromEntries(listJson(join(root, dir)).map((f) => { const t = readJson(join(root, dir, f)); return [t.id, t]; }));
}
export const loadSchema = (name, root = ROOT) => readJson(join(root, "schemas", `${name}.schema.json`));
export { readJson };
