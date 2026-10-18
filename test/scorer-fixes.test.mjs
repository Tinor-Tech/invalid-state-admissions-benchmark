// v2.1 scorer fixes. Each test was written first and failed against v2.0.0 (commit 97407b7); see
// CHANGELOG.md, 2.1.0. Mutations start from the oracle mock's output, which scores perfectly.
import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregate, scoreCase } from "../lib/score.mjs";
import { runCase } from "../lib/runner.mjs";
import { oracleRecord } from "../adapters/oracle-mock.mjs";
import { mutated, truths, caseById, idOf, spec, clone, registry } from "./_helpers.mjs";

const newRec = (out, cand) => out.records.find((r) => r.candidate === cand && !/^r\d/.test(r.id));
const crit = (s, type) => s.critical.filter((x) => x.type === type).length;
const ipar = (s) => aggregate([s]).safety.IPAR.num;
const ufr = (s) => aggregate([s]).safety.UFR;

// P0-1 -------------------------------------------------------------------------------------------
test("P0-1: a correct record plus a fabricated, contract-legal extra field is an invalid admission", () => {
  const s = mutated("o01-unilateral-offer", (o) => { newRec(o, "c1").fields.condition = "Buyer has guaranteed payment"; });
  const p = s.props[0];
  assert.equal(p.invalidPersisted, true, "IPAR must count the fabricated condition");
  assert.ok(p.diagnostics.includes("unsupported_field:condition"), p.diagnostics.join(","));
  assert.equal(p.right, false); assert.equal(s.pass, false); assert.equal(ipar(s), 1);
});

test("P0-1: an extra field is accepted only where ground truth declares it as allowed variance", () => {
  const t = clone(truths[idOf("o01-unilateral-offer")]);
  t.propositions[0].acceptable[0].record.optionalFields = { condition: "Buyer has guaranteed payment" };
  const ok = mutated("o01-unilateral-offer", (o) => { newRec(o, "c1").fields.condition = "Buyer has guaranteed payment"; }, t);
  assert.equal(ok.props[0].invalidPersisted, false, "declared optional field with the declared value");
  const bad = mutated("o01-unilateral-offer", (o) => { newRec(o, "c1").fields.condition = "Something else"; }, t);
  assert.ok(bad.props[0].diagnostics.includes("wrong_field:condition"));
  assert.equal(mutated("o01-unilateral-offer", () => {}, t).props[0].invalidPersisted, false, "an optional field may be absent");
});

// P0-2 -------------------------------------------------------------------------------------------
test("P0-2: an extra served field that is not in the contract is wrong for SRA and unsupported for UFR", () => {
  const s = mutated("o01-unilateral-offer", (o) => { o.answers[0].fields.contractSigned = true; });
  const r = s.reads[0];
  assert.equal(r.ok, false); assert.ok(r.codes.includes("unexpected_field:contractSigned"), r.codes.join(","));
  assert.equal(ufr(s).num, 1); assert.equal(s.pass, false);
});

test("P0-2: an extra served claim in a contract field without a valid record behind it is unsupported", () => {
  const s = mutated("o01-unilateral-offer", (o) => { o.answers[0].fields.condition = "Buyer has guaranteed payment"; });
  assert.ok(s.reads[0].codes.includes("unsupported_additional_claim:condition"), s.reads[0].codes.join(","));
  assert.equal(ufr(s).num, 1);
});

test("P0-2: extra served fields that a valid, visible record supports are not penalised", () => {
  const s = mutated("o01-unilateral-offer", (o) => { Object.assign(o.answers[0].fields, { dueBy: "2026-11-30", object: "HX-40 housings" }); });
  assert.equal(s.reads[0].ok, true, s.reads[0].codes.join(","));
  const w = mutated("o01-unilateral-offer", (o) => { o.answers[0].fields.dueBy = "2026-12-31"; });
  assert.ok(w.reads[0].codes.includes("unsupported_additional_claim:dueBy"), "a different value is not supported");
});

test("P0-2: an extra served field backed only by a fabricated record field is unsupported", () => {
  const s = mutated("o01-unilateral-offer", (o) => { newRec(o, "c1").fields.condition = "Buyer has guaranteed payment"; o.answers[0].fields.condition = "Buyer has guaranteed payment"; });
  assert.ok(s.reads[0].codes.includes("unsupported_additional_claim:condition"));
});

