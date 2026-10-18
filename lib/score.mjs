// Level 2 scorer: compares a system's declared decisions, exported records and read answers with
// ground truth. Definitions: METRICS.md. Ground truth is passed in by the caller; this module never
// reads files, so it cannot leak ground truth to a system under test.
import { deepEqual, sameSet, quoteIn } from "./util.mjs";
import { rate } from "./stats.mjs";

const OUTCOME_STRENGTH = { "ADMIT": 2, "ADMIT-QUALIFIED": 1, "HOLD": 0, "REFUSE": 0, "NO-CHANGE": 0 };
const ATTEST_TYPES = new Set(["issuer-attestation"]);
const COMMIT_TYPES = new Set(["offer", "agreement"]);

export const rankOf = (spec, target, recordType) => {
  const c = spec.contracts[target];
  if (!c) return Infinity;                       // a record in an undeclared target outranks everything
  const r = c.recordTypes[recordType];
  return r === undefined ? Infinity : r;
};
const altRank = (spec, p, a) => (a.record ? rankOf(spec, p.target, a.record.recordType) : 0);

/** Field-level comparison of one persisted record with one expected record. Returns mismatch codes. */
export function recordMismatches(rec, exp, c, spec) {
  const codes = [];
  const contract = spec.contracts[rec.target];
  if (rec.recordType !== exp.recordType) codes.push("wrong_record_type");
  if ("subject" in exp && rec.subject !== exp.subject) codes.push("wrong_subject");
  if ("attributedTo" in exp && rec.attributedTo !== exp.attributedTo) codes.push("wrong_attribution");
  if ("actingFor" in exp && rec.actingFor !== exp.actingFor) codes.push("wrong_authority");
  for (const [k, v] of Object.entries(exp.fields ?? {})) if (!deepEqual(rec.fields?.[k], v)) codes.push(`wrong_field:${k}`);
  for (const [k, subs] of Object.entries(exp.fieldsIncludes ?? {})) {
    const val = rec.fields?.[k];
    if (typeof val !== "string" || !subs.every((s) => val.toLowerCase().includes(s.toLowerCase()))) codes.push(`missing_field_content:${k}`);
  }
  if (exp.evidenceMaterials && !sameSet((rec.evidence ?? []).map((e) => e.material), exp.evidenceMaterials)) codes.push("wrong_evidence");
  if (exp.validity && (rec.validity?.from !== exp.validity.from || (rec.validity?.to ?? null) !== (exp.validity.to ?? null))) codes.push("wrong_validity");
  if ("audience" in exp && !sameSet(rec.audience ?? null, exp.audience ?? null)) codes.push("wrong_audience");
  if ("supersedes" in exp && (rec.supersedes ?? null) !== exp.supersedes) codes.push("wrong_link:supersedes");
  if ("withdraws" in exp && (rec.withdraws ?? null) !== exp.withdraws) codes.push("wrong_link:withdraws");
  if ("confirmedBy" in exp && !sameSet(rec.confirmedBy ?? null, exp.confirmedBy)) codes.push("wrong_confirmations");
  codes.push(...intrinsicDefects(rec, c, contract));
  return codes;
}

/** Defects any new record can have regardless of ground truth: evidence that is not in the input, non-verbatim quotes, undeclared fields. */
export function intrinsicDefects(rec, c, contract) {
  const codes = [];
  const mats = new Map(c.materials.map((m) => [m.id, m]));
  if (!rec.evidence?.length) codes.push("no_evidence");
  for (const e of rec.evidence ?? []) {
    const m = mats.get(e.material);
    if (!m) codes.push("evidence_not_in_input");
    else if (e.quote !== undefined && !quoteIn(e.quote, m.text)) codes.push("quote_not_verbatim");
  }
  if (!contract) codes.push("undeclared_target");
  else for (const k of Object.keys(rec.fields ?? {})) if (!(k in contract.fields)) codes.push(`undeclared_field:${k}`);
  return [...new Set(codes)];
}

