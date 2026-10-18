// The LLM harness and recorded adapter work offline with a scripted stand-in model. No model is run.
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLLMAdapter, lexicalRetrieve } from "../adapters/llm-harness.mjs";
import scripted from "../examples/scripted-model.mjs";
import { runAll } from "../lib/runner.mjs";
import { cases, spec, registry, score, adapter } from "./_helpers.mjs";

test("structured and rag modes produce schema-valid outputs and report cost", async () => {
  for (const mode of ["structured", "rag"]) {
    const run = await runAll(createLLMAdapter({ model: scripted, mode }), cases, spec, {}, registry);
    const m = score(run).metrics;
    assert.equal(m.errors.cases, 0, mode); assert.equal(m.ability.VSAR.num, 0);
    const any = Object.values(run.outputs)[0];
    assert.ok(any.cost.modelCalls >= 1 && any.cost.inputTokens > 0);
  }
});

test("human-approval mode turns a rejected write into HOLD with nothing written", async () => {
  const admitting = async ({ purpose, user }) => {
    const u = JSON.parse(user);
    if (purpose === "read") return { json: { status: "none" } };
    return { json: { decisions: u.step.candidates.map((c) => ({ candidate: c.ref, outcome: "ADMIT", reason: null })), records: u.step.candidates.map((c) => { const { ref, ...r } = c; return { candidate: ref, ...r }; }) } };
  };
  const run = await runAll(createLLMAdapter({ model: admitting, mode: "human-approval", approve: () => false }), cases, spec, {}, registry);
  const m = score(run).metrics;
  assert.equal(m.safety.IPAR.num, 0); assert.equal(m.safety.OAR.num, 0);
  assert.ok(Object.values(run.outputs).every((o) => o.decisions.every((d) => d.outcome === "HOLD")));
});

test("the harness refuses to run without a model and never writes records for unknown candidates", async () => {
  assert.throws(() => createLLMAdapter({}), /model function/);
  const rogue = async ({ purpose }) => (purpose === "read" ? { json: { status: "none" } } : { json: { decisions: [], records: [{ candidate: "zz", target: "lead_time", recordType: "claim", subject: "x", attributedTo: "x", actingFor: "x", fields: {}, evidence: [], validity: { from: "2026-01-01", to: null } }] } });
  const run = await runAll(createLLMAdapter({ model: rogue }), cases.slice(0, 3), spec, {}, registry);
  for (const o of Object.values(run.outputs)) assert.ok(o.records.every((r) => r.candidate !== "zz"));
  const unconfigured = await runAll(await adapter("llm-harness"), cases.slice(0, 1), spec, {}, registry);
  assert.match(Object.values(unconfigured.outputs)[0].error, /not configured/);
});

test("a recorded run replays to identical scores", async () => {
  const ref = await runAll(await adapter("reference-rules"), cases, spec, {}, registry);
  const dir = mkdtempSync(join(tmpdir(), "isa-")); const f = join(dir, "rec.json");
  writeFileSync(f, JSON.stringify(ref));
  const replay = await runAll(await adapter("recorded"), cases, spec, { recorded: f }, registry);
  assert.deepEqual(score(replay).metrics, score(ref).metrics);
});

test("lexical retrieval returns the most overlapping materials", () => {
  const ms = [{ id: "a", text: "capacity 46,000 units" }, { id: "b", text: "lead time six weeks HX-40" }, { id: "c", text: "nothing relevant" }];
  assert.deepEqual(lexicalRetrieve(ms, "HX-40 lead time", 1).map((m) => m.id), ["b"]);
});
