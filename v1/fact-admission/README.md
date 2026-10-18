# Fact admission — reference cases (A03)

Companion files for the Tinor Journal articles
[An AI Answer Is Not a Fact](https://tinor.io/journal/an-ai-answer-is-not-a-fact) and
[Toward Zero Invalid State Admissions](https://tinor.io/journal/toward-zero-invalid-state-admissions).

Ten candidates that a model might extract from a supplier's messages and records, each with the
disposition — outcome and reason — that a deterministic admission path should reach.

## What this is

1. **Synthetic or real?** Synthetic. Northfield Components, Lakeside Labs, Buyer B and every message
   are fictional. No customer data.
2. **Independent model or product?** `cases.json` is data. `score.mjs` is an independent scorer
   written for the benchmark proposal (no dependencies). Neither is Tinor code, and neither calls Tinor.
   There is no admission engine in this folder.
3. **What is checked.** `score.mjs` compares a system's *declared disposition* for each case — one
   outcome category and one reason — with the human-defined expectation, and prints:
   - **CDR** (Correct Disposition Rate): cases where outcome and reason both match, over all cases;
   - **ISAR (disposition)**: cases whose declared outcome is stronger than expected, over cases
     expected below ADMIT;
   - **VSAR (disposition)**: cases expected ADMIT or ADMIT-QUALIFIED whose disposition is right;
   - an outcome-only count, for diagnosis.

   It also validates its input. A missing case, an unknown case id, an outcome or reason outside the
   vocabulary in `cases.json`, an unexpected field or a malformed file is an error (exit code 2);
   nothing defaults to NO-CHANGE.
4. **What is not checked.** Only the two labels are compared. The scorer does **not** check entity
   binding, evidence level, attribution, validity period, authority, or whether a real record was
   written and persisted. A system that supplies exactly the expected labels scores perfectly here;
   that shows the labels match, not that anything was admitted correctly. ISAR and VSAR above are
   therefore disposition-level simplifications of the metrics in the proposal, and **TCR** (Task
   Completion Rate) is not computed: it is reserved for a future end-to-end evaluation of the
   records a system actually writes. Reads (SRA) and served answers (UFR) are not scored either.
   Whether Tinor (or any system) reaches these dispositions is not checked: the `tinorCoverage`
   field records where Tinor's own tests exercise corresponding behaviour (`tested`), where only a
   database integration test covers it (`integration-test`), and where it is design only (`design`).
   That is Tinor's claim; nothing here verifies it.
5. **How to verify.** With Node.js 18 or later, in this folder:

   ```sh
   node score.mjs cases.json --baseline always-reject
   # cases 10 · ISAR (disposition) 0/8 · VSAR (disposition) 0/3 · CDR 0/10 · outcome-only 4/10
   node score.mjs cases.json --baseline always-hold
   # cases 10 · ISAR (disposition) 0/8 · VSAR (disposition) 0/3 · CDR 0/10 · outcome-only 3/10
   node score.mjs cases.json --baseline always-admit
   # cases 10 · ISAR (disposition) 8/8 · VSAR (disposition) 0/3 · CDR 0/10 · outcome-only 2/10
   node score.mjs cases.json my-outputs.json   # { "<case id>": { "outcome": "...", "reason": "..." | null } }
   ```

   Each run also prints the scope line. These baseline numbers are properties of the case file, not
   results for any system.

6. **Which expectations are human-defined.** Every `expected.outcome` and `expected.reason`, the
   reasons vocabulary, the `stopsAt` stage, and the `why` text. Reasons are this file's own
   descriptive labels, not Tinor's internal vocabulary. `stopsAt` names one of six high-level
   stages: Interpretation, Typed Candidate, Assessment, Human Confirmation and authority, Owner
   Commit / Durable Record, Read.

## Outcomes

`ADMIT` · `ADMIT-QUALIFIED` (only as a weaker proposition or an evidence-only note) · `HOLD` (a specific
question or confirmation is needed) · `REFUSE` · `NO-CHANGE`. These are the benchmark's scoring
vocabulary, not Tinor protocol values.