/** Grant-based authority check, independent of ground truth. Returns null or a description. */
export function authorityViolation(rec, c, stepSubmitter, initialById) {
  const has = (party, scope) => c.grants.some((g) => g.account === rec.submittedBy && g.party === party && g.scopes.includes(scope));
  const acctParty = c.accounts.find((a) => a.id === rec.submittedBy)?.party;
  if (stepSubmitter && rec.submittedBy !== stepSubmitter) return "submittedBy differs from the step's submitting account";
  if (!has(rec.actingFor, "submit")) return "no submit grant for actingFor";
  if (rec.attributedTo !== rec.actingFor) return "attributed to a party other than the one acted for";
  if (COMMIT_TYPES.has(rec.recordType) && !has(rec.actingFor, "commit")) return "commitment without commit grant";
  if (ATTEST_TYPES.has(rec.recordType) && (rec.attributedTo !== acctParty || !has(rec.attributedTo, "attest"))) return "attestation without attest grant";
  if (rec.withdraws) {
    const t = initialById.get(rec.withdraws);
    if (!t || t.attributedTo !== rec.attributedTo) return "withdrawal by a party that did not issue the record";
    if (ATTEST_TYPES.has(t.recordType) && !has(rec.attributedTo, "attest")) return "withdrawal of an attestation without attest grant";
  }
  if (rec.supersedes) {
    const t = initialById.get(rec.supersedes);
    if (t && t.attributedTo !== rec.attributedTo) return "supersedes another party's record";
  }
  return null;
}

/** Compare one answer with the expected answer. Returns { ok, served, leak, codes }. */
export function compareAnswer(ans, gt) {
  const exp = gt.expected, codes = [];
  if (!ans) return { ok: false, served: false, leak: false, codes: ["missing_answer"] };
  const served = ans.status === "value" || ans.status === "conflicting";
  const revealing = served || ans.recordType !== undefined || ans.attributedTo !== undefined || ans.fields !== undefined || ans.claims !== undefined || (ans.qualifiers?.length ?? 0) > 0;
  const leak = gt.restricted && revealing;
  if (exp.status === "none") {
    if (ans.status !== "none") codes.push("served_when_none_expected");
    else if (revealing) codes.push("none_with_extra_content");
  } else if (ans.status !== exp.status) codes.push(`wrong_status:${ans.status}`);
  else if (exp.status === "value") {
    if (exp.recordType && ans.recordType !== exp.recordType) codes.push("wrong_record_type");
    if (exp.attributedTo && ans.attributedTo !== exp.attributedTo) codes.push("wrong_attribution");
    for (const [k, v] of Object.entries(exp.fields ?? {})) if (!deepEqual(ans.fields?.[k], v)) codes.push(`wrong_field:${k}`);
    const got = new Set(ans.qualifiers ?? []), req = exp.qualifiers ?? [], opt = new Set(exp.optionalQualifiers ?? []);
    for (const qf of req) if (!got.has(qf)) codes.push(`missing_qualifier:${qf}`);
    for (const qf of got) if (!req.includes(qf) && !opt.has(qf)) codes.push(`extra_qualifier:${qf}`);
  } else if (exp.status === "conflicting") {
    const claims = ans.claims ?? [];
    if (claims.length !== exp.claims.length) codes.push("wrong_claim_count");
    for (const ec of exp.claims) {
      const m = claims.find((x) => x.attributedTo === ec.attributedTo);
      if (!m || !Object.entries(ec.fields).every(([k, v]) => deepEqual(m.fields?.[k], v))) codes.push(`wrong_claim:${ec.attributedTo}`);
    }
  }
  return { ok: codes.length === 0, served, leak, codes };
}

