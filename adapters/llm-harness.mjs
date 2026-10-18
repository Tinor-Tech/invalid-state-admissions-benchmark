// HARNESS, NOT RUN (kind: harness). Runs the proposed language-model baselines against any model you
// plug in. No model, key or network access is included, and the benchmark authors have not run it
// against any model: there are no LLM results for v2.
//
//   node run.mjs --adapter llm-harness --model ./your-model.mjs --mode structured|rag|human-approval [--approvals file.json]
//
// your-model.mjs default-exports: async ({ purpose, system, user, schema }) => ({ json, usage?, costUsd? })
// where json must match `schema`. The harness never reads environment variables or key files; your
// module is responsible for its own credentials. Use --out to record the run; the recorded file can be
// re-scored later with the recorded adapter, without calling the model again.
//
// Modes (see BASELINES.md):
//   structured      the model sees the rules, contracts, all materials and current records, and returns
//                   decisions plus records as JSON (LLM + structured output)
//   rag             the same, but only materials and records retrieved for the step or read are shown
//                   (LLM + evidence retrieval; lexical retrieval, top 2 materials)
//   human-approval  structured, then every proposed write goes to a recorded human approval; a rejected
//                   write becomes HOLD with nothing written (LLM + human approval)
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { clone } from "../lib/util.mjs";

const DECISION_SCHEMA = {
  type: "object", required: ["decisions", "records"],
  properties: {
    decisions: { type: "array", items: { type: "object", required: ["candidate", "outcome", "reason"], properties: { candidate: { type: "string" }, target: { type: "string" }, outcome: { enum: ["ADMIT", "ADMIT-QUALIFIED", "HOLD", "REFUSE", "NO-CHANGE"] }, reason: { type: ["string", "null"] } } } },
    records: { type: "array", items: { type: "object", required: ["candidate", "target", "recordType", "subject", "attributedTo", "actingFor", "fields", "evidence", "validity"] } }
  }
};
const ANSWER_SCHEMA = { type: "object", required: ["status"], properties: { status: { enum: ["value", "none", "conflicting"] }, recordType: { type: "string" }, attributedTo: { type: "string" }, fields: { type: "object" }, qualifiers: { type: "array" }, claims: { type: "array" } } };

const words = (s) => new Set(String(s).toLowerCase().match(/[a-z0-9-]{3,}/g) ?? []);
export function lexicalRetrieve(materials, queryText, k = 2) {
  const qw = words(queryText);
  return materials.map((m) => ({ m, s: [...words(m.text)].filter((w) => qw.has(w)).length })).sort((a, b) => b.s - a.s).slice(0, k).map((x) => x.m);
}

function systemPrompt(ctx) {
  return [
    "You decide whether proposed writes may enter shared state, and you answer reads from that state.",
    "Apply these rules exactly:", ...Object.entries(ctx.rules).map(([id, t]) => `${id}: ${t}`),
    "Outcomes and reasons:", ...Object.entries(ctx.vocabulary.reasons).map(([k, v]) => `${k} (${v.outcome}): ${v.text}`),
    "Read qualifiers:", ...Object.entries(ctx.vocabulary.qualifiers).map(([k, v]) => `${k}: ${v}`),
    "Target contracts:", JSON.stringify(ctx.contracts),
    "Return only JSON matching the schema you are given."
  ].join("\n");
}

export function createLLMAdapter({ model, mode = "structured", approve = null, name = `llm-${mode}` }) {
  if (typeof model !== "function") throw new Error("llm-harness: a model function is required");
  if (mode === "human-approval" && typeof approve !== "function") throw new Error("llm-harness: human-approval mode needs an approve function or --approvals file");
  return {
    name, kind: "harness", description: `LLM baseline harness (${mode}). Not run by the benchmark authors.`,
    createSession() {
      let ctx, records = [], seq = 0;
      const usage = { modelCalls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, approvals: 0, rejections: 0 };
      const call = async (purpose, user, schema) => {
        const r = await model({ purpose, system: systemPrompt(ctx), user: JSON.stringify(user), schema });
        usage.modelCalls++; usage.inputTokens += r?.usage?.inputTokens ?? 0; usage.outputTokens += r?.usage?.outputTokens ?? 0; usage.costUsd += r?.costUsd ?? 0;
        if (!r || typeof r.json !== "object") throw new Error(`model returned no JSON for ${purpose}`);
        return r.json;
      };
      return {
        async init(c) { ctx = c; records = clone(c.initialRecords); },
        async submit(step) {
          const q = step.candidates.map((c) => JSON.stringify(c)).join(" ");
          const materials = mode === "rag" ? lexicalRetrieve(ctx.materials, q) : ctx.materials;
          const shown = mode === "rag" ? records.filter((r) => step.candidates.some((c) => c.subject === r.subject && c.target === r.target)) : records;
          const out = await call("submit", { parties: ctx.parties, accounts: ctx.accounts, grants: ctx.grants, materials, currentRecords: shown, step }, DECISION_SCHEMA);
          const refs = new Set(step.candidates.map((c) => c.ref));
          const decisions = (out.decisions ?? []).filter((d) => refs.has(d.candidate)).map((d) => ({ candidate: d.candidate, ...(d.target ? { target: d.target } : {}), outcome: d.outcome, reason: d.reason ?? null }));
          for (const r of out.records ?? []) {
            if (!refs.has(r.candidate)) continue;                       // the harness never writes records for unknown candidates
            const rec = { id: `l${++seq}`, step: step.id, submittedBy: step.submittedBy, recordedAt: step.at, audience: null, supersedes: null, withdraws: null, confirmedBy: null, ...clone(r) };
            rec.submittedBy = step.submittedBy; rec.recordedAt = step.at; rec.step = step.id;
            if (mode === "human-approval") {
              const ok = await approve({ caseId: ctx.id, step: step.id, record: clone(rec), decision: decisions.find((d) => d.candidate === r.candidate) ?? null });
              usage.approvals++;
              if (!ok) { usage.rejections++; for (const d of decisions) if (d.candidate === r.candidate) { d.outcome = "HOLD"; d.reason = null; } continue; }
            }
            records.push(rec);
          }
          return { decisions };
        },
        async exportRecords() { return clone(records); },
        async read(q) {
          const shown = mode === "rag" ? records.filter((r) => r.subject === q.subject && r.target === q.target) : records;
          const a = await call("read", { accounts: ctx.accounts, records: shown, query: q }, ANSWER_SCHEMA);
          return { read: q.id, ...a };
        },
        async cost() { return { ...usage }; }
      };
    }
  };
}

export default {
  name: "llm-harness", kind: "harness",
  description: "LLM baseline harness. Requires --model; not run by the benchmark authors.",
  async createSession(options = {}) {
    if (!options.model) throw new Error("llm-harness not configured: pass --model <module> (no model is bundled; no LLM baseline has been run)");
    const model = (await import(pathToFileURL(resolve(options.model)).href)).default;
    let approve = null;
    if (options.approvals) {
      const table = JSON.parse(readFileSync(options.approvals, "utf8"));   // { "<caseId>/<step>/<candidate>": true|false }
      approve = ({ caseId, step, record }) => table[`${caseId}/${step}/${record.candidate}`] === true;
    }
    return createLLMAdapter({ model, mode: options.mode ?? "structured", approve }).createSession();
  }
};
