// 2.1.0, round 2: whole-record comparison and the smaller gaps. Each test was written first and failed
// against commit 6d1543e (round 1); see CHANGELOG.md, 2.1.0.
import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregate, scoreCase } from "../lib/score.mjs";
import { runCase } from "../lib/runner.mjs";
import { oracleRecord } from "../adapters/oracle-mock.mjs";
import { oracleRun, mutated, truths, caseById, idOf, spec, clone, registry } from "./_helpers.mjs";
import { loadGroundTruth, ROOT } from "../lib/load.mjs";

const newRec = (out, cand) => out.records.find((r) => r.candidate === cand && !/^r\d/.test(r.id));
const crit = (s, type) => s.critical.filter((x) => x.type === type).length;
const read = (s, id) => s.reads.find((r) => r.read === id);
const allTruths = () => [...Object.values(truths), ...Object.values(loadGroundTruth(ROOT, "probes/ground-truth"))];
/** Score a mutated oracle output against an optionally modified case, truth and spec (final state only). */
function variant(label, { out: fo = () => {}, truth: ft = () => {}, kase: fc = () => {}, spec: fs = () => {} }) {
  const c = clone(caseById(label)), t = clone(truths[c.id]), sp = clone(spec), out = clone(oracleRun.outputs[c.id]);
  delete out.snapshots; fc(c); ft(t); fs(sp); fo(out, c);
  return scoreCase(c, t, out, sp);
}

// 1. P0: the whole record --------------------------------------------------------------------------
test("P0: a fake confirmation on the o01 offer is an invalid admission", () => {
  const s = mutated("o01-unilateral-offer", (o) => { newRec(o, "c1").confirmedBy = ["org:buyer-b"]; });
  assert.ok(s.props[0].diagnostics.includes("wrong_confirmations"), s.props[0].diagnostics.join(","));
  assert.equal(s.props[0].invalidPersisted, true); assert.equal(s.pass, false);
});
test("P0: the offering party's own confirmation of its offer is declared allowed variance", () => {
  const s = mutated("o01-unilateral-offer", (o) => { newRec(o, "c1").confirmedBy = ["org:northfield-components"]; });
  assert.equal(s.props[0].invalidPersisted, false, s.props[0].diagnostics.join(",")); assert.equal(s.pass, true);
});
test("P0: a hedged statement written with the supplier's confirmation is invalid", () => {
  const s = mutated("v02-hedged-delivery", (o) => { newRec(o, "c1").confirmedBy = ["org:northfield-components"]; });
  assert.ok(s.props[0].diagnostics.includes("wrong_confirmations")); assert.equal(s.props[0].invalidPersisted, true);
});
test("P0: an invented audience or link on a record the ground truth leaves open is invalid", () => {
  for (const [fn, code] of [[(r) => { r.audience = ["org:buyer-b"]; }, "wrong_audience"], [(r) => { r.supersedes = "r9"; }, "wrong_link:supersedes"], [(r) => { r.withdraws = "r9"; }, "wrong_link:withdraws"]]) {
    const s = mutated("v01-supplier-lead-time", (o) => fn(newRec(o, "c1")));
    assert.ok(s.props[0].diagnostics.includes(code), `${code}: ${s.props[0].diagnostics.join(",")}`); assert.equal(s.props[0].invalidPersisted, true, code);
  }
});
test("P0: validity is compared on every record, including f03's attestation", () => {
  const s = mutated("f03-lab-issues-report", (o) => { newRec(o, "c1").validity = { from: "2020-01-01", to: "2020-01-02" }; });
  assert.ok(s.props[0].diagnostics.includes("wrong_validity")); assert.equal(s.props[0].invalidPersisted, true);
});
test("P0: the same record in another target with the same fields is invalid", () => {
  const s = mutated("o01-unilateral-offer", (o) => { newRec(o, "c1").target = "delivery_firm"; });
  assert.ok(s.props[0].diagnostics.includes("wrong_target"), s.props[0].diagnostics.join(",")); assert.equal(s.props[0].invalidPersisted, true);
});
test("P0 data: every admissible record states subject, attribution, acting-for party, evidence, validity and fields", () => {
  for (const t of allTruths()) for (const p of t.propositions) for (const a of p.acceptable) if (a.record)
    for (const k of ["subject", "attributedTo", "actingFor", "evidenceMaterials", "validity", "fields"]) assert.ok(k in a.record, `${t.label}/${p.id}: ${k}`);
});