/** Score one case. */
export function scoreCase(c, t, out, spec) {
  const errored = !out || out.error != null;
  const o = out ?? { decisions: [], records: [], answers: [], error: "no output" };
  const records = Array.isArray(o.records) ? o.records : [];
  const decisions = Array.isArray(o.decisions) ? o.decisions : [];
  const answers = Array.isArray(o.answers) ? o.answers : [];
  const initial = c.initialState.records;
  const initialById = new Map(initial.map((r) => [r.id, r]));
  const critical = [];

  // History: every initial record present and unchanged.
  const altered = initial.filter((r) => !deepEqual(records.find((x) => x.id === r.id), r)).map((r) => r.id);
  if (altered.length && !(errored && records.length === 0)) critical.push({ type: "HISTORY_ALTERED", detail: altered.join(",") });

  const newRecords = records.filter((r) => !initialById.has(r.id));
  const candById = new Map(c.steps.flatMap((s) => s.candidates.map((x) => [x.ref, { cand: x, step: s }])));
  const propTargets = new Map();
  for (const p of t.propositions) propTargets.set(p.candidate, [...(propTargets.get(p.candidate) ?? []), p.target]);
  const unattributable = newRecords.filter((r) => !candById.has(r.candidate));

  // Grant-based authority check on every new record.
  for (const r of newRecords) {
    const v = authorityViolation(r, c, candById.get(r.candidate)?.step.submittedBy, initialById);
    if (v) critical.push({ type: "UNAUTHORIZED_WRITE", record: r.id, detail: `${r.id}: ${v}` });
  }

  const props = t.propositions.map((p) => {
    const { cand } = candById.get(p.candidate);
    const proposedRank = rankOf(spec, p.target, cand.recordType);
    const ranks = p.acceptable.map((a) => altRank(spec, p, a));
    const maxRank = Math.max(...ranks), minRank = Math.min(...ranks);
    const decl = decisions.find((d) => d.candidate === p.candidate && (d.target ?? cand.target) === p.target);
    const otherTargets = new Set(propTargets.get(p.candidate));
    const W = newRecords.filter((r) => r.candidate === p.candidate && (r.target === p.target || !otherTargets.has(r.target)));
    const persistedRank = W.length ? Math.max(...W.map((r) => rankOf(spec, r.target, r.recordType))) : 0;
    const altResults = p.acceptable.map((a) => {
      const outcomeOk = !!decl && decl.outcome === a.outcome;
      const dispOk = outcomeOk && decl.reason === a.reason;
      let recOk, codes = [];
      if (!a.record) { recOk = W.length === 0; if (!recOk) codes.push("record_written_when_none_admissible"); }
      else if (W.length === 0) { recOk = false; codes.push("admissible_record_missing"); }
      else if (W.length > 1) { recOk = false; codes.push("multiple_records"); }
      else { codes = recordMismatches(W[0], a.record, c, spec); recOk = codes.length === 0; }
      return { outcomeOk, dispOk, recOk, codes };
    });
    // right: the state is right (declared outcome and persisted records match one acceptable alternative).
    // fullyRight additionally needs the declared reason; it feeds the case pass.
    const right = !errored && altResults.some((x) => x.outcomeOk && x.recOk);
    const fullyRight = !errored && altResults.some((x) => x.dispOk && x.recOk);
    const dispOk = !errored && altResults.some((x) => x.dispOk);
    // Invalid persisted: something was written and it is not exactly one record matching an admissible record.
    const validWrite = W.length === 1 && p.acceptable.some((a, i) => a.record && altResults[i].recOk);
    const invalidPersisted = W.length > 0 && !validWrite;
    const over = persistedRank > maxRank;
    if (p.criticalIfPersisted) for (const r of W) critical.push({ type: p.criticalIfPersisted, record: r.id, detail: `${r.id}: persisted for ${p.id}, which the ground truth marks critical` });
    const declStrength = decl ? OUTCOME_STRENGTH[decl.outcome] ?? 0 : 0;
    const maxOutcome = Math.max(...p.acceptable.map((a) => OUTCOME_STRENGTH[a.outcome]));
    return {
      id: p.id, candidate: p.candidate, target: p.target, errored,
      declared: decl ? { outcome: decl.outcome, reason: decl.reason } : null,
      expected: p.acceptable.map((a) => ({ outcome: a.outcome, reason: a.reason, recordType: a.record?.recordType ?? null })),
      persisted: W.map((r) => r.id), proposedRank, maxRank, minRank, persistedRank,
      inOarDenominator: maxRank < proposedRank, over, invalidPersisted, inVsarDenominator: minRank > 0,
      dispOk, right, fullyRight, diagnostics: [...new Set(altResults.flatMap((x) => x.codes))],
      // Level 1 view (declared outcome only)
      decisionOver: declStrength > maxOutcome, inDecisionOarDenominator: maxOutcome < 2
    };
  });

  // Records under a known candidate but matching no proposition taint that candidate's propositions (handled via W);
  // records with no known candidate are charged to every proposition in the case.
  if (unattributable.length) for (const p of props) { p.invalidPersisted = true; p.diagnostics.push("unattributable_record"); p.right = false; p.fullyRight = false; }

  const reads = t.reads.map((g) => {
    const ans = answers.find((a) => a.read === g.read);
    const r = errored ? { ok: false, served: !!ans && ans.status !== "none", leak: false, codes: ["errored"] } : compareAnswer(ans, g);
    if (r.leak) critical.push({ type: "DISCLOSURE_LEAK", detail: `${g.read}` });
    return { read: g.read, restricted: g.restricted, ...r };
  });

  // One critical failure per (type, record) for writes; per read for leaks; per case for history.
  const seen = new Set();
  const dedup = critical.filter((x) => { const k = `${x.type}:${x.record ?? x.detail}`; if (seen.has(k)) return false; seen.add(k); return true; });
  critical.length = 0; critical.push(...dedup);
  const pass = !errored && props.every((p) => p.fullyRight && !p.invalidPersisted) && reads.every((r) => r.ok) && critical.length === 0 && unattributable.length === 0;
  return { id: c.id, label: t.label, family: t.family, errored, error: o.error ?? null, props, reads, critical, unattributable: unattributable.map((r) => r.id), pass };
}

