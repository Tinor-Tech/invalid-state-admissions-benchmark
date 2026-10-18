import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validate } from "../lib/schema.mjs";
import { rankOf } from "../lib/score.mjs";
import { spec, cases, truths, registry, ROOT } from "./_helpers.mjs";
import { loadCases, loadGroundTruth } from "../lib/load.mjs";

const caseSchema = registry["case.schema.json"], gtSchema = registry["ground-truth.schema.json"];
const probeCases = loadCases(ROOT, "probes/cases"), probeTruths = loadGroundTruth(ROOT, "probes/ground-truth");

test("every case and every ground-truth file matches its schema", () => {
  for (const c of [...cases, ...probeCases]) assert.deepEqual(validate(caseSchema, c, registry), [], c.id);
  for (const t of [...Object.values(truths), ...Object.values(probeTruths)]) assert.deepEqual(validate(gtSchema, t, registry), [], t.id);
});

test("cases and ground truth pair one-to-one, file names match ids", () => {
  for (const dir of ["cases", "ground-truth"]) for (const f of readdirSync(join(ROOT, dir))) assert.equal(JSON.parse(readFileSync(join(ROOT, dir, f), "utf8")).id + ".json", f);
  assert.deepEqual(cases.map((c) => c.id).sort(), Object.keys(truths).sort());
  const labels = Object.values(truths).map((t) => t.label);
  assert.equal(new Set(labels).size, labels.length, "labels unique");
});

test("system-visible cases carry no ground-truth fields", () => {
  const forbidden = new Set(["acceptable", "expected", "why", "outcome", "reason", "criticalIfPersisted", "restricted", "rules", "v1Case", "nature", "tinorCoverage", "family", "title"]);
  const walk = (o, path) => {
    if (Array.isArray(o)) o.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) { assert.ok(!forbidden.has(k), `${path}.${k}`); walk(v, `${path}.${k}`); }
  };
  for (const c of [...cases, ...probeCases]) { walk(c, c.id); assert.ok(!("label" in c), `${c.id}: readable label is ground truth`); }
});

test("system-visible text states no conclusions about admissibility", () => {
  const conclusions = [/not (authori[sz]ed|entitled|allowed)/i, /no (authority|standing)/i, /does not (occur|appear|exist)/i, /\b(forged|fake|fabricated|invalid|inadmissible|misquoted)\b/i, /should (be )?(refused|held|admitted)/i, /\bground truth\b/i, /\bexpected (outcome|answer)\b/i];
  for (const c of [...cases, ...probeCases]) {
    const text = JSON.stringify({ materials: c.materials, steps: c.steps.map((s) => s.request), id: c.id });
    for (const re of conclusions) assert.ok(!re.test(text), `${c.id}: ${re}`);
  }
});

test("every proposition, alternative and read is consistent with the case and the vocabulary", () => {
  for (const c of cases) {
    const t = truths[c.id];
    const cands = new Map(c.steps.flatMap((s) => s.candidates.map((x) => [x.ref, { x, s }])));
    for (const p of t.propositions) {
      assert.ok(cands.has(p.candidate), `${c.id}/${p.candidate}`);
      assert.equal(cands.get(p.candidate).s.id, p.step);
      for (const r of p.rules) assert.ok(r in spec.rules, `${c.id}: unknown rule ${r}`);
      for (const a of p.acceptable) {
        const v = spec.vocabulary.reasons[a.reason];
        assert.ok(v, `${c.id}: unknown reason ${a.reason}`);
        assert.equal(v.outcome, a.outcome, `${c.id}: ${a.reason} belongs to ${v.outcome}`);
        const admits = a.outcome === "ADMIT" || a.outcome === "ADMIT-QUALIFIED";
        assert.equal(!!a.record, admits, `${c.id}/${p.id}: record iff admitted`);
        if (a.record) assert.ok(Number.isFinite(rankOf(spec, p.target, a.record.recordType)), `${c.id}: record type not in contract`);
      }
    }
    assert.deepEqual(t.reads.map((r) => r.read).sort(), c.reads.map((r) => r.id).sort(), c.id);
    for (const r of t.reads) for (const q of r.expected.qualifiers ?? []) assert.ok(q in spec.vocabulary.qualifiers, `${c.id}: ${q}`);
  }
});

test("every family has at least two cases and at least one legitimate admission", () => {
  for (const fam of Object.keys(spec.vocabulary.families)) {
    const fc = cases.filter((c) => truths[c.id].family === fam);
    assert.ok(fc.length >= 2, `${fam}: ${fc.length} cases`);
    const positive = fc.some((c) => truths[c.id].propositions.some((p) => p.acceptable.every((a) => a.record)) || truths[c.id].reads.some((r) => r.expected.status === "value"));
    assert.ok(positive, `${fam}: no legitimate admission or served value`);
  }
  for (const t of Object.values(truths)) assert.ok(t.family in spec.vocabulary.families, t.family);
});

test("published data and docs avoid internal vocabulary and Tinor-specific claims", () => {
  const banned = ["entity_ambiguous", "unit_not_expressible", "quote_not_found", "authority_missing", "proposition_too_strong", "field_not_in_contract", "required_confirmations_missing", "assurance_escalation", "transcribed_by_subject", "tinorDiagnostic", "act-as grant", "tinorCoverage"];
  const files = [];
  const walk = (d) => { for (const f of readdirSync(join(ROOT, d), { withFileTypes: true })) { const p = join(d, f.name); if (f.isDirectory()) { if (!["node_modules", ".git", "v1"].includes(f.name)) walk(p); } else if (/\.(json|md|mjs|cff)$/.test(f.name)) files.push(p); } };
  walk(".");
  for (const f of files) {
    if (f.startsWith("test/")) continue;
    const s = readFileSync(join(ROOT, f), "utf8");
    for (const b of banned) assert.ok(!s.includes(b), `${f}: ${b}`);
    assert.ok(!/\bL[1-7]\b/.test(s), `${f}: level abbreviation`);
  }
  for (const d of ["cases", "ground-truth", "spec", "probes/cases", "probes/ground-truth"]) for (const f of readdirSync(join(ROOT, d))) assert.ok(!/tinor/i.test(readFileSync(join(ROOT, d, f), "utf8")), `${d}/${f} mentions Tinor`);
});
