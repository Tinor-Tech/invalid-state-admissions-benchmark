// Level 2 runner (adapter contract isa-adapter/2.1, ADAPTERS.md). For each case: init(context) ->
// for each step: submit(step), exportRecords() (a snapshot) -> read(query) for each read ->
// exportRecords() again (state after reads). Only system-visible data is passed to the adapter,
// deep-frozen copies of cases/ plus spec/. Ground truth is never loaded here.
import { clone, deepFreeze } from "./util.mjs";
import { validate } from "./schema.mjs";

export function visibleContext(c, spec) {
  return deepFreeze(clone({
    id: c.id,
    contracts: Object.fromEntries(c.contracts.map((k) => [k, spec.contracts[k]])),
    rules: spec.rules, vocabulary: spec.vocabulary,
    parties: c.parties, accounts: c.accounts, grants: c.grants,
    materials: c.materials, initialRecords: c.initialState.records
  }));
}

export const BENCHMARK_VERSION = "2.1.0";
export const OUTPUT_SCHEMA = "isa-run-output/2.1";

export async function runCase(adapter, c, spec, options = {}, registry = null) {
  const started = performance.now();
  const out = { decisions: [], records: [], answers: [], snapshots: [], error: null };
  try {
    const session = await adapter.createSession(options);
    await session.init(visibleContext(c, spec));
    // Clone each export at once, so that a system that later mutates the array it returned cannot
    // rewrite an earlier snapshot.
    const snap = async (after) => out.snapshots.push({ after, records: clone(await session.exportRecords()) });
    for (const step of c.steps) {
      const res = await session.submit(deepFreeze(clone(step)));
      out.decisions.push(...(res?.decisions ?? []));
      await snap(step.id);
    }
    if (!c.steps.length) await snap("init");
    out.records = clone(out.snapshots.at(-1).records);
    for (const q of c.reads) {
      const a = await session.read(deepFreeze(clone(q)));
      if (a) out.answers.push({ ...a, read: q.id });
    }
    await snap("reads");
    if (session.cost) out.cost = await session.cost();
    if (session.close) await session.close();
    Object.assign(out, clone({ decisions: out.decisions, records: out.records, answers: out.answers, snapshots: out.snapshots }));
    if (registry) {
      const errs = validate(registry["output.schema.json"].$defs.caseOutput, out, registry, registry["output.schema.json"]);
      if (errs.length) out.error = `output does not match schemas/output.schema.json: ${errs.slice(0, 5).join("; ")}`;
    }
  } catch (e) {
    out.error = String(e?.message ?? e);
  }
  out.elapsedMs = Math.round((performance.now() - started) * 100) / 100;
  return out;
}

export async function runAll(adapter, cases, spec, options = {}, registry = null) {
  const outputs = {};
  for (const c of cases) outputs[c.id] = await runCase(adapter, c, spec, options, registry);
  return { benchmarkVersion: BENCHMARK_VERSION, outputSchema: OUTPUT_SCHEMA, adapter: { name: adapter.name, kind: adapter.kind, description: adapter.description, ...(adapter.contract ? { contract: adapter.contract } : {}) }, outputs };
}
