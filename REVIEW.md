# Strict review of v2.0.0

Written by the benchmark authors, acting as a strict reviewer of their own work. A self-review is not an
independent one; treat it as a list of known weaknesses, not as an endorsement.

## Status labels

| Label | Meaning here |
|---|---|
| **Design Proposal** | defined and argued for; nothing measured |
| **Runnable Demonstration** | code that does what the docs say on the published synthetic cases |
| **Measured Result** | a number produced by that code on a stated set, with n; in this release, baselines only |

| Item | Status |
|---|---|
| Rules, contracts, metric definitions, evaluation protocol, hidden-set plan | Design Proposal |
| Case format, separated ground truth, schemas, Level 1 scorer, Level 2 runner and scorer, adapter contract, recorded-output replay, LLM harness, probes | Runnable Demonstration |
| always-reject / always-hold / always-admit, reference-rules on public set and probes, Level 1 trivial baselines, wall time | Measured Result |
| LLM + structured output, LLM + RAG, LLM + human approval | Proposed (harness runnable, **not run**) |
| Any real AI system, any Tinor system, TCR, hidden set, inter-annotator agreement, cross-domain cost | Not done |

## Clara's four questions

### 1. What research-grade improvements were completed?

1. **Records, not labels.** Level 2 scores what was actually persisted (`exportRecords()`) and what each
   viewer is told (`read()`), not only what the system says it decided. The five observation points
   (decision, actual write, persisted record, resolved state, served answer) are documented in
   METRICS.md, Section 1.
2. **v1's main blind spot is closed.** v1's ISAR could not see a wrong subject, evidence, validity or
   authority written at the correct strength. IPAR does. The scorer tests show it by mutation: OAR and
   the disposition stay unchanged while IPAR fails (`test/scorer.test.mjs`).
3. **Safety, ability and completion are separate**, with critical failures counted, never averaged,
   and system errors that cannot improve safety numbers (worst-case OAR and IPAR).
4. **Qualified, partial, duplicate, multi-proposition and errored outputs are defined.** Qualified
   writes are judged by the record, not the label. Partial success is scored per proposition.
   Duplicates and retries count as invalid. Unattributable records taint their case. Errors count
   against ability.
5. **Zero-error statistics** are explicit: exact intervals, the zero-of-n bound, and the sample sizes
   needed for 1% and 0.1% claims.
6. **Ground truth is separated from inputs**, with opaque ids, no family or title in visible files,
   and a deep-frozen context; tests enforce this.
7. **Four v1 expectations corrected** with rule references (A03, A05, A06, A09; CHANGELOG.md).
8. **Coverage:** 12 families, every one with legitimate admissions; 39 cases, 41 propositions, 58 reads.
9. **Baselines:** three trivial and one non-LLM baseline measured, with the overfitting risk stated
   and measured by probes; three LLM baselines provided as runnable harnesses, honestly marked not run.
10. **v1 is reproducible and documented**, unchanged, with a compatibility table.
11. **Packaging:** schemas, CITATION.cff, .zenodo.json, MIT code / CC BY 4.0 data, 48 tests, zero dependencies.

### 2. Is it ready for formal external promotion?

**Not for a claim of the form "this benchmark measures X about AI systems".** Ready for a narrower
release: "a runnable, open protocol and development set, inviting review and adapters". Blocking
reasons for anything stronger:

- No AI system has been run. A benchmark with no system results cannot yet show it discriminates
  between real systems.
- The public set is solved 100% by rules its authors wrote with knowledge of it, and the same rules fail
  4 of 7 paraphrase probes. That is a strong signal the public set is too small and too lexically
  narrow to rank anything.
- Ground truth has one author team and no agreement study.
- There is no hidden set, so any public score can be the product of tuning or memorisation.

Recommended wording for any external mention: "v2.0.0: a runnable protocol with measured
trivial and rule-based baselines; no AI-system results yet; contributions of cases, reviews and
adapters welcome".

### 3. What is still only a Proposal?

- The evaluation protocol (pre-declared thresholds, k runs, reporting form).
- All three LLM baselines (runnable, not run; no numbers).
- The hidden set and its custodian; periodic refresh.
- Independent ground-truth review and inter-annotator agreement; the *contested* category.
- TCR (reserved) and any end-to-end workflow evaluation.
- Cross-domain implementation cost measurement.
- Verification of export honesty (third-party or instrumented adapters).
- Any evaluation of Tinor's or any other real system.

