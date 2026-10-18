# Invalid State Admissions Benchmark

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.23447898.svg)](https://doi.org/10.5281/zenodo.23447898)

**When an AI system changes shared state, what makes that change admissible?** This benchmark scores
what a stateful AI system *writes* and what it *serves from what it wrote*, not only what it answers.
It checks each proposal at the level of the proposition: subject, evidence, authority, time, disclosure
and whether the persisted record says exactly what the source supports.

Companion repository for the Tinor Journal research note
[Toward Zero Invalid State Admissions](https://tinor.io/journal/toward-zero-invalid-state-admissions).

> **Status: v2.1.0 (released 2026-10-18).** A public, synthetic, open case set with a runnable
> evaluation protocol. **No result is reported for any AI system, including Tinor's.** The only numbers
> here are for three trivial baselines and one non-LLM reference baseline written by the benchmark
> authors with knowledge of the public cases (see [BASELINES.md](BASELINES.md)). No language-model
> baseline has been run.

## About these files

1. **Synthetic.** Every party, document and number is fictional. No real supplier, customer or event.
2. **Independent of any product.** This is an evaluation harness written for the research note. It is not
   Tinor code and contains no adapter for Tinor or any other product. Its rules, reason names and rule
   order are the benchmark's own.
3. **What is checked.** Declared dispositions (Level 1); persisted records, history, served answers per
   viewer and time, critical failures and system errors (Level 2). See [METRICS.md](METRICS.md).
4. **What is not checked.** Whether an adapter exports what its system really stored; task completion
   in real workflows (TCR, reserved); anything outside the declared rules; real-world truth.
5. **How to verify.** `npm test`, then `node baselines/run-baselines.mjs`; see [REPRODUCE.md](REPRODUCE.md).
6. **Human-defined expectations.** All expected outcomes, records and answers were written by the
   benchmark authors against [RULES.md](RULES.md), before any baseline was run, and have not yet been
   reviewed by independent annotators ([REVIEW.md](REVIEW.md)).

## What is new in v2

- **Two levels.** Level 1 scores declared dispositions, as v1 did. Level 2 runs a system through an
  [adapter](ADAPTERS.md) (initial state → steps → exported records → reads) and scores the **persisted
  records** and the **served answers** against [ground truth](CASES.md).
- **Inputs separated from ground truth.** `cases/` holds only what a system may see, under opaque ids.
  Expected outcomes, records, answers, rationales and the readable label of each case are in `ground-truth/`.
- **New metrics** ([METRICS.md](METRICS.md)): OAR, IPAR, VSAR, CDR, SRA, UFR, DLR and CPR, plus critical
  failures and system errors counted separately, with exact intervals and zero-of-n upper bounds.
- **39 cases in 12 families**, each family with legitimate admissions so that refusing is never correct by
  default. Four v1 expectations were corrected (A03, A05, A06, A09); see [CHANGELOG.md](CHANGELOG.md).
- **Declared rules** ([RULES.md](RULES.md)) and target contracts that systems receive, so ground truth can
  cite the rule it applies.
- **v1 kept intact** under [`v1/fact-admission`](v1/fact-admission) so v1.0.0 numbers still reproduce.

## Quick start

Node.js 22 or later. No dependencies, no install step.

```sh
npm test                                              # 86 tests (node:test)
node run.mjs --adapter reference-rules                # Level 2: run, score, print
node run.mjs --adapter always-admit                   # a trivial baseline
node score-dispositions.mjs --baseline always-reject  # Level 1
node baselines/run-baselines.mjs                      # regenerate baselines/results/
```

To evaluate your system, copy [`examples/adapter-template.mjs`](examples/adapter-template.mjs) and run
`node run.mjs --adapter ./your-adapter.mjs --out run.json`. Recorded outputs from any language or
harness can be scored with `node score.mjs run.json`. [REPRODUCE.md](REPRODUCE.md) has the full procedure.

## Repository map

| Path | What it is |
|---|---|
| `cases/` | 39 system-visible cases (opaque ids). Data, CC BY 4.0. |
| `ground-truth/` | Scorer-only expectations, rationales and rule references. Data, CC BY 4.0. |
| `spec/` | Vocabulary, target contracts and rules handed to systems. |
| `schemas/` | JSON Schemas for cases, ground truth, records and run outputs. |
| `lib/` | Runner, Level 1 and Level 2 scorers, statistics, schema validator. Code, MIT. |
| `run.mjs`, `score.mjs`, `score-dispositions.mjs` | Command-line entry points. |
| `adapters/` | Trivial baselines, the reference-rules baseline, the oracle mock (scorer testing only), the recorded-output adapter and the LLM harness (not run). |
| `baselines/results/` | Generated outputs and scores of the baselines that were run. |
| `probes/` | Seven paraphrase probes, written after the reference baseline, that measure its brittleness. Not part of the scored set. |
| `examples/` | Adapter template, example output and decision files, a scripted stand-in model for harness tests. |
| `test/` | node:test suite. |
| `v1/fact-admission/` | v1.0.0 cases, scorer and README, unchanged. |
| [METRICS.md](METRICS.md), [RULES.md](RULES.md), [CASES.md](CASES.md), [ADAPTERS.md](ADAPTERS.md), [BASELINES.md](BASELINES.md) | Specification. RULES.md and CASES.md are generated. |
| [REVIEW.md](REVIEW.md), [CONSISTENCY.md](CONSISTENCY.md), [REPRODUCE.md](REPRODUCE.md), [CHANGELOG.md](CHANGELOG.md) | Strict self-review (not independent), article-code consistency check, reproduction guide, change log. |

## What this benchmark is and is not

It **is** a precise, executable definition of admissibility for a small set of synthetic write
scenarios, with metrics that a trivial policy cannot satisfy jointly. It is **not** yet a basis for
comparing systems: the set is public and small, its rules and ground truth were written by one party,
and the reference baseline shows that the public set can be solved by rules written with knowledge of it.
Formal comparison needs a hidden, refreshed set and independent judges ([REVIEW.md](REVIEW.md)).

## How to cite

The concept DOI refers to all versions and resolves to the latest released one:
[10.5281/zenodo.23447898](https://doi.org/10.5281/zenodo.23447898). Each release also has its own
version DOI, listed on the Zenodo record. Cite the exact version you used.

> Tinor (2026). Invalid State Admissions Benchmark: admission cases and disposition scorer. Zenodo.
> https://doi.org/10.5281/zenodo.23447898

```bibtex
@software{tinor_invalid_state_admissions_benchmark,
  author    = {{Tinor}},
  title     = {Invalid State Admissions Benchmark: admission cases and disposition scorer},
  year      = {2026},
  publisher = {Zenodo},
  doi       = {10.5281/zenodo.23447898},
  url       = {https://doi.org/10.5281/zenodo.23447898}
}
```

Citation metadata is also in [`CITATION.cff`](CITATION.cff).

## License

- Code (`lib/`, `adapters/`, `tools/`, `baselines/*.mjs`, `test/`, `examples/*.mjs`, `*.mjs`, `v1/fact-admission/score.mjs`): [MIT](LICENSE).
- Data and documentation (`cases/`, `ground-truth/`, `probes/`, `spec/`, `schemas/`, `baselines/results/`, `examples/*.json`, `v1/fact-admission/cases.json`, all Markdown files): [CC BY 4.0](LICENSE-DATA).

Copyright © 2026 Tinor. If you use these files, please cite them as above and link to the
[canonical article](https://tinor.io/journal/toward-zero-invalid-state-admissions).
