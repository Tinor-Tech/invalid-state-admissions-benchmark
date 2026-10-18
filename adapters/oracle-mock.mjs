// MOCK, FOR SCORER TESTING ONLY (kind: mock). This adapter reads ground-truth/ and replays the first
// acceptable alternative of every proposition and every expected answer. It is not a baseline and its
// scores are not results: they only show that the scorer awards full marks to output that matches the
// ground truth. The tests mutate its output to check that the scorer catches each kind of error.
import { clone } from "../lib/util.mjs";
import { ROOT, loadGroundTruth } from "../lib/load.mjs";
export function oracleRecord(p, a, cand, step, id) {
  const e = a.record;
  const fields = { ...clone(e.fields ?? cand.fields) };
  for (const [k, subs] of Object.entries(e.fieldsIncludes ?? {})) fields[k] = subs.join(" ");
  return { id, candidate: p.candidate, step: step.id, target: p.target, recordType: e.recordType,
    subject: e.subject ?? cand.subject, attributedTo: e.attributedTo ?? cand.attributedTo, actingFor: e.actingFor ?? cand.actingFor,
    submittedBy: step.submittedBy, fields, evidence: (e.evidenceMaterials ?? cand.evidence.map((x) => x.material)).map((m) => ({ material: m })),
    validity: clone(e.validity ?? cand.validity), recordedAt: step.at, audience: e.audience ?? null,
    supersedes: e.supersedes ?? null, withdraws: e.withdraws ?? null, confirmedBy: e.confirmedBy ?? null };
}
export default {
  name: "oracle-mock", kind: "mock",
  description: "Replays ground truth. Scorer self-test only; not a baseline, not a result.",
  createSession(options = {}) {
    const truths = loadGroundTruth(ROOT, options.truthDir ?? "ground-truth");
    let t, records = [], seq = 0;
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
      async read(q) { const g = t.reads.find((r) => r.read === q.id); return { read: q.id, ...clone(g.expected) }; }
    };
  }
};
