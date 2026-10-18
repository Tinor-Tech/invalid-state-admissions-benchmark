#!/usr/bin/env node
// Generates RULES.md and CASES.md from spec/ and ground-truth/. Run after changing either:
//   node tools/gen-docs.mjs          (test/docs.test.mjs fails if the files are stale)
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadSpec, loadCases, loadGroundTruth } from "../lib/load.mjs";
export function renderRules(spec) {
  const L = ["# Rules (v2.0.0)", "", "Generated from `spec/rules.json` by `tools/gen-docs.mjs`. These rules are system-visible: they are handed to every adapter. Ground truth cites them by id.", "",
    "They are this benchmark's declared policy, not a claim about how any product works. Results are relative to them (see REVIEW.md, rule dependence).", ""];
  for (const [id, t] of Object.entries(spec.rules)) L.push(`- **${id}.** ${t}`);
  L.push("", "## Reasons", "", "| Reason | Outcome | Rules | Meaning |", "|---|---|---|---|");
  for (const [k, v] of Object.entries(spec.vocabulary.reasons)) L.push(`| \`${k}\` | ${v.outcome} | ${v.rules.join(", ")} | ${v.text} |`);
  L.push("", "## Read qualifiers", "", "| Qualifier | Meaning |", "|---|---|");
  for (const [k, v] of Object.entries(spec.vocabulary.qualifiers)) L.push(`| \`${k}\` | ${v} |`);
  L.push("", "## Target contracts", "", "| Target | Meaning | Fields (key fields marked *) | Record types (strength rank) |", "|---|---|---|---|");
  for (const [k, c] of Object.entries(spec.contracts)) L.push(`| \`${k}\` | ${c.meaning} | ${Object.entries(c.fields).map(([f, d]) => `${f}${d.key ? "*" : ""}${d.enum ? ` (${d.enum.join("/")})` : ""}`).join(", ")} | ${Object.entries(c.recordTypes).map(([t, r]) => `${t} ${r}`).join(", ")} |`);
  return L.join("\n") + "\n";
}
export function renderCases(spec, cases, truths) {
  const ts = cases.map((c) => truths[c.id]).sort((a, b) => (a.label < b.label ? -1 : 1));
  const fams = Object.keys(spec.vocabulary.families);
  const L = ["# Cases (v2.0.0)", "", "Generated from `cases/` and `ground-truth/` by `tools/gen-docs.mjs`. **This file is ground truth.** Systems under test must not read it; the runner never passes it to them.", "",
    "Case files use opaque ids so that the input does not cue the answer; the readable label, family and title live in ground truth. All cases are synthetic, with fictional parties.", "",
    "## Counts", "", "| Family | Cases | Propositions | Reads (restricted) | Legitimate admissions (propositions whose every acceptable answer writes a record) |", "|---|---|---|---|---|"];
  let tc = 0, tp = 0, tr = 0, trr = 0, tl = 0;
  for (const f of fams) {
    const ft = ts.filter((t) => t.family === f);
    const p = ft.flatMap((t) => t.propositions), r = ft.flatMap((t) => t.reads);
    const l = p.filter((x) => x.acceptable.every((a) => a.record)).length, rr = r.filter((x) => x.restricted).length;
    tc += ft.length; tp += p.length; tr += r.length; trr += rr; tl += l;
    L.push(`| ${f} | ${ft.length} | ${p.length} | ${r.length} (${rr}) | ${l} |`);
  }
  L.push(`| **total** | **${tc}** | **${tp}** | **${tr} (${trr})** | **${tl}** |`, "");
  L.push("## v1 to v2 mapping", "", "| v1 case | v2 case(s) | Change |", "|---|---|---|");
  const v1 = {};
  for (const t of ts) if (t.v1Case) (v1[t.v1Case] ??= []).push(t);
  for (const k of Object.keys(v1).sort()) L.push(`| ${k} | ${v1[k].map((t) => t.label).join(", ")} | ${v1[k].map((t) => t.propositions.map((p) => p.acceptable.map((a) => `${a.outcome} ${a.reason}`).join(" or ")).join("; ")).join(" / ")} |`);
  L.push("");
  for (const f of fams) {
    L.push(`## ${f}`, "", spec.vocabulary.families[f], "");
    for (const t of ts.filter((x) => x.family === f)) {
      L.push(`### ${t.label} (\`${t.id}\`)${t.v1Case ? ` (v1 ${t.v1Case})` : ""}`, "", `*${t.title}.*`, "");
      for (const p of t.propositions) {
        L.push(`- **${p.id}** (${p.candidate}, ${p.target}): ${p.acceptable.map((a) => `**${a.outcome}** \`${a.reason}\`${a.record ? ` → writes a ${a.record.recordType}` : " → writes nothing"}`).join(" *or* ")}${p.criticalIfPersisted ? `; persisting anything is ${p.criticalIfPersisted}` : ""}. Rules: ${p.rules.join(", ")}. ${p.why}`);
      }
      for (const r of t.reads) L.push(`- read **${r.read}**${r.restricted ? " (restricted)" : ""}: ${r.expected.status}${r.expected.recordType ? ` ${r.expected.recordType}` : ""}${r.expected.qualifiers?.length ? ` [${r.expected.qualifiers.join(", ")}]` : ""}. ${r.why}`);
      L.push("");
    }
  }
  return L.join("\n");
}
if (process.argv[1] && process.argv[1].endsWith("gen-docs.mjs")) {
  const spec = loadSpec();
  writeFileSync(join(ROOT, "RULES.md"), renderRules(spec));
  writeFileSync(join(ROOT, "CASES.md"), renderCases(spec, loadCases(), loadGroundTruth()));
  console.log("wrote RULES.md, CASES.md");
}
