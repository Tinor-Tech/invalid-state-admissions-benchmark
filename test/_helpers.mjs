import { loadSpec, loadCases, loadGroundTruth, ROOT } from "../lib/load.mjs";
import { schemaRegistry } from "../lib/schema.mjs";
import { runAll } from "../lib/runner.mjs";
import { scoreRun, scoreCase } from "../lib/score.mjs";
import { clone } from "../lib/util.mjs";
export const spec = loadSpec();
export const cases = loadCases();
export const truths = loadGroundTruth();
export const registry = await schemaRegistry();
/** Cases are addressed by their readable label (kept in ground truth); files use opaque ids. */
export const idOf = (label) => { const t = Object.values(truths).find((x) => x.label === label); if (!t) throw new Error(`no case ${label}`); return t.id; };
export const caseById = (label) => cases.find((c) => c.id === idOf(label));
export async function adapter(name) { return (await import(`../adapters/${name}.mjs`)).default; }
export async function runAdapter(name, options = {}) { return runAll(await adapter(name), cases, spec, options, registry); }
export const score = (run) => scoreRun({ spec, cases, truths, run });
export const oracleRun = await runAdapter("oracle-mock");
/**
 * Score one case of the oracle output after applying a mutation to a copy of it. The mutation edits the
 * final state, so the copy drops its snapshots and is scored like an isa-run-output/2 output (final state
 * only); intermediate and read-time states are tested end to end through the runner (scorer-fixes.test.mjs).
 */
export function mutated(label, fn, truth = truths[idOf(label)]) {
  const out = clone(oracleRun.outputs[idOf(label)]);
  delete out.snapshots;
  fn(out);
  return scoreCase(caseById(label), truth, out, spec);
}
export { ROOT, clone };
