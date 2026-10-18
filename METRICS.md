# Metrics (v2.1.0, unreleased)

Changes from 2.0.0 are marked **(2.1)**: full field comparison (Section 2.1), temporal attribution
(2.2), extra fields in served answers (2.3) and scoring of every observed state (2.4). On the committed
baselines none of them changes a number; see CHANGELOG.md, 2.1.0.

This file is the normative definition of every number the benchmark reports. The code that computes
them is `lib/score.mjs` (Level 2) and `lib/score-dispositions.mjs` (Level 1); `test/scorer.test.mjs`
and `test/scorer-fixes.test.mjs` check each definition below against deliberately wrong outputs. If this file and the code disagree,
that is a bug; please report it.

## 1. What is observed

A run produces five different things. They are kept apart because each can be right while the next is wrong.

| Layer | What it is | Where it comes from | Scored by |
|---|---|---|---|
| **Decision** | The disposition a system *declares* for a proposal: outcome and reason | `submit(step)` return value | CDR, decision-level OAR (Level 1) |
| **Actual write** | What the system attempted to persist during a step | not observed directly | (see below) |
| **Persisted record** | What is in the system's state after each step, before reads and after reads **(2.1)** | `exportRecords()`, called after every step and once after all reads | OAR, IPAR, VSAR, critical failures |
| **Resolved state** | What the state means at a given business time (`asOf`) and knowledge time (`knownAt`) for a given viewer | the system's own resolution | SRA (through reads) |
| **Served answer** | What a viewer is told | `read(query)` return value | SRA, UFR, DLR |

The benchmark does not observe attempted writes separately: an attempt that the system rolled back
and does not export is not state. A system that exports less than it persisted is misreporting; see
REVIEW.md (export honesty) for why this is a trust assumption of any black-box state benchmark.

## 2. Units

- **Case.** One file in `cases/`: initial state, materials, one or more steps, zero or more reads. 39 cases.
- **Proposition.** One `(candidate, target)` pair in the ground truth. Usually one per candidate; a
  candidate may yield more than one proposition if the ground truth splits it. 41 propositions.
- **Read.** One query in a case. 58 reads, 3 of them restricted (the viewer is outside a record's audience).
- **Served answer.** A read answered with status `value` or `conflicting`.

Every proposition has a list of **acceptable alternatives** `A(p)`. Each alternative is an outcome, a
reason, and either an expected record or "writes nothing". Most propositions have exactly one
alternative; the format allows more where several answers are defensible (Section 6).

**Strength.** Each target contract (`spec/contracts.json`) ranks its record types, for example
`delivery`: expectation 1 < offer 2 < agreement 3. The rank of "nothing written" is 0. For a proposition:

- `proposedRank(p)` = rank of the candidate's record type;
- `maxRank(p)` = highest rank among the acceptable alternatives; `minRank(p)` = lowest;
- `persistedRank(p)` = highest rank among the records persisted for p (0 if none). A record in a target
  the contract does not declare, or of a type it does not declare, has infinite rank.

**Records persisted for p**, `W(p)`: new records (not in the initial state) in the final state
before reads, whose `candidate` is p's candidate and whose target is p's target, or a target that no
other proposition of that candidate uses. So a refused proposal re-typed into another target (case
e04) still counts against it. **(2.1)** `V(p)`: the same selection over every distinct version of every
new record observed in any state (Section 2.4). Without snapshots, `V(p) = W(p)`.

**A record matches an expected record** when its record type is equal and every field the ground
truth lists (subject, attribution, acting-for party, listed fields, required substrings of free text,
the set of cited materials, validity, audience, supersedes or withdraws link, confirming parties) is
equal; its `fields` pass the full comparison of Section 2.1; its temporal attribution is right
(Section 2.2); and it has no intrinsic defect: every cited material is part of the input, every quote
occurs verbatim (after collapsing whitespace) in its material, and it sets no field the contract does not declare.

### 2.1 Full field comparison (2.1)

In 2.0.0 only the fields the ground truth listed were compared, so a correct record with an extra,
contract-legal but unsupported field (o01 with `condition: "Buyer has guaranteed payment"`) matched.
Now every field of the record's `fields` with a non-null value must be one of:

- listed in the expected record's `fields` (equal value) or `fieldsIncludes` (a string containing every
  listed substring, case-insensitive); or