// 2. Quotes ---------------------------------------------------------------------------------------
test("quotes: where a contract requires quotes, evidence without a verbatim quote is invalid", () => {
  const req = (sp) => { sp.contracts.lead_time.quoteRequired = true; };
  const none = variant("v01-supplier-lead-time", { spec: req });
  assert.ok(none.props[0].diagnostics.includes("quote_missing"), none.props[0].diagnostics.join(",")); assert.equal(none.props[0].invalidPersisted, true);
  const quoted = variant("v01-supplier-lead-time", { spec: req, out: (o, c) => { newRec(o, "c1").evidence = clone(c.steps[0].candidates[0].evidence); } });
  assert.equal(quoted.props[0].invalidPersisted, false, quoted.props[0].diagnostics.join(","));
});

// 3. Attribution of served answers ---------------------------------------------------------------------
test("attribution: o02 q1 and p01 q2 check who the agreement is attributed to", () => {
  for (const [label, q] of [["o02-both-parties-confirm", "q1"], ["p01-one-email-three-claims", "q2"]]) {
    const s = mutated(label, (o) => { o.answers.find((a) => a.read === q).attributedTo = "org:harbor-distribution"; });
    assert.equal(read(s, q).ok, false, `${label} ${q}`); assert.ok(read(s, q).codes.includes("wrong_attribution"));
  }
});
test("attribution data: every value expectation names its record type and attribution", () => {
  for (const t of allTruths()) for (const r of t.reads) if (r.expected.status === "value")
    assert.ok(r.expected.recordType && r.expected.attributedTo, `${t.label}/${r.read}`);
});

// 4. Time-aware support for extra served fields ------------------------------------------------------------
// n03: r1 (6 weeks, recorded 1 Oct) is updated at s1 (12 Oct). The variant gives the update a different unit.
const n03 = (q, answerUnit) => variant("n03-genuine-update", {
  truth: (t) => { t.propositions[0].acceptable[0].record.fields.unit = "day"; t.propositions[0].acceptable[0].record.fields.value = 49; },
  out: (o) => { const r = newRec(o, "c1"); r.fields.unit = "day"; r.fields.value = 49; o.answers.find((a) => a.read === q).fields.unit = answerUnit; }
});
test("time: an extra field taken from a record not yet known at knownAt is unsupported", () => {
  const s = n03("q3", "day");
  assert.ok(read(s, "q3").codes.includes("unsupported_additional_claim:unit"), read(s, "q3").codes.join(","));
  assert.equal(read(n03("q3", "week"), "q3").ok, true, "the record known at the time supports it");
});
test("time: an extra field taken from a record not yet valid at asOf is unsupported", () => {
  assert.ok(read(n03("q2", "day"), "q2").codes.includes("unsupported_additional_claim:unit"));
  assert.equal(read(n03("q2", "week"), "q2").ok, true);
});
test("time: an extra field taken from a superseded record is unsupported", () => {
  const r03 = (q, unit) => variant("r03-own-correction", {
    spec: (sp) => { sp.contracts.monthly_output.fields.unit.enum.push("pieces"); },
    kase: (c) => { c.initialState.records.find((r) => r.id === "r1").fields.unit = "pieces"; },
    out: (o) => { o.records.find((r) => r.id === "r1").fields.unit = "pieces"; o.answers.find((a) => a.read === q).fields.unit = unit; }
  });
  assert.ok(read(r03("q1", "pieces"), "q1").codes.includes("unsupported_additional_claim:unit"), "after the correction");
  assert.equal(read(r03("q2", "pieces"), "q2").ok, true, "before the correction was known, r1 is current");
  assert.equal(read(r03("q1", "units"), "q1").ok, true, "the correction supports its own unit");
});
test("time: an extra field from an alternative the system did not take is unsupported", () => {
  const s = variant("o01-unilateral-offer", {
    truth: (t) => { const a = clone(t.propositions[0].acceptable[0]); a.record.fields.dueBy = "2026-12-15"; t.propositions[0].acceptable.push(a); },
    out: (o) => { o.answers[0].fields.dueBy = "2026-12-15"; }
  });
  assert.equal(s.props[0].right, true, "the system took the first alternative");
  assert.ok(s.reads[0].codes.includes("unsupported_additional_claim:dueBy"), s.reads[0].codes.join(","));
});
test("time: expired and withdrawn records support extra fields only together with their qualifier", () => {
  let s = mutated("t02-offer-expiry", (o) => { o.answers.find((a) => a.read === "q2").fields.price = "USD 1.85"; });
  assert.equal(read(s, "q2").ok, true, read(s, "q2").codes.join(","));
  s = mutated("t02-offer-expiry", (o) => { const a = o.answers.find((x) => x.read === "q2"); a.fields.price = "USD 1.85"; a.qualifiers = []; });
  assert.ok(read(s, "q2").codes.includes("unsupported_additional_claim:price"), "expired, served as current");
  s = mutated("r01-issuer-withdraws", (o) => { o.answers.find((a) => a.read === "q2").fields.scope = "UL 94 V-0 listing, PC-ABS 2200"; });
  assert.equal(read(s, "q2").ok, true, read(s, "q2").codes.join(","));
  s = mutated("r01-issuer-withdraws", (o) => { const a = o.answers.find((x) => x.read === "q2"); a.fields.scope = "UL 94 V-0 listing, PC-ABS 2200"; a.qualifiers = a.qualifiers.filter((x) => x !== "withdrawn"); });
  assert.ok(read(s, "q2").codes.includes("unsupported_additional_claim:scope"), "withdrawn, served as current");
});

