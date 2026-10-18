// REFERENCE BASELINE (kind: reference): schema validation + evidence + identity + authority + temporal
// rules, with a deterministic resolver for reads. No model, no network.
//
// Read this before quoting its numbers. It was written by the benchmark authors with full knowledge of
// the public cases and rules (spec/rules.json). Its lexical heuristics (hedge words, "valid until",
// rate expressions, name matching) are tuned to the phrasing of these cases and will not transfer to
// real inputs. Its score on the public set is an upper-bound illustration of a rules approach, not
// evidence that rules generalise. It is architecture-neutral and is not anyone's product.
import { clone, deepEqual, sameSet, quoteIn, normalizeWs } from "../lib/util.mjs";

const HEDGE = /\b(should be able to|assuming|expect(?:s|ed)? to|subject to|aim(?:s)? to|hope(?:s)? to|if)\b/i;
const CONDITION = /\b(assuming|subject to|if|provided that)\b[^.]*/i;
const RATE = /(\/\s*(month|week|day)\b|\bper (month|week|day)\b|\ba (month|week)\b)/i;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const isoFromText = (s) => { const m = s.match(/(\d{1,2}) (January|February|March|April|May|June|July|August|September|October|November|December) (\d{4})/); return m ? `${m[3]}-${String(MONTHS.indexOf(m[2]) + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}` : null; };
const textDate = (iso) => { const [y, m, d] = iso.split("-"); return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`; };
const sentenceWith = (text, quote) => normalizeWs(text).split(/(?<=\.)\s+/).find((s) => s.includes(normalizeWs(quote))) ?? normalizeWs(text);

export function createReferenceSession() {
  let ctx, records = [], seq = 0;
  const partyOf = (acct) => ctx.accounts.find((a) => a.id === acct)?.party ?? null;
  const has = (acct, party, scope) => ctx.grants.some((g) => g.account === acct && g.party === party && g.scopes.includes(scope));
  const mat = (id) => ctx.materials.find((m) => m.id === id);
  const D = (cand, outcome, reason) => ({ decision: { candidate: cand.ref, target: cand.target, outcome, reason }, record: null });

  function decide(cand, step) {
    const contract = ctx.contracts[cand.target];
    const acct = step.submittedBy, acctParty = partyOf(acct);
    // 1. contract
    if (!contract || !(cand.recordType in contract.recordTypes)) return D(cand, "REFUSE", "field_not_declared");
    for (const [k, v] of Object.entries(cand.fields)) {
      const f = contract.fields[k];
      if (!f) return D(cand, "REFUSE", "field_not_declared");
      if (f.enum && v !== null && !f.enum.includes(v)) return D(cand, "REFUSE", "field_not_declared");
    }
    // 2-3. evidence
    if (!cand.evidence?.length || cand.evidence.some((e) => !mat(e.material))) return D(cand, "REFUSE", "evidence_missing");
    if (cand.evidence.some((e) => e.quote !== undefined && !quoteIn(e.quote, mat(e.material).text))) return D(cand, "REFUSE", "quote_not_in_source");
    const mats = cand.evidence.map((e) => mat(e.material));
    const text = mats.map((m) => m.text).join(" ");
    // 4. identity (organisation subjects). A withdrawal or correction inherits its target record's subject.
    const linked = cand.withdraws ?? cand.supersedes;
    if (linked) {
      const t = records.find((r) => r.id === linked);
      if (t && t.subject !== cand.subject) return D(cand, "REFUSE", "subject_mismatch");
    } else if (contract.subjectKind === "organisation" && cand.subject !== acctParty) {
      const identified = new Set([...ctx.parties.filter((p) => text.includes(p.name)).map((p) => p.id), ...mats.map((m) => partyOf(m.from)).filter(Boolean)]);
      if (!identified.has(cand.subject)) {
        if (identified.size > 0) return D(cand, "REFUSE", "subject_mismatch");
        return D(cand, "HOLD", "subject_ambiguous");
      }
    }
    // 5. authority
    if (cand.recordType === "withdrawal" || cand.withdraws) {
      const t = records.find((r) => r.id === cand.withdraws);
      const scope = t?.recordType === "issuer-attestation" ? "attest" : "submit";
      if (!t || t.attributedTo !== cand.attributedTo || cand.attributedTo !== acctParty || !has(acct, cand.attributedTo, scope)) return D(cand, "REFUSE", "no_standing_to_withdraw");
    }
    if (cand.supersedes) {
      const t = records.find((r) => r.id === cand.supersedes);
      if (!t || t.attributedTo !== cand.attributedTo) return D(cand, "REFUSE", "no_standing_to_withdraw");
    }
    if (cand.recordType === "issuer-attestation" && (cand.attributedTo !== acctParty || !has(acct, acctParty, "attest"))) return D(cand, "REFUSE", "assurance_claimed_for_other_party");
    if (!has(acct, cand.actingFor, "submit") || cand.attributedTo !== cand.actingFor) return D(cand, "REFUSE", "not_entitled_to_submit");
    if ((cand.recordType === "offer" || cand.recordType === "agreement") && !has(acct, cand.actingFor, "commit")) return D(cand, "REFUSE", "not_entitled_to_commit");
    // 6. target meaning
    const periodField = Object.entries(contract.fields).find(([, f]) => f.type === "period" && f.required);
    if (periodField) {
      const quotes = cand.evidence.map((e) => e.quote ?? "").join(" ");
      if (RATE.test(quotes)) return D(cand, "REFUSE", "wrong_target_semantics");
      if (!cand.fields[periodField[0]]) return D(cand, "HOLD", "period_missing");
    }
    // 7. duplicates
    const evMats = cand.evidence.map((e) => e.material);
    if (records.some((r) => r.target === cand.target && r.subject === cand.subject && r.attributedTo === cand.attributedTo && r.recordType === cand.recordType &&
      deepEqual(r.fields, cand.fields) && sameSet(r.evidence.map((e) => e.material), evMats))) return D(cand, "NO-CHANGE", "duplicate_of_existing");
    // 8. strength
    const base = { ...clone(cand) }; delete base.ref;
    const write = (outcome, reason, patch = {}) => {
      const rec = { id: `w${++seq}`, candidate: cand.ref, step: step.id, submittedBy: acct, recordedAt: step.at,
        audience: null, supersedes: null, withdraws: null, confirmedBy: null, ...base, ...patch };
      return { decision: { candidate: cand.ref, target: cand.target, outcome, reason }, record: rec };
    };
    if (cand.recordType === "agreement" || cand.recordType === "offer") {
      const sentence = cand.evidence.map((e) => sentenceWith(mat(e.material).text, e.quote ?? "")).find((s) => HEDGE.test(s));
      if (sentence) {
        if ("expectation" in contract.recordTypes) {
          const cond = (sentence.match(CONDITION)?.[0] ?? sentence).replace(/\.$/, "");
          return write("ADMIT-QUALIFIED", "stronger_than_source", { recordType: "expectation", fields: { ...base.fields, condition: cond }, confirmedBy: null });
        }
        return D(cand, "HOLD", "commitment_not_made");
      }
    }
    if (cand.recordType === "agreement") {
      const f = cand.fields;
      const terms = [f.quantity != null ? f.quantity.toLocaleString("en-US") : null, f.price ?? null, f.dueBy ? textDate(f.dueBy) : null].filter(Boolean);
      const confirms = (party) => mats.some((m) => m.from && partyOf(m.from) === party && has(m.from, party, "commit") && terms.every((x) => m.text.includes(x)));
      const bound = [f.debtor, f.creditor];
      const confirmed = bound.filter(confirms);
      if (confirmed.length === bound.length) return write("ADMIT", "as_confirmed_agreement", { confirmedBy: bound });
      if (confirms(acctParty)) {
        const own = cand.evidence.filter((e) => partyOf(mat(e.material).from) === acctParty);
        return write("ADMIT-QUALIFIED", "offer_not_agreement", { recordType: "offer", attributedTo: acctParty, actingFor: acctParty, evidence: clone(own), confirmedBy: null });
      }
      return D(cand, "HOLD", "confirmations_pending");
    }
    const patch = {};
    let qualified = null;
    for (const [k, f] of Object.entries(contract.fields)) {
      if (f.enum?.includes("unstated") && cand.fields[k] && cand.fields[k] !== "unstated" && !text.toLowerCase().includes(String(cand.fields[k]).toLowerCase())) {
        patch.fields = { ...(patch.fields ?? base.fields), [k]: "unstated" }; qualified = "stronger_than_source";
      }
    }
    const until = text.match(/valid until ([^.,;]+)/i);
    const end = until ? isoFromText(until[1]) : null;
    if (end && (!cand.validity.to || cand.validity.to > end)) { patch.validity = { ...cand.validity, to: end }; qualified ??= "validity_narrower_than_proposed"; }
    if (qualified) return write("ADMIT-QUALIFIED", qualified, patch);
    const reason = cand.supersedes ? "correction_supersedes" : ({ claim: "as_stated_claim", transcription: "as_subject_transcription", "issuer-attestation": "issuer_attestation",
      offer: "as_stated_offer", withdrawal: "withdrawal_by_issuer", expectation: "as_stated_claim" })[cand.recordType] ?? "as_stated_claim";
    return write("ADMIT", reason);
  }

  function resolve(q) {
    const viewer = partyOf(q.viewer);
    const known = records.filter((r) => r.recordedAt <= q.knownAt && (!r.audience || r.audience.includes(viewer)));
    const superseded = new Set(known.filter((r) => r.supersedes).map((r) => r.supersedes));
    let hits = known.filter((r) => r.subject === q.subject && r.target === q.target && r.recordType !== "withdrawal" && !superseded.has(r.id) &&
      r.validity.from <= q.asOf && Object.entries(q.match).every(([k, v]) => deepEqual(r.fields?.[k], v)));
    const byRecorded = (a, b) => (a.recordedAt < b.recordedAt ? -1 : a.recordedAt > b.recordedAt ? 1 : 0);
    if ("agreement" in (ctx.contracts[q.target]?.recordTypes ?? {})) {
      const ag = hits.filter((r) => r.recordType === "agreement");
      hits = (ag.length ? ag : hits).sort(byRecorded).slice(-1);
    } else {
      const latest = new Map();
      for (const r of hits) {
        const cur = latest.get(r.attributedTo);
        if (!cur || r.validity.from > cur.validity.from || (r.validity.from === cur.validity.from && r.recordedAt > cur.recordedAt)) latest.set(r.attributedTo, r);
      }
      hits = [...latest.values()];
    }
    if (!hits.length) return { read: q.id, status: "none" };
    const keyFields = Object.entries(ctx.contracts[q.target].fields).filter(([, f]) => f.key).map(([k]) => k);
    const nonKey = (r) => Object.fromEntries(Object.entries(r.fields).filter(([k]) => !keyFields.includes(k)));
    if (hits.length > 1 && !hits.every((r) => deepEqual(nonKey(r), nonKey(hits[0])))) {
      return { read: q.id, status: "conflicting", claims: hits.sort((a, b) => (a.attributedTo < b.attributedTo ? -1 : 1)).map((r) => ({ attributedTo: r.attributedTo, recordType: r.recordType, fields: clone(r.fields) })) };
    }
    const r = hits[0], qualifiers = [];
    if (r.recordType === "expectation") qualifiers.push("conditional");
    if (r.validity.to && r.validity.to < q.asOf) qualifiers.push("expired");
    if (known.some((w) => w.recordType === "withdrawal" && w.withdraws === r.id && w.validity.from <= q.asOf)) qualifiers.push("withdrawn");
    if (r.recordType === "issuer-attestation" && r.target !== "accreditation") {
      qualifiers.push("independence-not-established");
      const acc = known.some((a) => a.target === "accreditation" && a.subject === r.attributedTo && a.attributedTo !== r.attributedTo &&
        a.validity.from <= q.asOf && (!a.validity.to || a.validity.to >= q.asOf) && r.fields.standard && a.fields.scope?.includes(r.fields.standard));
      qualifiers.push(acc ? "issuer-accredited" : "accreditation-not-established");
    }
    return { read: q.id, status: "value", recordType: r.recordType, attributedTo: r.attributedTo, fields: clone(r.fields), qualifiers };
  }

  return {
    async init(c) { ctx = c; records = clone(c.initialRecords); seq = 0; },
    async submit(step) {
      const decisions = [];
      for (const cand of step.candidates) { const { decision, record } = decide(cand, step); decisions.push(decision); if (record) records.push(record); }
      return { decisions };
    },
    async exportRecords() { return clone(records); },
    async read(q) { return resolve(q); }
  };
}

export default {
  name: "reference-rules", kind: "reference",
  description: "Schema, evidence, identity, authority and temporal rules with a deterministic resolver. Written with knowledge of the public cases; see the header.",
  createSession: createReferenceSession
};