// P1-3 -------------------------------------------------------------------------------------------
const V01 = "v01-supplier-lead-time";
const stepAt = () => caseById(V01).steps[0].at;
const shift = (ms) => new Date(Date.parse(stepAt()) + ms).toISOString();
function temporalMutation(fn, code) {
  const s = mutated(V01, (o) => fn(newRec(o, "c1")));
  assert.ok(s.props[0].diagnostics.includes(code), s.props[0].diagnostics.join(","));
  assert.equal(s.props[0].invalidPersisted, true); assert.equal(ipar(s), 1); assert.equal(s.pass, false);
}
test("P1-3: wrong_step makes the record an invalid admission", () => temporalMutation((r) => { r.step = "s9"; }, "wrong_step"));
test("P1-3: wrong_recorded_at (no offset) makes the record an invalid admission", () => temporalMutation((r) => { r.recordedAt = stepAt().replace(/Z$/, ""); }, "wrong_recorded_at"));
test("P1-3: future_dated_commit makes the record an invalid admission", () => temporalMutation((r) => { r.recordedAt = shift(24 * 3600e3); }, "future_dated_commit"));
test("P1-3: backdated_commit makes the record an invalid admission", () => temporalMutation((r) => { r.recordedAt = shift(-3600e3); }, "backdated_commit"));

test("P1-3: the tolerance is the step's second; another notation of the same instant is fine", () => {
  for (const at of [stepAt().replace(/Z$/, ".000Z"), stepAt().replace(/Z$/, ".999Z"), stepAt().replace("T10:", "T18:").replace(/Z$/, "+08:00")]) {
    const s = mutated(V01, (o) => { newRec(o, "c1").recordedAt = at; });
    assert.equal(s.props[0].invalidPersisted, false, at); assert.equal(s.pass, true, at);
  }
  const late = mutated(V01, (o) => { newRec(o, "c1").recordedAt = shift(1000); });
  assert.ok(late.props[0].diagnostics.includes("future_dated_commit"), "one second later is outside the tolerance");
});

test("P1-3: a submitter other than the step's account is invalid, not only a critical failure", () => {
  const s = mutated(V01, (o) => { newRec(o, "c1").submittedBy = "acct:nc-coordinator"; });
  assert.ok(s.props[0].diagnostics.includes("wrong_submitter")); assert.equal(s.props[0].invalidPersisted, true);
});

// P1-4 -------------------------------------------------------------------------------------------
/** An oracle-like system-under-test with hooks, to exercise the runner end to end. */
function hooked({ afterSubmit, onRead }) {
  return {
    name: "hooked", kind: "system-under-test", contract: "isa-adapter/2.1",
    createSession() {
      let t, records, seq = 0, i = 0;
      return {
        async init(ctx) { t = truths[ctx.id]; records = clone(ctx.initialRecords); },
        async submit(step) {
          const decisions = [];
          for (const p of t.propositions.filter((x) => x.step === step.id)) {
            const a = p.acceptable[0], cand = step.candidates.find((x) => x.ref === p.candidate);
            decisions.push({ candidate: p.candidate, target: p.target, outcome: a.outcome, reason: a.reason });
            if (a.record) records.push(oracleRecord(p, a, cand, step, `o${++seq}`));
          }
          afterSubmit?.(records, step, i++);
          return { decisions };
        },
        async exportRecords() { return clone(records); },
        async read(q) { onRead?.(records, q); return { read: q.id, ...clone(t.reads.find((r) => r.read === q.id).expected) }; }
      };
    }
  };
}
const runScored = async (label, hooks) => { const c = caseById(label); const out = await runCase(hooked(hooks), c, spec, {}, registry); return { out, s: scoreCase(c, truths[c.id], out, spec) }; };

test("P1-4: control: the hooked oracle without mutations passes", async () => {
  const { out, s } = await runScored("n02-retry-twice", {});
  assert.equal(out.error, null); assert.equal(s.pass, true);
});

test("P1-4: an invalid record written in one step and deleted in the next is caught", async () => {
  const { out, s } = await runScored("n02-retry-twice", {
    afterSubmit(records, step, i) {
      if (i === 0) { const bad = clone(records.find((r) => r.candidate === "c1")); bad.id = "tmp"; bad.recordType = "agreement"; records.push(bad); }
      if (i === 1) records.splice(records.findIndex((r) => r.id === "tmp"), 1);
    }
  });
  assert.equal(out.error, null);
  assert.ok(!out.records.some((r) => r.id === "tmp"), "the final state is clean");
  const p1 = s.props.find((p) => p.candidate === "c1");
  assert.equal(p1.invalidPersisted, true, "the intermediate admission counts"); assert.equal(p1.over, true);
  assert.equal(s.pass, false);
});

