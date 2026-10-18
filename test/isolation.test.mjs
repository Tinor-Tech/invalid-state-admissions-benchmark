// Ground truth must not reach a system under test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../lib/load.mjs";
import { visibleContext, runCase } from "../lib/runner.mjs";
import { cases, spec, truths } from "./_helpers.mjs";

test("only the oracle mock references ground truth; the runner never loads it", () => {
  for (const f of readdirSync(join(ROOT, "adapters"))) {
    const s = readFileSync(join(ROOT, "adapters", f), "utf8");
    if (f === "oracle-mock.mjs") { assert.ok(/SCORER TESTING ONLY/.test(s)); continue; }
    assert.ok(!/ground-truth|loadGroundTruth/.test(s), `${f} references ground truth`);
  }
  for (const f of ["lib/runner.mjs", "lib/score.mjs"]) assert.ok(!/loadGroundTruth|readFileSync/.test(readFileSync(join(ROOT, f), "utf8")), f);
});

test("the context handed to an adapter is frozen and contains no ground-truth content", () => {
  for (const c of cases) {
    const ctx = visibleContext(c, spec);
    assert.ok(Object.isFrozen(ctx) && Object.isFrozen(ctx.initialRecords));
    const s = JSON.stringify(ctx), t = truths[c.id];
    assert.ok(!s.includes(t.label), `${c.id}: label leaked`);
    for (const p of t.propositions) assert.ok(!s.includes(p.why), `${c.id}: rationale leaked`);
  }
});

test("an adapter that tries to mutate its input gets an error, not a changed case", async () => {
  const evil = { name: "evil", kind: "system-under-test", createSession: () => ({ async init(ctx) { ctx.initialRecords.push({}); }, async submit() { return { decisions: [] }; }, async exportRecords() { return []; }, async read() { return null; } }) };
  const c = cases.find((x) => x.initialState.records.length);
  const before = JSON.stringify(c);
  const out = await runCase(evil, c, spec);
  assert.ok(out.error); assert.equal(JSON.stringify(c), before);
});
