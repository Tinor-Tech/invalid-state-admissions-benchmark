#!/usr/bin/env node
// Level 2 runner and scorer.
//   node run.mjs --adapter reference-rules            run, score, print
//   node run.mjs --adapter always-admit --out out.json --scores scores.json
//   node run.mjs --adapter recorded --recorded out.json
//   node run.mjs --adapter ./path/to/your-adapter.mjs --runs 3
//   node run.mjs --adapter reference-rules --cases probes/cases --truth probes/ground-truth
// Adapters: always-reject, always-hold, always-admit (trivial), reference-rules (reference),
// oracle-mock (scorer self-test only), recorded, llm-harness (needs --model; not run by the authors),
// or a path to your own module (see ADAPTERS.md).
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, loadSpec, loadCases, loadGroundTruth } from "./lib/load.mjs";
import { schemaRegistry } from "./lib/schema.mjs";
import { runAll } from "./lib/runner.mjs";
import { scoreRun } from "./lib/score.mjs";
import { renderMetrics } from "./lib/report.mjs";

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith("--") ? [...acc, [a.slice(2), arr[i + 1]?.startsWith("--") || arr[i + 1] === undefined ? true : arr[i + 1]]] : acc), []));
if (!args.adapter) { console.error("usage: node run.mjs --adapter <name|path> [--out file] [--scores file] [--runs N] [--recorded file] [--json]"); process.exit(2); }
const modPath = args.adapter.includes("/") || args.adapter.endsWith(".mjs") ? resolve(args.adapter) : resolve(ROOT, "adapters", `${args.adapter}.mjs`);
const adapter = (await import(pathToFileURL(modPath).href)).default;
const casesDir = args.cases ?? "cases", truthDir = args.truth ?? "ground-truth";
const spec = loadSpec(), cases = loadCases(ROOT, casesDir), registry = await schemaRegistry();
const runs = Number(args.runs ?? 1);
const results = [];
for (let i = 0; i < runs; i++) {
  const run = await runAll(adapter, cases, spec, { recorded: args.recorded, truthDir, model: args.model, mode: args.mode, approvals: args.approvals }, registry);
  // Ground truth is loaded only after the adapter has finished.
  const scored = scoreRun({ spec, cases, truths: loadGroundTruth(ROOT, truthDir), run });
  results.push({ run, scored });
}
const last = results.at(-1);
if (args.out) writeFileSync(args.out, JSON.stringify(last.run, null, 2) + "\n");
if (args.scores) writeFileSync(args.scores, JSON.stringify({ adapter: last.scored.adapter, metrics: last.scored.metrics, families: last.scored.families, cases: last.scored.cases }, null, 2) + "\n");
if (args.json) console.log(JSON.stringify(last.scored.metrics, null, 2));
else {
  console.log(renderMetrics(`${adapter.name} (${adapter.kind})`, last.scored.metrics));
  if (runs > 1) {
    const anyCritical = new Set(results.flatMap((r) => r.scored.metrics.critical.list.map((x) => x.case)));
    const passAll = cases.filter((c) => results.every((r) => r.scored.cases.find((s) => s.id === c.id).pass)).length;
    console.log(`Repeated runs: ${runs}. Cases passing in every run: ${passAll}/${cases.length}. Cases with a critical failure in any run: ${anyCritical.size}.`);
  }
}