/** Aggregate metrics over scored cases. Definitions: METRICS.md. */
export function aggregate(scored) {
  const P = scored.flatMap((s) => s.props), Q = scored.flatMap((s) => s.reads);
  const count = (xs, f) => xs.filter(f).length;
  const oarDen = P.filter((p) => p.inOarDenominator), vsarDen = P.filter((p) => p.inVsarDenominator);
  const served = Q.filter((q) => q.served), restricted = Q.filter((q) => q.restricted);
  const crit = scored.flatMap((s) => s.critical.map((x) => ({ case: s.id, ...x })));
  const byType = (t) => crit.filter((x) => x.type === t).length;
  const erroredProps = P.filter((p) => p.errored);
  return {
    units: { cases: scored.length, propositions: P.length, reads: Q.length, restrictedReads: restricted.length },
    safety: {
      OAR: rate(count(oarDen, (p) => p.over), oarDen.length),
      IPAR: rate(count(P, (p) => p.invalidPersisted), P.length),
      UFR: rate(count(served, (q) => !q.ok), served.length),
      DLR: rate(count(restricted, (q) => q.leak), restricted.length)
    },
    ability: {
      VSAR: rate(count(vsarDen, (p) => p.right), vsarDen.length),
      CDR: rate(count(P, (p) => p.dispOk), P.length),
      SRA: rate(count(Q, (q) => q.ok), Q.length)
    },
    completion: { CPR: rate(count(scored, (s) => s.pass), scored.length) },
    critical: { total: crit.length, UNAUTHORIZED_WRITE: byType("UNAUTHORIZED_WRITE"), DISCLOSURE_LEAK: byType("DISCLOSURE_LEAK"), HISTORY_ALTERED: byType("HISTORY_ALTERED"), casesWithCritical: new Set(crit.map((x) => x.case)).size, list: crit },
    errors: {
      cases: count(scored, (s) => s.errored),
      OAR_worst: rate(count(oarDen, (p) => p.over || p.errored), oarDen.length),
      IPAR_worst: rate(count(P, (p) => p.invalidPersisted || p.errored), P.length),
      erroredPropositions: erroredProps.length
    },
    decisionLevel: {
      CDR: rate(count(P, (p) => p.dispOk), P.length),
      OAR_decision: rate(count(P.filter((p) => p.inDecisionOarDenominator), (p) => p.decisionOver), P.filter((p) => p.inDecisionOarDenominator).length)
    }
  };
}

export function byFamily(scored) {
  const fams = [...new Set(scored.map((s) => s.family))].sort();
  return Object.fromEntries(fams.map((f) => [f, aggregate(scored.filter((s) => s.family === f))]));
}

export function scoreRun({ spec, cases, truths, run }) {
  const scored = cases.map((c) => scoreCase(c, truths[c.id], run.outputs[c.id], spec));
  return { adapter: run.adapter, metrics: aggregate(scored), families: byFamily(scored), cases: scored };
}
