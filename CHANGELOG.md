# Changelog

## 2.0.0 (candidate, unreleased)

Not yet tagged or released. When released, it will be a new Zenodo version under the concept DOI
10.5281/zenodo.23447898; v1.0.0 and its version DOI are unchanged.

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