### 4. The most important next breakthrough to get researchers to cite, reproduce and participate

**Real, recorded LLM baseline runs plus a held-out set run by someone else.** Specifically: run the three
harness modes on at least two model families with k ≥ 3, publish the recorded outputs (re-scorable
offline), and at the same time commission an independent reviewer to write a hidden set of at least
100 paraphrased and new-world cases from the published rules, held outside the authors' control.
That single step turns the benchmark from "well-specified" into "informative": it shows whether the
metrics separate real systems, whether the open set predicts the hidden one, and it gives researchers a
leaderboard-free, re-scorable artefact to cite. Second priority: an agreement study on the 41
propositions with two external annotators.

## Loopholes and gaming routes

| Route | Effect | Current defence | Residual risk |
|---|---|---|---|
| Refuse or hold everything | perfect OAR and IPAR | VSAR, CDR, SRA, CPR reported beside it; claims must name all groups | a reader quoting OAR alone |
| Admit everything | high VSAR | OAR, IPAR, DLR, critical failures | none if reported in full |
| Right label, wrong record | CDR credit | IPAR, VSAR on records | Level 1 results cannot see it; always labelled decision-level |
| Qualified label, full-strength record | label credit | strength read from the record | none |
| Dishonest export (return the ideal records rather than the stored ones) | everything | none technical; stated as a protocol requirement | **high**: needs third-party or instrumented runs |
| Memorise the public ground truth | everything on the public set | statement in all docs; probes | **high** until a hidden set exists |
| Lexical rules tuned to the public phrasing | everything on the public set | probes (7) | probes are few and post hoc |
| Crash on hard cases | avoid safety violations | errors count against ability; worst-case safety metrics | none if worst case is reported |
| Leak through markers ("restricted", counts, qualifiers on `none`) | information disclosure | DLR counts any revealing content | new channels (timing, ordering) not modelled |
| Edit or delete history | rewrite the past | HISTORY_ALTERED on any change to initial records | edits to records created during the case are judged only by IPAR |
| Write extra records for unrelated candidates | hide state changes | unattributable records taint the case | an attributed but spurious record in a later step |
| Pick an easy acceptable alternative | | decision and records must match the same alternative | all current propositions have one alternative |

## Leakage

- Visible files contain no family, title, expected outcome, rule id or rationale (checked by tests).
  Case ids are opaque hashes.
- Remaining leakage: materials and candidates are written to make specific points, and a reader can
  often infer the family. The public CASES.md and ground-truth/ are, by design, available. The
  benchmark's own README links to them, so the public set should be treated as fully leaked.
- The runner loads ground truth only after the adapter finishes, and freezes the visible context; an
  in-process adapter could still read files from disk. Only out-of-process or third-party runs close this.

## Rule bias

- The rules encode one view of procurement records: offers are admissible as offers, hedges as
  expectations only when a contract allows it, self-issued attestations admit with explicit
  "not established" qualifiers, and outsiders learn nothing about restricted records. Each is defensible,
  but each is a choice. A buyer who never records unaccepted offers would score o01 differently.
- The reason precedence (R-ORDER-1) decides which reason is "right" when several apply. That makes CDR
  partly a test of agreeing with this order. CDR should be read with that in mind; VSAR does not
  require the reason.
- Case authors also wrote the reference baseline. No ground truth was changed after baselines were run,
  but the ground truth and the baseline share the same mental model, which inflates its public score.

## Second-order risks

- **Goodhart.** If OAR becomes a headline, systems will over-hold. The paired-metric statement form
  is the defence, and should be insisted on in reviews.
- **False assurance.** "0 of 18" may be read as "safe". The zero-of-n bound (up to 15%) must travel with it.
- **Rule export.** The rules are written for a fictional world. Adopting them as policy in a real
  domain without domain review would be a misuse.
- **Vendor framing.** The benchmark is published by Tinor. Even with no Tinor adapter and no Tinor
  result, independence is limited until others hold the hidden set and run systems.
- **Disclosure model.** DLR treats the existence of a record as secret. Some domains require the
  opposite (public registers). Results do not transfer across that difference.

## Reproduction guide

See REPRODUCE.md. In short: `npm test`, then `node baselines/run-baselines.mjs` and compare
`baselines/results/` (only the wall-time table may differ). The v1 numbers reproduce with
`node v1/fact-admission/score.mjs v1/fact-admission/cases.json --baseline always-reject`.
