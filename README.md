# Invalid State Admissions Benchmark — admission cases and disposition scorer

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.23447898.svg)](https://doi.org/10.5281/zenodo.23447898)

Companion repository for the Tinor Journal research note
[Toward Zero Invalid State Admissions: A Benchmark Proposal](https://tinor.io/journal/toward-zero-invalid-state-admissions).

> **Status: proposal.** The note defines a benchmark and reports **no** results. No system, including
> Tinor's, is claimed to achieve zero invalid admissions. The numbers below are properties of the case
> file, computed by the published scorer, not measurements.

## What it measures

The proposal scores what a stateful AI system *admits into shared state*, not only what it answers.
For each proposition in an input, the expected **disposition** is an outcome — `ADMIT`,
`ADMIT-QUALIFIED`, `HOLD`, `REFUSE` or `NO-CHANGE` — and a reason. The note defines five metrics
(ISAR, VSAR, CDR, SRA, UFR) and three trivial baselines that any credible result must beat:
**always-reject**, **always-hold** and **always-admit**.

This repository contains the ten synthetic admission cases and the disposition-only scorer published
with the note, unchanged from the downloads on tinor.io:

| File | What it is |
| --- | --- |
| [`fact-admission/cases.json`](fact-admission/cases.json) | Ten synthetic write cases with human-defined expected outcomes and reasons. |
| [`fact-admission/score.mjs`](fact-admission/score.mjs) | Compares declared outcomes and reasons only, and reports CDR and disposition-level ISAR and VSAR for any outputs file or built-in baseline. No dependencies. Not Tinor code. |
| [`fact-admission/README.md`](fact-admission/README.md) | What is synthetic, what is checked, what is not, and how to run it. |

**What is not checked.** The scorer compares only the two labels. It does not check entity binding,
evidence level, validity period, authority or whether any record was persisted, so its ISAR and VSAR
are disposition-level simplifications of the metrics in the note. SRA, UFR and TCR are not computed
here; TCR is reserved for a future end-to-end evaluation. A file containing exactly the expected labels
scores 10/10 CDR; that shows the labels match, not that anything was admitted correctly.

## How to run

Requires Node.js 18 or later. No install step.

```sh
cd fact-admission
node score.mjs cases.json --baseline always-reject
# cases 10 · ISAR (disposition) 0/8 · VSAR (disposition) 0/3 · CDR 0/10 · outcome-only 4/10
node score.mjs cases.json --baseline always-hold
# cases 10 · ISAR (disposition) 0/8 · VSAR (disposition) 0/3 · CDR 0/10 · outcome-only 3/10
node score.mjs cases.json --baseline always-admit
# cases 10 · ISAR (disposition) 8/8 · VSAR (disposition) 0/3 · CDR 0/10 · outcome-only 2/10
node score.mjs cases.json my-outputs.json
```

`my-outputs.json` maps every case id to a declared disposition:
`{ "<case id>": { "outcome": "...", "reason": "..." | null } }`. Every case must be present exactly
once; a missing case, an unknown id, an outcome or reason outside the vocabulary, or a malformed entry
is an error (exit code 2), and nothing defaults to `NO-CHANGE`. Each run also prints the scope line.

Ten cases with three valid ones is a worked example, not a benchmark. See the
[note](https://tinor.io/journal/toward-zero-invalid-state-admissions) for the case families a full set should cover and for how results should be reported
(ISAR is never reported alone).

## How to cite

Archived on Zenodo. The DOI below refers to all versions and always resolves to the latest one:
[10.5281/zenodo.23447898](https://doi.org/10.5281/zenodo.23447898).

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

- Code (`fact-admission/score.mjs`): [MIT](LICENSE).
- Data and documentation (`fact-admission/cases.json`, the README files): [CC BY 4.0](LICENSE-DATA).

Copyright © 2026 Tinor. If you use these files, please cite them as above
and link to the [canonical article](https://tinor.io/journal/toward-zero-invalid-state-admissions).