test("P1-4: an invalid record overwritten in place with the correct one by a later step is caught", async () => {
  const { out, s } = await runScored("n02-retry-twice", {
    afterSubmit(records, step, i) {
      const r = records.find((x) => x.candidate === "c1");
      if (i === 0) r.fields.value += 1;
      if (i === 1) r.fields.value -= 1;
    }
  });
  assert.equal(out.error, null);
  assert.equal(s.props.find((p) => p.candidate === "c1").invalidPersisted, true, "the overwritten version counts"); assert.equal(s.pass, false);
});

test("P1-4: a read that changes state is caught", async () => {
  const { out, s } = await runScored(V01, {
    onRead(records) { const r = records.find((x) => x.candidate === "c1"); if (r) r.fields.value += 1; }
  });
  assert.equal(out.error, null);
  assert.equal(crit(s, "STATE_CHANGED_BY_READ"), 1, JSON.stringify(s.critical));
  assert.equal(s.props[0].invalidPersisted, true, "the version written by the read is scored too");
  assert.equal(s.pass, false);
});

test("P1-4: a record that only appears during reads is caught", async () => {
  const { s } = await runScored(V01, {
    onRead(records) { if (!records.some((r) => r.id === "late")) { const r = clone(records.find((x) => x.candidate === "c1")); r.id = "late"; records.push(r); } }
  });
  assert.equal(crit(s, "STATE_CHANGED_BY_READ"), 1); assert.equal(s.props[0].invalidPersisted, true); assert.equal(s.pass, false);
});

test("P0-1: every admissible record in the ground truth states its fields, so the full comparison has a reference", async () => {
  const { loadGroundTruth, ROOT } = await import("../lib/load.mjs");
  for (const set of [truths, loadGroundTruth(ROOT, "probes/ground-truth")])
    for (const t of Object.values(set)) for (const p of t.propositions) for (const a of p.acceptable)
      if (a.record) assert.ok(a.record.fields && typeof a.record.fields === "object", `${t.label}/${p.id}: no fields`);
});

// Compatibility --------------------------------------------------------------------------------
test("compatibility: isa-run-output/2 files (no snapshots) still validate and are scored on records only", async () => {
  const { readFileSync, writeFileSync, mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { validate } = await import("../lib/schema.mjs");
  const { ROOT } = await import("../lib/load.mjs");
  const { scoreRun } = await import("../lib/score.mjs");
  const { runAll } = await import("../lib/runner.mjs");
  const { adapter, cases } = await import("./_helpers.mjs");
  for (const f of ["output.example.json", "output.v2.0.example.json"]) {
    const run = JSON.parse(readFileSync(join(ROOT, "examples", f), "utf8"));
    assert.deepEqual(validate(registry["output.schema.json"], run, registry), [], f);
  }
  // A 2.1 run with its snapshots removed is a 2.0 run of a well-behaved system; it scores the same.
  const ref = await runAll(await adapter("reference-rules"), cases, spec, {}, registry);
  const v20 = { ...clone(ref), benchmarkVersion: "2.0.0", outputSchema: "isa-run-output/2" };
  for (const o of Object.values(v20.outputs)) delete o.snapshots;
  assert.deepEqual(validate(registry["output.schema.json"], v20, registry), []);
  const a = scoreRun({ spec, cases, truths, run: ref }).metrics, b = scoreRun({ spec, cases, truths, run: v20 }).metrics;
  assert.equal(a.coverage.casesWithSnapshots, 39); assert.equal(b.coverage.casesWithSnapshots, 0);
  delete a.coverage; delete b.coverage; assert.deepEqual(a, b);
  // The recorded adapter replays a 2.0 file through the 2.1 runner without inventing state changes.
  const f = join(mkdtempSync(join(tmpdir(), "isa-")), "v20.json"); writeFileSync(f, JSON.stringify(v20));
  const replay = scoreRun({ spec, cases, truths, run: await runAll(await adapter("recorded"), cases, spec, { recorded: f }, registry) }).metrics;
  assert.equal(replay.critical.STATE_CHANGED_BY_READ, 0); delete replay.coverage; assert.deepEqual(replay, b);
});

test("P1-4: a 2.1 output cannot dodge the snapshot checks by omitting snapshots", async () => {
  const { scoreRun } = await import("../lib/score.mjs");
  const { oracleRun, cases } = await import("./_helpers.mjs");
  const run = clone(oracleRun); delete run.outputs[idOf(V01)].snapshots;
  const s = scoreRun({ spec, cases, truths, run }).cases.find((c) => c.id === idOf(V01));
  assert.equal(s.errored, true); assert.match(s.error, /without snapshots/); assert.equal(s.pass, false);
});
