// Level 2 runner. For each case: init(initial state and context) -> submit(step) for each step ->
// exportRecords() -> read(query) for each read. Only system-visible data is passed to the adapter,
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

export async function runCase(adapter, c, spec, options = {}, registry = null) {
  const started = performance.now();
  const out = { decisions: [], records: [], answers: [], error: null };
  try {
    const session = await adapter.createSession(options);
    await session.init(visibleContext(c, spec));
    for (const step of c.steps) {
      const res = await session.submit(deepFreeze(clone(step)));
      out.decisions.push(...(res?.decisions ?? []));
    }
    out.records = await session.exportRecords();
    for (const q of c.reads) {
      const a = await session.read(deepFreeze(clone(q)));
      if (a) out.answers.push({ ...a, read: q.id });
    }
    if (session.cost) out.cost = await session.cost();
    if (session.close) await session.close();
    Object.assign(out, clone({ decisions: out.decisions, records: out.records, answers: out.answers }));
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
  return { benchmarkVersion: "2.0.0", outputSchema: "isa-run-output/2", adapter: { name: adapter.name, kind: adapter.kind, description: adapter.description }, outputs };
}
