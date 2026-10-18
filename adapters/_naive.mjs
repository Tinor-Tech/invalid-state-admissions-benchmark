// Shared by the trivial baselines: an append-only list and a reader with no policy. The reader returns
// the most recently recorded record that matches subject, target and match fields, ignoring time,
// audience, withdrawals and qualifiers. It exists to show what a write-only policy scores on reads.
import { deepEqual, clone } from "../lib/util.mjs";
export function naiveSession({ decide, write }) {
  let records = [], seq = 0;
  return {
    async init(ctx) { records = clone(ctx.initialRecords); },
    async submit(step) {
      const decisions = [];
      for (const cand of step.candidates) {
        decisions.push({ candidate: cand.ref, ...decide(cand) });
        if (write) {
          const { ref, ...rest } = cand;
          records.push({ id: `w${++seq}`, candidate: ref, step: step.id, submittedBy: step.submittedBy, recordedAt: step.at,
            audience: null, supersedes: null, withdraws: null, confirmedBy: null, ...clone(rest) });
        }
      }
      return { decisions };
    },
    async exportRecords() { return clone(records); },
    async read(q) {
      const hits = records.filter((r) => r.subject === q.subject && r.target === q.target && r.recordType !== "withdrawal" &&
        Object.entries(q.match).every(([k, v]) => deepEqual(r.fields?.[k], v)));
      if (!hits.length) return { read: q.id, status: "none" };
      const r = hits.sort((a, b) => (a.recordedAt < b.recordedAt ? -1 : 1)).at(-1);
      return { read: q.id, status: "value", recordType: r.recordType, attributedTo: r.attributedTo, fields: clone(r.fields), qualifiers: [] };
    }
  };
}