// 5. Export after each read ---------------------------------------------------------------------------------
function hooked({ onRead }) {
  return { name: "hooked", kind: "system-under-test", contract: "isa-adapter/2.1", createSession() {
    let t, records, seq = 0;
    return {
      async init(ctx) { t = truths[ctx.id]; records = clone(ctx.initialRecords); },
      async submit(step) {
        const decisions = [];
        for (const p of t.propositions.filter((x) => x.step === step.id)) {
          const a = p.acceptable[0], cand = step.candidates.find((x) => x.ref === p.candidate);
          decisions.push({ candidate: p.candidate, target: p.target, outcome: a.outcome, reason: a.reason });
          if (a.record) records.push(oracleRecord(p, a, cand, step, `o${++seq}`));
        }
        return { decisions };
      },
      async exportRecords() { return clone(records); },
      async read(q) { onRead?.(records, q); return { read: q.id, ...clone(t.reads.find((r) => r.read === q.id).expected) }; }
    };
  } };
}
test("reads: a read that changes state and a later read that reverts it is caught", async () => {
  const c = caseById("n03-genuine-update");
  const out = await runCase(hooked({ onRead(records, q) { const r = records.find((x) => x.candidate === "c1"); if (q.id === "q1") r.fields.value += 1; if (q.id === "q2") r.fields.value -= 1; } }), c, spec, {}, registry);
  assert.equal(out.error, null);
  const s = scoreCase(c, truths[c.id], out, spec);
  assert.equal(crit(s, "STATE_CHANGED_BY_READ"), 1, JSON.stringify(s.critical)); assert.match(s.critical.find((x) => x.type === "STATE_CHANGED_BY_READ").detail, /q1/);
  assert.equal(s.pass, false);
});

// 6. Duplicates ------------------------------------------------------------------------------------------
test("duplicates: identical decisions count once; conflicting decisions for one proposition are wrong", () => {
  let s = mutated("v01-supplier-lead-time", (o) => { o.decisions.push(clone(o.decisions[0])); });
  assert.equal(s.pass, true, "an identical duplicate is harmless");
  s = mutated("o01-unilateral-offer", (o) => { o.decisions.push({ ...clone(o.decisions[0]), outcome: "ADMIT", reason: "as_confirmed_agreement" }); });
  const p = s.props[0];
  assert.equal(p.dispOk, false); assert.equal(p.right, false); assert.ok(p.diagnostics.includes("conflicting_decisions"));
  assert.equal(p.decisionOver, true, "decision-level OAR takes the strongest declared outcome"); assert.equal(s.pass, false);
});
test("duplicates: conflicting answers for one read are wrong, and any revealing one is a leak", () => {
  let s = mutated("v01-supplier-lead-time", (o) => { o.answers.push(clone(o.answers[0])); });
  assert.equal(s.reads[0].ok, true, "an identical duplicate is harmless");
  s = mutated("v01-supplier-lead-time", (o) => { o.answers.push({ read: o.answers[0].read, status: "none" }); });
  assert.equal(s.reads[0].ok, false); assert.ok(s.reads[0].codes.includes("conflicting_answers"));
  s = mutated("d01-restricted-report", (o) => { o.answers.push({ read: "q2", status: "value", fields: { result: "V-0" } }); });
  assert.equal(crit(s, "DISCLOSURE_LEAK"), 1, "a second, revealing answer to a restricted read leaks");
});
