# Changelog

## 2.1.0 (2026-10-18)

Scorer-correctness release, archived as a new Zenodo version under the concept DOI
10.5281/zenodo.23447898. 2.0.0 (10.5281/zenodo.23449349) and 1.0.0 (10.5281/zenodo.23447899) and their
files are unchanged. Each fix was driven by a mutation test written first and failing against the code
before it (`test/scorer-fixes.test.mjs` against 2.0.0, `test/scorer-fixes-2.test.mjs` against the first
round).

### Fixed

- **Fabricated extra record fields passed IPAR (P0-1).** `recordMismatches` compared only the fields the
  ground truth listed. It now compares `fields` in full: an extra non-null field is
  `unsupported_field` unless the ground truth declares it in the new `optionalFields` (allowed variance).
  METRICS.md, Section 2.1.
- **Extra served fields passed SRA and UFR (P0-2).** `compareAnswer` checked only the expected fields. An
  extra field is now `unexpected_field` (not in the contract) or `unsupported_additional_claim` (no
  record of the admissible state holds that value), wrong for SRA and unsupported for UFR. Section 2.3.
- **Temporal attribution was not checked (P1-3).** A record's `step`, `submittedBy` and `recordedAt` are
  now matched to the step that submitted its candidate, with an explicit one-second tolerance
  (`wrong_step`, `wrong_submitter`, `wrong_recorded_at`, `backdated_commit`, `future_dated_commit`), and
  count in IPAR. Section 2.2.
- **Only the final state was checked (P1-4).** The runner now exports state after every step and after
  every read; the scorer scores every observed version of every record, so an invalid admission that is
  later deleted or overwritten counts, and a read that changes state (even if a later read reverts it)
  is a new critical failure, `STATE_CHANGED_BY_READ`. A 2.1 output without snapshots is a system error.
  Section 2.4.
- **Record properties the ground truth did not list were unchecked.** A fake `confirmedBy` on the o01
  offer, an invented audience or supersedes/withdraws link, any validity where the ground truth was
  silent, or the same record filed in a sibling target all passed. Every semantic property is now
  compared; audience, links and confirmations default to null; further values only through the new
  `allowedVariance`. Section 2.1.
- **Extra-field support ignored time and the alternative taken.** Support is now the record the read
  resolves to by R-READ-1/3 in the admissible state under the alternative the system took; an expired
  or withdrawn record supports fields only with its qualifier. Section 2.3.
- **Two value reads did not check attribution** (o02 q1, p01 q2); they now state it, and a test requires
  every value expectation to.
- **Duplicates were scored first-match.** Identical duplicate decisions or answers count once; differing
  ones are `conflicting_decisions` / `conflicting_answers` and wrong, and a revealing duplicate on a
  restricted read leaks. Section 2.5.
- **Quotes.** No rule or contract requires an evidence quote (R-EV-1, R-EV-2), so a quote-less record
  stays valid; contracts can now set `quoteRequired` (`quote_missing`). None does in 2.1.0.

### Compatibility

- **Adapter contract `isa-adapter/2.1`.** `exportRecords()` is called after every step and once after
  reads (was: once). It must be side-effect free and reflect current state; reads must not change state;
  a step's writes must be visible when `submit` resolves. 2.0.0 adapters that meet this run unchanged.
  ADAPTERS.md.
- **Output schema `isa-run-output/2.1`** (`benchmarkVersion` 2.1.0) adds per-case `snapshots`; `records`
  keeps its 2.0.0 meaning. `isa-run-output/2` files still validate and are scored on `records` only, as
  in 2.0.0; `metrics.coverage.casesWithSnapshots` tells the two apart. The `recorded` adapter replays
  either. `examples/output.v2.0.example.json` keeps the old format.
- **Snapshots** are `{ after, records }` per step (`after` = step id) and per read (`after` = `read:<id>`).
  They are self-reported by the adapter (ADAPTERS.md).
- **Metrics object:** new keys `critical.STATE_CHANGED_BY_READ` and `coverage.casesWithSnapshots`.
- **Ground-truth schema:** new optional `optionalFields` and `allowedVariance` on expected records.
- **Ground-truth data** (intended answers unchanged; each value from the source text and equal to the
  record the oracle already wrote): probe x05 gained the `fields` it lacked (as f03); validity stated for
  f01, f03, f04, m03, o03, r03, v04 and probes x05, x07; `attributedTo` added to o02 q1 and p01 q2;
  `allowedVariance` for the offerer's own confirmation on the offers o01, t02, o03 and x07. Case files and
  the `benchmarkVersion` field of data files (format version 2.0.0) are unchanged.
