#!/usr/bin/env node
// Level 1: declared dispositions only.
//   node score-dispositions.mjs --baseline always-reject|always-hold|always-admit
//   node score-dispositions.mjs decisions.json     ({ "<caseId>": [{ "candidate", "target"?, "outcome", "reason" }] })
// A Level 1 score says nothing about what a system wrote. Use run.mjs for that.
import { readFileSync } from "node:fs";
import { loadCases, loadGroundTruth } from "./lib/load.mjs";
import { scoreDispositions, baselineDecisions, BASELINES } from "./lib/score-dispositions.mjs";
const a = process.argv.slice(2);
const cases = loadCases(), truths = loadGroundTruth();
let decisions, label;
if (a[0] === "--baseline") {
  if (!BASELINES[a[1]]) { console.error(`unknown baseline; choose ${Object.keys(BASELINES).join(", ")}`); process.exit(2); }
  decisions = baselineDecisions(cases, a[1]); label = a[1];
} else if (a[0]) { decisions = JSON.parse(readFileSync(a[0], "utf8")); label = a[0]; }
else { console.error("usage: node score-dispositions.mjs (--baseline <name> | decisions.json)"); process.exit(2); }
const r = scoreDispositions(cases, truths, decisions);
if (!r.ok) { console.error("Not scored. Problems:\n  " + r.problems.join("\n  ")); process.exit(1); }
const f = (x) => (x.value === null ? "n/a" : `${x.num}/${x.den}`);
console.log(`${label}: CDR ${f(r.metrics.CDR)}  OAR_decision ${f(r.metrics.OAR_decision)}  VSAR_decision ${f(r.metrics.VSAR_decision)}  outcome accuracy ${f(r.metrics.outcomeAccuracy)}  (${r.metrics.propositions} propositions)`);