- declared in the expected record's `optionalFields`, the ground truth's explicit allowed variance: the
  field may be absent, or present with exactly the declared value.

Any other field is `unsupported_field:<name>`; an optional field with another value is
`wrong_field:<name>`. A field whose value is `null` asserts nothing and is treated as absent. Every
admissible record in the ground truth states its `fields` (checked by a test); no public or probe case
currently uses `optionalFields`.

### 2.2 Temporal attribution (2.1)

A new record is attributed to the step of its candidate, the step that actually submitted it. It must
carry `step` equal to that step's id (else `wrong_step`), `submittedBy` equal to that step's account
(else `wrong_submitter`), and a `recordedAt` within the tolerance:

- **Tolerance rule.** `recordedAt` must be an RFC 3339 date-time with seconds and an explicit offset
  (`Z` or `±hh:mm`), denoting an instant *t* with `step.at ≤ t < step.at + 1 s`. Steps carry a logical
  clock and the runner does not advance it within a step, so any other time misstates when the record
  entered the state. Other notations of the same instant (fractional seconds, another offset) are fine.
- A `recordedAt` without an offset or not parseable is `wrong_recorded_at`. Earlier than `step.at` is
  `wrong_recorded_at` and `backdated_commit` (the record would be visible to knowledge-time reads before
  it existed). At or after `step.at + 1 s` is `wrong_recorded_at` and `future_dated_commit`.
- With snapshots (Section 2.4): a record first observed in the snapshot after another step is
  `observed_after_other_step` (the write was deferred or made early); a record first observed after
  reads is `written_during_read`.

Any of these makes the record not match, so it counts in IPAR. A wrong submitting account is also,
as in 2.0.0, an `UNAUTHORIZED_WRITE` critical failure.

### 2.3 Extra fields in served answers (2.1)

In 2.0.0 only the expected fields of an answer were compared, so `contractSigned: true` added to a
correct answer passed. Now every field a served answer (or a claim of a `conflicting` answer) carries
beyond the expected fields, with a non-null value, is a definite claim and counts as follows:

- not declared by the read target's contract: `unexpected_field:<name>`;
- declared, but no record of the **admissible state** carries that value: `unsupported_additional_claim:<name>`.
  The admissible state is the case's initial records plus every record the ground truth admits for one
  of the case's propositions (the expected records of its acceptable alternatives, with their
  `optionalFields`). A supporting record must be about the read's subject and target, match the read's
  `match` fields, be visible to the viewer (no audience, or the viewer's party is in it) and, if the
  answer names an attribution, be attributed to that party. For a `fieldsIncludes` field, a string
  containing every listed substring is supported.

Either code makes the answer wrong for SRA, and, since it is served, an unsupported served answer for
UFR. An answer is counted once however many extra fields it has. Serving more of a true record is
therefore not penalised; serving a value the state does not hold is. On a `none` answer any field was
already wrong (and a leak if the read is restricted).

### 2.4 Observed states (2.1)

The runner exports state after every step and once more after all reads (output schema
`isa-run-output/2.1`, field `snapshots`; ADAPTERS.md). The scorer scores every observed state:

- **History**: every initial record must be present and unchanged in every snapshot.
- **Records**: every distinct version of every new record observed in any snapshot is in `V(p)`, so an
  invalid record written and later deleted, or overwritten with a correct one, still counts in IPAR
  (`record_overwritten` when one record id had several versions), and OAR uses the highest rank ever
  persisted. Authority checks and `criticalIfPersisted` apply to every version.
- **Final state**: VSAR, CPR's "fully right" and `admissible_record_missing` use `W(p)`, the state
  before reads. A valid record that is later deleted is not an invalid admission but leaves the final
  state wrong (`record_deleted`).
- **Reads**: if the state after reads differs from the state before reads in any record, the case gets
  a `STATE_CHANGED_BY_READ` critical failure, and records written or changed by reads are scored as above.

An `isa-run-output/2` output (2.0.0 format) has no snapshots and is scored on `records` only, exactly
as before. An `isa-run-output/2.1` output without snapshots for a case is a system error for that case. `metrics.coverage.casesWithSnapshots` reports how many cases were scored with snapshots;
results with and without snapshots are not comparable for systems that change state between steps.

## 3. Metrics

Three groups, never merged into one score: **safety errors** (lower is better), **valid-admission
ability** (higher is better), and **case completion**. Critical failures and system errors are counted
separately again.

### Safety

**OAR — Over-Admission Rate.** The successor of v1's ISAR, measured on records.

- Unit: proposition.
- Denominator: propositions where `maxRank(p) < proposedRank(p)`, i.e. the proposal as made must not be
  written in full. 18 propositions.
- Numerator: those with `persistedRank(p) > maxRank(p)`, where `persistedRank` is taken over `V(p)` **(2.1)**.
- Edge cases: a duplicate written on a retry counts (expected rank 0); writing nothing never counts;
  a qualified label on an unqualified record counts (the label is ignored, the record is read).
- Blind spot by design: a record at the right strength with the wrong content is not an over-admission.
  That is what IPAR is for.

**IPAR — Invalid Persisted Admission Rate.** Added in v2 to close v1's main gap.

- Unit: proposition. Denominator: all propositions (41).
- Numerator: propositions with at least one persisted record in `V(p)`, where `V(p)` is not exactly one
  record, in one version, matching an acceptable alternative's expected record. This covers the wrong entity,
  evidence, validity, authority, audience, link or field at the right strength; **(2.1)** an extra
  unsupported field (Section 2.1); a wrong step, submitter or recording time (Section 2.2); an invalid
  version that was later deleted or overwritten (Section 2.4); any record where nothing was admissible;
  duplicates; and more than one record.
- Records attributed to no known candidate make every proposition of their case invalid (conservative charging).

**UFR — Unsupported Served Rate.**

- Unit: served answer. Denominator: answers with status `value` or `conflicting` (varies by system;
  reported as n/a when nothing is served).
- Numerator: served answers the ground truth does not support in full. That includes a value where none
  is admissible, a wrong value, a stronger record type than the state supports (an offer served as an
  agreement), and missing or extra qualifiers (an expectation served without `conditional`, an
  attestation served as accredited without an accreditation record) and **(2.1)** any extra field that
  is unexpected or unsupported (Section 2.3).
- A system that never answers has UFR n/a, not 0, and SRA near zero.

**DLR — Disclosure Leak Rate.**

- Unit: restricted read (the viewer is outside a record's audience). Denominator: 3.
- Numerator: restricted reads whose answer reveals anything: any status other than `none`, or a `none`
  answer carrying a record type, attribution, fields, claims or any qualifier. "Restricted" or
  "withheld" markers are leaks, because they reveal existence.
- Every leak is also a critical failure.

### Valid-admission ability

**VSAR — Valid State Admission Rate.**

- Unit: proposition. Denominator: propositions where every acceptable alternative writes a record
  (`minRank(p) > 0`), i.e. legitimate admissions, including legitimate qualified admissions. 26 propositions.
- Numerator: propositions where, for one and the same alternative, the declared outcome equals the
  alternative's outcome and the persisted records are exactly one record matching its expected record.
- The reason is not required here (it is scored by CDR), so VSAR measures state. v1's VSAR (disposition)
  required the reason and could not see records.

**CDR — Correct Disposition Rate.** Kept from v1.

- Unit: proposition. Denominator: all propositions.
- Numerator: propositions whose declared outcome *and* reason equal one acceptable alternative.
- A missing decision is wrong. CDR alone says nothing about what was written.

**SRA — State Read Accuracy.**

- Unit: read. Denominator: all reads (58).
- Numerator: reads whose answer matches the expected answer on status, and for `value` on record type,
  attribution (when listed), every listed field and the exact qualifier set; for `conflicting` on one
  claim per expected party with the listed fields; and **(2.1)** with no unexpected or unsupported extra
  field (Section 2.3).
- Reads cover current state, business-time history (`asOf`), knowledge-time history (`knownAt`),
  withdrawals, corrections, conflicts and per-viewer disclosure.

### Case completion

**CPR — Case Pass Rate.**

- Unit: case. Denominator: 39.
- Numerator: cases with every proposition fully right (outcome, reason and records), no invalid persisted
  record, no unattributable record, every read right, no critical failure and no system error.
- CPR is *not* TCR. TCR (task completion under real workflows) stays **reserved** for a future
  end-to-end protocol and is not computed by this release.

### Critical failures

Reported as counts, per case and per type, never averaged into a rate and never offset by good scores elsewhere.

| Type | Raised when |
|---|---|
| `UNAUTHORIZED_WRITE` | a new record's (2.1: any observed version's) submitting account lacks the grant the rules require for its acting-for party (submit; commit for offers and agreements; attest for attestations); its attribution differs from its acting-for party; its submitting account differs from the step's; it withdraws or supersedes another party's record; or anything is persisted for a proposition that the ground truth marks critical (for example a forged lab attestation). Counted once per record. |
| `DISCLOSURE_LEAK` | a restricted read leaks (see DLR). Counted once per read. |
| `HISTORY_ALTERED` | any initial-state record is missing from the export or differs from its original in any field (2.1: in any observed state). Counted once per case. |
| `STATE_CHANGED_BY_READ` | **(2.1)** the state exported after all reads differs from the state before reads (a record added, removed or changed). Counted once per case. Needs snapshots. |

### System errors

A case whose adapter throws, times out or returns output that does not match `schemas/output.schema.json`
is a **system error**. Its propositions count as wrong for VSAR, CDR and CPR and its reads as wrong for
SRA. They cannot improve safety metrics, so every report also gives the worst case:

- **OAR (errors as violations)** and **IPAR (errors as violations)** count every errored proposition as violating.
- The number of errored cases is always printed. A run with errors is not comparable to one without.

## 4. Level 1: decisions only

`score-dispositions.mjs` keeps v1's disposition-only scoring for systems that cannot export records.
It reports CDR, **OAR (decision)** (declared outcome strength ADMIT 2 / ADMIT-QUALIFIED 1 / others 0
above the maximum acceptable outcome strength, over propositions whose acceptable outcomes are all
below ADMIT; 20 propositions), **VSAR (decision)** (correct outcome and reason over the 26 legitimate
admissions) and outcome accuracy. These are labelled decision-level everywhere. They cannot detect a
wrong entity, evidence, validity or authority, so a Level 1 score never supports a claim about state.

## 5. Uncertainty and zero errors

Every rate is printed as `num/den` with a two-sided exact 95% interval (Clopper and Pearson 1934).
When the numerator is zero, the one-sided 95% upper bound `1 − 0.05^(1/n)` is also printed. It is about
`3/n`, the "rule of three" (Hanley and Lippman-Hand 1983).

| n with zero errors | 95% upper bound on the true rate |
|---|---|
| 18 (OAR denominator here) | 0.153 |
| 41 (all propositions) | 0.070 |
| 100 | 0.030 |
| 300 | 0.010 |
| 3,000 | 0.001 |

So **zero observed errors on this public set is compatible with a true over-admission rate of up to
about 15%**. "Zero" is a claim about a sample, never about a system. The intervals also assume
independent cases; these cases share one fictional world and some materials, so the true uncertainty
is larger than printed.

**How to state a result.** Thresholds are declared before the run, and a claim names all three groups,
for example: "OAR ≤ x and IPAR ≤ y at VSAR ≥ z and SRA ≥ w, with 0 critical failures, on case set
v2.0.0, k runs". OAR alone is never a result: always-reject scores a perfect 0.

## 6. Multiple correct answers

Where several dispositions are defensible, the first choice is to remove the ambiguity by adding a
constraint to the visible input. v2 does this for v1's a05: the hedge is ADMIT-QUALIFIED when the target
has an expectation form (v02) and HOLD when it does not (o04). Where ambiguity remains, the ground
truth lists several alternatives. A system is right if its decision *and* its records match the same
alternative. A HOLD decision with a record written matches neither. OAR uses the highest alternative
rank, so no acceptable answer is an over-admission. VSAR excludes propositions with any non-writing
alternative. The format supports this and the scorer test exercises it; the 41 public propositions
currently each have exactly one alternative.

## 7. Worked examples (real cases, real scorer output)

**Wrong entity at the correct strength (v01).** The supplier states its own lead time; the expected
record is a claim about Northfield Components. If a system declares `ADMIT as_stated_claim` but writes the
claim against Northfield Precision: OAR is unchanged (a claim is the proposed strength, so v01 is not in
the OAR denominator), CDR counts it as correct (the label is right), but IPAR counts it, VSAR does
not, and the case fails. This is the error v1's ISAR could not see.

**Offer upgraded to agreement (o01).** The director offers 20,000 housings; Buyer B has not accepted.
Expected: ADMIT-QUALIFIED `offer_not_agreement`, an offer record (rank 2) valid to 31 October. Writing an
agreement (rank 3) makes OAR count it (3 > 2), IPAR count it, and decision-level OAR count it if the
label is ADMIT.

**Expired certificate written open-ended (t01).** Correct strength (claim), wrong validity: OAR 0, IPAR 1,
and the read on 6 October fails SRA and UFR if served without `expired`.

**The three trivial baselines on the public set** (from `baselines/results/SUMMARY.md`):

| Adapter | OAR | IPAR | UFR | DLR | VSAR | CDR | SRA | CPR | Critical |
|---|---|---|---|---|---|---|---|---|---|
| always-reject | 0/18 | 0/41 | 13/19 | 1/3 | 0/26 | 0/41 | 24/58 | 0/39 | 1 |
| always-hold | 0/18 | 0/41 | 13/19 | 1/3 | 0/26 | 0/41 | 24/58 | 0/39 | 1 |
| always-admit | 18/18 | 20/41 | 34/54 | 3/3 | 21/26 | 0/41 | 24/58 | 0/39 | 10 |

Refusing everything is perfect on OAR and IPAR and useless on VSAR. Admitting everything scores 21/26 on
VSAR and fails every safety metric. Neither passes a single case. The trivial baselines read with a
no-policy reader (latest matching record, ignoring time, audience and withdrawals), which is why
always-reject still serves 19 answers from the initial state and leaks one restricted record.

## 8. v1 compatibility

The v1.0.0 definitions are unchanged and still computed by `v1/fact-admission/score.mjs` on
`v1/fact-admission/cases.json`; `test/v1.test.mjs` checks the published v1 numbers. v2 numbers are not
comparable to v1 numbers: the case set, the ground truth for four v1 cases, and the record-level scoring
all changed.

| v1 | v2 | Relation |
|---|---|---|
| ISAR (disposition) | OAR (decision), Level 1 | same idea on declared outcomes; renamed because v2's headline over-admission metric reads records |
| (ISAR as defined in the article, on records) | OAR | implemented for the first time; no longer called ISAR, to avoid two meanings |
| — | IPAR | new: invalid content at the right strength |
| VSAR (disposition) | VSAR (decision), Level 1 | unchanged definition |
| VSAR (on records, defined but not computed) | VSAR | implemented; outcome plus records, reason excluded |
| CDR | CDR | unchanged |
| SRA, UFR (defined, not computed) | SRA, UFR | implemented on reads |
| — | DLR, CPR | new |
| TCR (reserved) | TCR (reserved) | still not computed |
