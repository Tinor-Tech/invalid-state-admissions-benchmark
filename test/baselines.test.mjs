// Committed baseline results reproduce, and trivial policies cannot satisfy the metrics jointly.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadCases, loadGroundTruth } from "../lib/load.mjs";
import { scoreRun } from "../lib/score.mjs";
import { runAll } from "../lib/runner.mjs";
import { scoreDispositions, baselineDecisions } from "../lib/score-dispositions.mjs";
import { runAdapter, score, spec, cases, truths, registry, adapter } from "./_helpers.mjs";

const committed = (name) => JSON.parse(readFileSync(join(ROOT, "baselines/results", `${name}.scores.json`), "utf8"));
const results = {};
for (const n of ["always-reject", "always-hold", "always-admit", "reference-rules"]) results[n] = score(await runAdapter(n)).metrics;

test("committed baseline results match a fresh run", async () => {
  for (const n of Object.keys(results)) assert.deepEqual(results[n], committed(n).metrics, n);
  const pc = loadCases(ROOT, "probes/cases"), pt = loadGroundTruth(ROOT, "probes/ground-truth");
  const probe = scoreRun({ spec, cases: pc, truths: pt, run: await runAll(await adapter("reference-rules"), pc, spec, {}, registry) }).metrics;
  assert.deepEqual(probe, committed("reference-rules.probes").metrics);
});

test("refusing or holding everything gets perfect safety metrics and zero ability", () => {
  for (const n of ["always-reject", "always-hold"]) {
    const m = results[n];
    assert.equal(m.safety.OAR.num, 0); assert.equal(m.safety.IPAR.num, 0);
    assert.equal(m.ability.VSAR.num, 0); assert.equal(m.ability.CDR.num, 0); assert.equal(m.completion.CPR.num, 0);
  }
});

test("admitting everything gets high VSAR and fails every safety metric", () => {
  const m = results["always-admit"];
  assert.ok(m.ability.VSAR.value > 0.7);
  assert.equal(m.safety.OAR.value, 1); assert.ok(m.safety.IPAR.num > 0); assert.ok(m.critical.total > 0); assert.equal(m.completion.CPR.num, 0);
});

test("no trivial baseline reaches OAR 0 and VSAR >= 0.5 together, or any CPR", () => {
  for (const n of ["always-reject", "always-hold", "always-admit"]) {
    const m = results[n];
    assert.ok(!(m.safety.OAR.num === 0 && m.ability.VSAR.value >= 0.5), n);
    assert.equal(m.completion.CPR.num, 0, n);
  }
});

test("a refusal policy that guesses the most common reason still cannot pass cases", () => {
  const decisions = Object.fromEntries(cases.map((c) => [c.id, c.steps.flatMap((s) => s.candidates.map((x) => ({ candidate: x.ref, outcome: "REFUSE", reason: "quote_not_in_source" })))]));
  const r = scoreDispositions(cases, truths, decisions);
  assert.ok(r.metrics.CDR.value < 0.15); assert.equal(r.metrics.VSAR_decision.num, 0);
});

test("Level 1 rejects incomplete decision files instead of scoring gaps", () => {
  const d = baselineDecisions(cases, "always-hold");
  delete d[cases.find((c) => c.steps.length).id];
  assert.equal(scoreDispositions(cases, truths, d).ok, false);
});
