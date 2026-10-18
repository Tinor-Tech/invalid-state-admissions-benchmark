#!/usr/bin/env node
// Score a recorded Level 2 output file without running an adapter: node score.mjs output.json
import { readFileSync } from "node:fs";
import { loadSpec, loadCases, loadGroundTruth } from "./lib/load.mjs";
import { schemaRegistry, validate } from "./lib/schema.mjs";
import { scoreRun } from "./lib/score.mjs";
import { renderMetrics } from "./lib/report.mjs";
const file = process.argv[2];
if (!file) { console.error("usage: node score.mjs <output.json> [--json]"); process.exit(2); }
const run = JSON.parse(readFileSync(file, "utf8"));
const registry = await schemaRegistry();
const errs = validate(registry["output.schema.json"], run, registry);
if (errs.length) { console.error("Output file does not match schemas/output.schema.json:\n  " + errs.slice(0, 20).join("\n  ")); process.exit(1); }
const cases = loadCases();
const missing = cases.filter((c) => !run.outputs[c.id]).map((c) => c.id);
if (missing.length) console.error(`Warning: ${missing.length} cases have no output and are scored as system errors: ${missing.join(", ")}`);
const scored = scoreRun({ spec: loadSpec(), cases, truths: loadGroundTruth(), run });
if (process.argv.includes("--json")) console.log(JSON.stringify(scored.metrics, null, 2));
else console.log(renderMetrics(`${run.adapter.name} (${run.adapter.kind})`, scored.metrics));
