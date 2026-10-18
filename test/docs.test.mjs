import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../lib/load.mjs";
import { renderRules, renderCases } from "../tools/gen-docs.mjs";
import { spec, cases, truths, oracleRun, score } from "./_helpers.mjs";
test("RULES.md and CASES.md are up to date with spec/ and ground-truth/", () => {
  assert.equal(readFileSync(join(ROOT, "RULES.md"), "utf8"), renderRules(spec));
  assert.equal(readFileSync(join(ROOT, "CASES.md"), "utf8"), renderCases(spec, cases, truths));
});

test("counts quoted in METRICS.md, README.md and BASELINES.md match the data and the committed results", () => {
  const m = score(oracleRun).metrics ?? score(oracleRun);
  const doc = (f) => readFileSync(join(ROOT, f), "utf8");
  const metrics = doc("METRICS.md"), baselines = doc("BASELINES.md"), summary = doc("baselines/results/SUMMARY.md");
  assert.equal(m.units.cases, 39); assert.equal(m.units.propositions, 41); assert.equal(m.units.reads, 58); assert.equal(m.units.restrictedReads, 3);
  assert.equal(m.safety.OAR.den, 18); assert.equal(m.ability.VSAR.den, 26); assert.equal(m.decisionLevel.OAR_decision.den, 20);
  for (const s of ["39 cases", "18 propositions", "Denominator: all propositions (41)", "26 propositions", "58 reads, 3 of them restricted", "Denominator: 39", "20 propositions"]) assert.ok(metrics.includes(s), `METRICS.md: ${s}`);
  const row = (set, name) => summary.split("\n").find((l) => l.startsWith(`| ${set} | ${name} |`)).split("|").slice(3, 11).map((x) => x.trim());
  const pub = row("public", "reference-rules"), pr = row("probes", "reference-rules");
  const names = ["OAR", "IPAR", "UFR", "DLR", "VSAR", "CDR", "SRA", "CPR"];
  const line = (r) => names.map((n, i) => `${n} ${r[i]}`).join(", ");
  assert.ok(baselines.includes(`Public set: ${line(pub)}`), "BASELINES.md public line");
  assert.ok(baselines.includes(`Probes (7 paraphrases written afterwards): ${line(pr)}.`), "BASELINES.md probe line");
  const nTests = readdirSync(join(ROOT, "test")).filter((f) => f.endsWith(".test.mjs")).map((f) => (doc(`test/${f}`).match(/^test\(/gm) ?? []).length).reduce((a, b) => a + b, 0);
  assert.ok(doc("README.md").includes(`# ${nTests} tests`), `README test count should be ${nTests}`);
});