- **Numbers:** every baseline metric on the public set and the probes is unchanged (regenerated
  `baselines/results/`; only the wall-time table differs). Results of other systems can change, and
  2.0.0 and 2.1.0 results are not comparable for systems with extra fields, wrong timestamps, or state
  that changes between steps or during reads.

## 2.0.0 (2026-10-18)

Released as a new Zenodo version under the concept DOI 10.5281/zenodo.23447898; v1.0.0 and its
version DOI (10.5281/zenodo.23447899) are unchanged.

### Breaking changes

- New case format and **new output schema** (`isa-run-output/2`). v1 output files are not accepted by the
  v2 scorers; they still work with `v1/fact-admission/score.mjs`.
- v1 files moved, unchanged, from `fact-admission/` to `v1/fact-admission/`.
- The headline over-admission metric is now **OAR**, computed on persisted records. The name ISAR is not
  reused in v2, so that it keeps a single meaning (the v1 definition).

### Added

- Level 2 runner with an architecture-neutral adapter contract; scoring of persisted records, read
  answers and history; Level 1 scorer for v2 cases.
- Metrics OAR, IPAR, DLR and CPR; implemented VSAR (on records), SRA and UFR; critical failures; system
  errors with worst-case variants; exact intervals and zero-of-n bounds.
- 39 synthetic cases in 12 families, each family with legitimate admissions; declared rules, contracts
  and qualifiers; opaque case ids; ground truth with rule references and rationales; support for
  several acceptable answers.
- Baselines: three trivial, one non-LLM reference baseline (measured), LLM harness for three proposed
  baselines (not run), recorded-output adapter, oracle mock for scorer tests.
- Seven brittleness probes; 48 node:test tests; JSON Schemas; generated RULES.md and CASES.md; REVIEW.md,
  CONSISTENCY.md, REPRODUCE.md.

### Ground-truth corrections to v1 cases

Each v1 case maps to one or more v2 cases (CASES.md, "v1 to v2 mapping"). Four expectations changed:

| v1 | v1 expectation | v2 | v2 expectation | Why (rules) |
|---|---|---|---|---|
| a03 "Capacity: 46,000 units/month" proposed as output | HOLD, period missing | e04 | REFUSE `wrong_target_semantics` | A capacity rate is not units produced in a month. Asking for "the month" would invite an invented one. The admissible proposition is a rate (v03), a different proposal. The contracts now separate `capacity_rate` and `monthly_output` (R-SEM-1). |
| a05 hedged delivery ("should be able to … assuming the resin arrives") | ADMIT-QUALIFIED | v02 and o04 | ADMIT-QUALIFIED `stronger_than_source` as an expectation with its condition (v02); HOLD `commitment_not_made` when the target accepts only firm positions (o04) | v1 left it open whether ADMIT-QUALIFIED or HOLD was right. v2 makes the answer depend on a visible constraint, the target contract's record types (R-QUAL-1). |
| a06 firm offer, buyer has not accepted | HOLD, confirmations pending | o01 | ADMIT-QUALIFIED `offer_not_agreement`, written as an offer with its validity | The offer is true and useful state; withholding it loses information. It must not be upgraded to a bilateral agreement until both parties have committed to identical terms (R-OFFER-1). o02 and o03 add the acceptance and counter-offer. |
| a09 lab issues its own report | ADMIT, reason "independent issuer" | f03 (and f04) | ADMIT `issuer_attestation`; reads carry `independence-not-established` and `accreditation-not-established` (or `issuer-accredited` only when an accreditation body's record exists, f04) | Issuing a report establishes who issued what. It does not establish the lab's independence, its accreditation, or that the content was verified by a third party (R-ATT-2). The v1 reason overstated this. |

Unchanged in substance: a01 (e01), a02 (m01), a04 (f05), a07 (f01), a08 (f02), a10 (f07).

### v1 compatibility note

The v1.0.0 definitions (disposition-level ISAR and VSAR, CDR, outcome-only) and its ten cases are
preserved verbatim in `v1/fact-admission/` and reproduce the published numbers (`test/v1.test.mjs`). They
are documented, not deprecated: a v1 score remains a valid statement about v1. v2 scores are not
comparable with v1 scores, because the cases, four expectations and the scoring level changed. METRICS.md,
Section 8, maps each v1 metric to its v2 counterpart.

## 1.0.0 (2026-10-18)

Ten synthetic admission cases and a disposition-only scorer, as published with the research note.
Zenodo version DOI 10.5281/zenodo.23447899 under concept DOI 10.5281/zenodo.23447898.
