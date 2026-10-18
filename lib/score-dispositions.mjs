// Level 1 scorer: declared dispositions only (outcome and reason per proposition). It cannot see what
// a system wrote; use run.mjs (Level 2) for persisted records and reads. Definitions: METRICS.md.
import { rate } from "./stats.mjs";
const STRENGTH = { "ADMIT": 2, "ADMIT-QUALIFIED": 1, "HOLD": 0, "REFUSE": 0, "NO-CHANGE": 0 };
const OUTCOMES = Object.keys(STRENGTH);

export const BASELINES = {
  "always-reject": () => ({ outcome: "REFUSE", reason: null }),
  "always-hold": () => ({ outcome: "HOLD", reason: null }),
  "always-admit": () => ({ outcome: "ADMIT", reason: null })
};

/** decisions: { [caseId]: [{ candidate, target?, outcome, reason }] } */
export function scoreDispositions(cases, truths, decisions) {
  const problems = [], rows = [];
  for (const c of cases) {
    const t = truths[c.id];
    const cands = new Map(c.steps.flatMap((s) => s.candidates.map((x) => [x.ref, x])));
    const ds = decisions[c.id];
    if (t.propositions.length && !Array.isArray(ds)) { problems.push(`${c.id}: no decisions`); continue; }
    for (const p of t.propositions) {
      const target = cands.get(p.candidate).target;
      const d = ds.filter((x) => x.candidate === p.candidate && (x.target ?? target) === p.target);
      if (d.length !== 1) { problems.push(`${c.id}/${p.candidate}: expected exactly one decision, got ${d.length}`); continue; }
      if (!OUTCOMES.includes(d[0].outcome)) { problems.push(`${c.id}/${p.candidate}: unknown outcome ${d[0].outcome}`); continue; }
      const maxS = Math.max(...p.acceptable.map((a) => STRENGTH[a.outcome]));
      const allAdmit = p.acceptable.every((a) => a.record);
      rows.push({ case: c.id, prop: p.id, declared: d[0],
        dispOk: p.acceptable.some((a) => a.outcome === d[0].outcome && a.reason === d[0].reason),
        outcomeOk: p.acceptable.some((a) => a.outcome === d[0].outcome),
        over: STRENGTH[d[0].outcome] > maxS, inOar: maxS < 2, inVsar: allAdmit });
    }
  }
  if (problems.length) return { ok: false, problems };
  const n = (f, xs = rows) => xs.filter(f).length;
  const oar = rows.filter((r) => r.inOar), vs = rows.filter((r) => r.inVsar);
  return { ok: true, metrics: {
    propositions: rows.length,
    CDR: rate(n((r) => r.dispOk), rows.length),
    OAR_decision: rate(n((r) => r.over, oar), oar.length),
    VSAR_decision: rate(n((r) => r.dispOk, vs), vs.length),
    outcomeAccuracy: rate(n((r) => r.outcomeOk), rows.length)
  }, rows };
}

export function baselineDecisions(cases, name) {
  const f = BASELINES[name];
  return Object.fromEntries(cases.map((c) => [c.id, c.steps.flatMap((s) => s.candidates.map((x) => ({ candidate: x.ref, ...f(x) })))]));
}
