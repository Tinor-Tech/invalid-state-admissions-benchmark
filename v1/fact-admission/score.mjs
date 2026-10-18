// Disposition scorer for "Toward Zero Invalid State Admissions" (Tinor Journal).
//
// Synthetic data, independent tool. NOT Tinor code; it scores any system's declared dispositions
// against the human-defined expectations in cases.json. No dependencies, Node.js 18+.
//
// SCOPE. A disposition is an outcome category and a reason. This scorer compares those two labels
// and nothing else. It does NOT check entity binding, evidence level, validity period, authority,
// or whether a real record was written and persisted. A perfect score here means the labels match;
// it does not mean anything was admitted correctly. Its ISAR and VSAR are therefore
// disposition-level simplifications of the benchmark metrics, and it does not compute TCR, which
// is reserved for a future end-to-end task evaluation.
//
// Usage:  node score.mjs cases.json outputs.json             score a system's declared dispositions
//         node score.mjs cases.json --baseline always-reject (also: always-hold, always-admit)
//
// outputs.json: { "<case id>": { "outcome": "<one of cases.json outcomes>", "reason": "<one of cases.json reasons>" | null } }
// Every case must be present exactly once. Unknown ids, illegal outcomes or reasons, and malformed
// entries are errors; nothing defaults to NO-CHANGE.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const SCOPE =
  "disposition only (outcome and reason); entity binding, evidence level, validity period, authority and persistence are not checked";

export const baselines = {
  "always-admit": () => ({ outcome: "ADMIT", reason: null }),
  "always-reject": () => ({ outcome: "REFUSE", reason: null }),
  "always-hold": () => ({ outcome: "HOLD", reason: null }),
};

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** Throws on a malformed case file. */
export function validateCases(doc) {
  if (!isObj(doc) || !isObj(doc.strength) || !isObj(doc.reasons) || !Array.isArray(doc.cases) || doc.cases.length === 0)
    throw new Error("cases file must have strength, reasons and a non-empty cases array");
  const seen = new Set();
  for (const c of doc.cases) {
    if (!isObj(c) || typeof c.id !== "string" || !c.id) throw new Error("every case needs a string id");
    if (seen.has(c.id)) throw new Error(`duplicate case id ${c.id}`);
    seen.add(c.id);
    if (!isObj(c.expected) || !(c.expected.outcome in doc.strength)) throw new Error(`case ${c.id}: illegal expected outcome`);
    if (!(c.expected.reason in doc.reasons)) throw new Error(`case ${c.id}: expected reason not in the reasons vocabulary`);
  }
}

/** Throws unless outputs has exactly one well-formed disposition per case. */
export function validateOutputs(doc, outputs) {
  if (!isObj(outputs)) throw new Error("outputs must be a JSON object keyed by case id");
  const ids = new Set(doc.cases.map((c) => c.id));
  const unknown = Object.keys(outputs).filter((k) => !ids.has(k));
  if (unknown.length) throw new Error(`unknown case id(s): ${unknown.join(", ")}`);
  const missing = [...ids].filter((id) => !Object.hasOwn(outputs, id));
  if (missing.length) throw new Error(`missing output for case(s): ${missing.join(", ")}`);
  for (const [id, o] of Object.entries(outputs)) {
    if (!isObj(o)) throw new Error(`case ${id}: output must be an object`);
    const extra = Object.keys(o).filter((k) => k !== "outcome" && k !== "reason");
    if (extra.length) throw new Error(`case ${id}: unexpected field(s) ${extra.join(", ")}`);
    if (typeof o.outcome !== "string" || !(o.outcome in doc.strength)) throw new Error(`case ${id}: illegal outcome ${JSON.stringify(o.outcome)}`);
    if (!Object.hasOwn(o, "reason")) throw new Error(`case ${id}: reason is required (use null for none)`);
    if (o.reason !== null && !(typeof o.reason === "string" && o.reason in doc.reasons))
      throw new Error(`case ${id}: reason ${JSON.stringify(o.reason)} is not in the reasons vocabulary`);
  }
}

const ratio = (n, d) => ({ n, d, value: d ? n / d : null });

/**
 * A disposition is right when both the outcome and the reason match the expectation.
 *
 * ISAR (disposition): declared outcome stronger than expected / cases expected below ADMIT.
 * VSAR (disposition): right dispositions / cases expected ADMIT or ADMIT-QUALIFIED.
 * CDR, Correct Disposition Rate: right dispositions / all cases.
 * outcomeOnly: outcome matches, reason ignored. Diagnostic only.
 */
export function score(doc, outputs) {
  validateCases(doc);
  validateOutputs(doc, outputs);
  const s = doc.strength;
  let over = 0, overPossible = 0, validOk = 0, valid = 0, right = 0, outcomeOnly = 0;
  for (const c of doc.cases) {
    const exp = c.expected;
    const got = outputs[c.id];
    const ok = got.outcome === exp.outcome && got.reason === exp.reason;
    if (s[exp.outcome] < s.ADMIT) {
      overPossible++;
      if (s[got.outcome] > s[exp.outcome]) over++;
    }
    if (s[exp.outcome] > 0) {
      valid++;
      if (ok) validOk++;
    }
    if (got.outcome === exp.outcome) outcomeOnly++;
    if (ok) right++;
  }
  return {
    scope: SCOPE,
    cases: doc.cases.length,
    ISAR_disposition: ratio(over, overPossible),
    VSAR_disposition: ratio(validOk, valid),
    CDR: ratio(right, doc.cases.length),
    outcomeOnly: ratio(outcomeOnly, doc.cases.length),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const doc = JSON.parse(readFileSync(process.argv[2] ?? new URL("./cases.json", import.meta.url), "utf8"));
    const b = process.argv.indexOf("--baseline");
    let outputs;
    if (b > 0) {
      const make = baselines[process.argv[b + 1]];
      if (!make) throw new Error(`unknown baseline; use one of ${Object.keys(baselines).join(", ")}`);
      validateCases(doc);
      outputs = Object.fromEntries(doc.cases.map((c) => [c.id, make(c)]));
    } else {
      if (!process.argv[3]) throw new Error("give an outputs file or --baseline <name>");
      outputs = JSON.parse(readFileSync(process.argv[3], "utf8"));
    }
    const r = score(doc, outputs);
    const fmt = (m) => `${m.n}/${m.d}`;
    console.log(`cases ${r.cases} · ISAR (disposition) ${fmt(r.ISAR_disposition)} · VSAR (disposition) ${fmt(r.VSAR_disposition)} · CDR ${fmt(r.CDR)} · outcome-only ${fmt(r.outcomeOnly)}`);
    console.log(`scope: ${r.scope}`);
  } catch (e) {
    console.error(`error: ${e.message}`);
    process.exit(2);
  }
}
