# Consistency: article, code, metrics and cases

Item-by-item check of the research note *Toward Zero Invalid State Admissions*
(tinor.io/journal/toward-zero-invalid-state-admissions, revision of 18 October 2026) against this repository.

"Automated" means a test fails if the item drifts: **B** = a test in this repository, **J** = a test in the
journal site's repository (`tests/journal-reference-models.test.mjs`). "Manual" means checked by reading
when this file was written.

**2.1.0 (unreleased, branch `v2.1-scorer-fixes`).** The scorer fixes change definitions in METRICS.md
(Sections 2.1 to 2.4) but no baseline number. Rows 10, 11, 15 and 17 and the new rows 31 to 34 describe
2.1. Where the published article (which describes 2.0.0) is now behind, the row says **article pending**;
those edits wait for the 2.1.0 release.

| # | Item | Article | Code / data | METRICS.md | Check |
|---|---|---|---|---|---|
| 1 | Unit counts: 39 cases, 41 propositions, 58 reads, 3 restricted, 26 legitimate admissions | Benchmark design, family table | `cases/`, `ground-truth/`, `aggregate().units` | Section 2 | Automated B (docs test) and J (family table vs CASES.md) |
| 2 | Twelve families and per-family counts | family table | `ground-truth/*.json` `family`; CASES.md (generated) | — | Automated B (CASES.md regenerated) and J (row by row) |
| 3 | Every family has a legitimate admission | "each with legitimate admissions" | ground truth | — | Automated B (data test) |
| 4 | Cases separate from ground truth; opaque ids; no family/title visible | Benchmark design | `schemas/case.schema.json`, `lib/runner.mjs` | — | Automated B (isolation test) |
| 5 | Ground truth loaded only after the run | flow table, step 4 | `run.mjs`, `lib/runner.mjs` | — | Automated B (isolation test: the runner never loads ground truth); in-process adapters can still read disk (REVIEW.md) |
| 6 | 25 numbered rules | Benchmark design | `spec/rules.json`, RULES.md | — | Manual (count 25) |
| 7 | Delivery strengths expectation 1, offer 2, agreement 3 | Benchmark design, Metrics | `spec/contracts.json` | Section 3 | Manual |
| 8 | Running case: offer text, ADMIT-QUALIFIED as offer, validity 5–31 Oct, case o01; expiry t02; acceptance o02 | A running case | `cases/case-10f3c3.json`, ground truth o01, t02, o02 | Section 7 | Manual (text copied from the case file) |
| 9 | OAR definition and denominator 18 | Metrics table | `lib/score.mjs` `inOarDenominator`, `over` | Section 3 | Automated B (docs test, scorer tests) |
| 10 | IPAR definition, denominator 41, blind spot of OAR; 2.1: full field comparison, temporal attribution, every observed version | Metrics (2.0.0 wording; article pending for 2.1) | `recordMismatches`, `temporalDefects`, `invalidPersisted` over `V(p)` | Sections 2.1, 2.2, 2.4, 3 | Automated B (mutation tests: wrong subject, evidence, validity, authority; 2.1: extra field, step, recordedAt, submitter, delete/overwrite) |
| 11 | UFR denominator = served answers, n/a when none; 2.1: an unexpected or unsupported extra field makes a served answer unsupported | Metrics table (article pending for the extra-field rule) | `served`, `rate()`, `extraFieldCodes` | Sections 2.3, 3 | Automated B (scorer tests, scorer-fixes tests) |
| 12 | DLR: any revealing content, including markers; denominator 3; also critical | Metrics table | `compareAnswer`, `leak` | Section 3 | Automated B (disclosure test) |
| 13 | VSAR on records, same alternative, reason not required, denominator 26 | Metrics table | `right`, `inVsarDenominator` | Section 3 | Automated B |
| 14 | CDR = outcome and reason, all propositions | Metrics table; v1 section | `dispOk` | Section 3 | Automated B; J checks the phrase "Correct Disposition Rate (CDR)" |
| 15 | SRA exact qualifier set, denominator 58; 2.1: no unexpected or unsupported extra field | Metrics table (article pending for the extra-field rule) | `compareAnswer` | Sections 2.3, 3 | Automated B |
| 16 | CPR definition; not TCR; TCR reserved | Metrics | `pass` | Section 3 | Automated J (`TCR … reserved`, no TCR column) |
| 17 | Critical failures: three types in 2.0.0, four in 2.1 (`STATE_CHANGED_BY_READ`), counted not averaged | Metrics (says three; **article pending**) | `authorityViolation`, history check, `leak`, read-time state check | Section 3 | Automated B |
| 18 | System errors count against ability; worst-case OAR/IPAR | Metrics | `errored`, `OAR_worst`, `IPAR_worst` | Section 3 | Automated B |
| 19 | Zero-of-n bound 1 − 0.05^(1/n); 18 → 15%; 300 → 1%; 3,000 → 0.1% | Metrics | `lib/stats.mjs` | Section 5 table | Automated B (stats test); article rounds 0.153 to 15% |
| 20 | Level 2 baseline table, 5 rows × 9 values | Baselines | `baselines/results/SUMMARY.md` | — | Automated J (article rows vs attached SUMMARY.md) and B (results vs fresh run) |
| 21 | always-admit: 10 critical failures (7 unauthorised writes, 3 leaks) | Baselines bullets | `always-admit.scores.json` | — | Manual (scores file) and J (critical column) |
| 22 | Probe wording ("anticipate", "each month", "expires on", "18 000") and 4 of 7 failed | Baselines | `probes/cases/*.json`, probe scores (CPR 3/7) | — | Manual (texts) and J (CPR cell) |
| 23 | Level 1: always-reject 11/41 outcomes, always-admit 20/20, always-hold 2/41 | Baselines | SUMMARY.md Level 1 table | Section 4 | Manual (SUMMARY.md, regenerated by run-baselines) |
| 24 | LLM baselines not run, no numbers | Baselines | `adapters/llm-harness.mjs` default throws "not configured" | — | Automated B (harness test); manual (no numbers in article) |
| 25 | Four v1 corrections (a03, a05, a06, a09) | Four corrections | ground truth e04, v03, v04, v02, o04, o01, f03, f04 | Section 8 | Manual; CHANGELOG.md table |
| 26 | v1 table rows and v1 reproduction | Version 1 compatibility | `v1/fact-admission/`, journal attachment `fact-admission/` | Section 8 | Automated B (v1 test) and J (existing A03 test) |
| 27 | v2 attachments identical to repository files | Reproduce; attachments | `MANIFEST.json` in the journal attachment folder | — | Automated J (SHA-256 manifest) |
| 28 | No product adapter; no Tinor result; architecture-neutral contract | Benchmark design, What this note does not claim | `adapters/` | — | Manual (listing) |
| 29 | Cost: no model calls, milliseconds | Baselines note | SUMMARY.md cost table | — | Manual |
| 30 | Citations | Related work, References | — | Section 5 (two statistics citations) | Manual: every URL opened during preparation |
| 31 | 2.1: adapter contract isa-adapter/2.1 (export after every step and after reads; reads side-effect free) | Benchmark design, flow table (describes 2.0.0; **article pending**) | `lib/runner.mjs`, ADAPTERS.md | Section 2.4 | Automated B (scorer-fixes: write-then-delete, overwrite, read changes state) |
| 32 | 2.1: output schema isa-run-output/2.1 with `snapshots`; isa-run-output/2 still accepted | Reproduce (**article pending**) | `schemas/output.schema.json`, `examples/` | Section 2.4 | Automated B (compatibility test) |
| 33 | 2.1: recordedAt tolerance `step.at ≤ t < step.at + 1 s` | — (not in the article) | `temporalDefects`, `RECORDED_AT_TOLERANCE_MS` | Section 2.2 | Automated B |
| 34 | 2.1: baseline numbers unchanged by the scorer fixes | Baselines table (still correct) | `baselines/results/` regenerated | — | Automated B (results vs fresh run) and J (article rows vs SUMMARY.md) |

## Known differences (intentional)

- The article rounds the zero-of-n bound for 18 (0.153) to "up to 15%".
- The article's family names are prose versions of the family ids.
- The article names the trivial baselines' reader "a reader that applies no time, withdrawal or
  disclosure rule". The code calls it the naive reader (`adapters/_naive.mjs`).
- The article does not repeat the wall-time table, which is not deterministic.
