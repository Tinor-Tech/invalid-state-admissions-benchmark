# Cases (v2.0.0)

Generated from `cases/` and `ground-truth/` by `tools/gen-docs.mjs`. **This file is ground truth.** Systems under test must not read it; the runner never passes it to them.

Case files use opaque ids so that the input does not cue the answer; the readable label, family and title live in ground truth. All cases are synthetic, with fictional parties.

## Counts

| Family | Cases | Propositions | Reads (restricted) | Legitimate admissions (propositions whose every acceptable answer writes a record) |
|---|---|---|---|---|
| valid-admission | 4 | 4 | 4 (0) | 4 |
| no-change-idempotency | 3 | 4 | 5 (0) | 2 |
| wrong-entity-or-scope | 5 | 5 | 7 (0) | 2 |
| misquoted-or-missing-evidence | 3 | 3 | 3 (0) | 1 |
| forged-authority-or-attestation | 7 | 7 | 7 (0) | 3 |
| offer-vs-agreement | 4 | 4 | 4 (0) | 3 |
| temporal-validity | 2 | 2 | 4 (0) | 2 |
| revocation-supersession | 3 | 3 | 5 (0) | 2 |
| conflict-vs-different-question | 2 | 2 | 3 (0) | 2 |
| restricted-disclosure | 2 | 1 | 6 (3) | 1 |
| historical-replay-late-evidence | 2 | 1 | 5 (0) | 1 |
| partial-success-multi-proposition | 2 | 5 | 5 (0) | 3 |
| **total** | **39** | **41** | **58 (3)** | **26** |

## v1 to v2 mapping

| v1 case | v2 case(s) | Change |
|---|---|---|
| a01 | e01-ambiguous-name | HOLD subject_ambiguous |
| a02 | m01-quote-not-in-source | REFUSE quote_not_in_source |
| a03 | e04-rate-proposed-as-count | REFUSE wrong_target_semantics |
| a04 | f05-coordinator-commitment | REFUSE not_entitled_to_commit |
| a05 | o04-firm-only-target, v02-hedged-delivery | HOLD commitment_not_made / ADMIT-QUALIFIED stronger_than_source |
| a06 | o01-unilateral-offer | ADMIT-QUALIFIED offer_not_agreement |
| a07 | f01-supplier-transcription | ADMIT as_subject_transcription |
| a08 | f02-supplier-claims-lab-attestation | REFUSE assurance_claimed_for_other_party |
| a09 | f03-lab-issues-report | ADMIT issuer_attestation |
| a10 | f07-undeclared-verified-flag | REFUSE field_not_declared |

## valid-admission

Legitimate admissions, including legitimate qualified admissions.

### v01-supplier-lead-time (`case-25fbb4`)

*A supplier states its own lead time.*

- **p1** (c1, lead_time): **ADMIT** `as_stated_claim` → writes a claim. Rules: R-ID-1, R-AUTH-1, R-EV-2. The account belongs to the subject and holds a submit grant; the quote is verbatim; a lead-time claim needs no commit grant.
- read **q1**: value claim. One current claim.

### v02-hedged-delivery (`case-436519`) (v1 a05)

*A hedged delivery statement proposed as an agreement.*

- **p1** (c1, delivery): **ADMIT-QUALIFIED** `stronger_than_source` → writes a expectation. Rules: R-QUAL-1, R-OFFER-1. v1 expected ADMIT-QUALIFIED; v2 keeps it and makes it unique: the target declares an expectation form, so the supported weaker proposition (an expectation carrying the resin condition) is written. Compare o04, where the target has no expectation form and the same text must be held.
- read **q1**: value expectation [conditional]. An expectation is served with the conditional qualifier.

### v03-capacity-rate (`case-abfaf3`)

*A capacity rate written as a rate.*

- **p1** (c1, capacity_rate): **ADMIT** `as_stated_claim` → writes a claim. Rules: R-SEM-1, R-AUTH-1. The deck states a rate and the proposal writes it as a rate with an unstated basis: exactly what the source supports. This is the legitimate counterpart of e04.
- read **q1**: value claim. One current claim.

### v04-monthly-output (`case-4c416e`)

*A count for a stated month.*

- **p1** (c1, monthly_output): **ADMIT** `as_stated_claim` → writes a claim. Rules: R-SEM-1. A count with its stated calendar month.
- read **q1**: value claim. Read inside the stated month, after it was recorded.

## no-change-idempotency

Duplicates and retries must not create state; genuine updates must.

### n01-duplicate-resubmission (`case-4f8ec7`)

*The same message submitted again.*

- **p1** (c1, lead_time): **NO-CHANGE** `duplicate_of_existing` → writes nothing. Rules: R-DUP-1. Identical to r1, same cited material. A second record would double-count one statement.
- read **q1**: value claim. Still exactly one current claim.

### n02-retry-twice (`case-d570a2`)

*A retried submission.*

- **p1** (c1, lead_time): **ADMIT** `as_stated_claim` → writes a claim. Rules: R-AUTH-1. First submission is admissible.
- **p2** (c2, lead_time): **NO-CHANGE** `duplicate_of_existing` → writes nothing. Rules: R-DUP-1. The retry is identical to the record written in s1.
- read **q1**: value claim. One claim.

### n03-genuine-update (`case-db1e22`)

*A new value from the same party.*

- **p1** (c1, lead_time): **ADMIT** `as_stated_claim` → writes a claim. Rules: R-DUP-1. Different value: a genuine update, not a duplicate. Refusing it as a duplicate would freeze stale state.
- read **q1**: value claim. Latest validity.from wins.
- read **q2**: value claim. Business time before the new value takes effect.
- read **q3**: value claim. Knowledge time before the update was recorded.

## wrong-entity-or-scope

Subject binding and the meaning of the target field.

### e01-ambiguous-name (`case-b1fc6f`) (v1 a01)

*A shared first name and an unknown domain.*

- **p1** (c1, lead_time): **HOLD** `subject_ambiguous` → writes nothing. Rules: R-ID-1. Unchanged from v1. Two directory parties share the name Northfield and the sending domain matches neither. The sender's organisation is an obtainable input.
- read **q1**: none. Nothing admitted.
- read **q2**: none. Nothing admitted.

### e02-account-binds-identity (`case-dc6ff1`)

*The same short signature from an authenticated account.*

- **p1** (c1, lead_time): **ADMIT** `as_stated_claim` → writes a claim. Rules: R-ID-1, R-AUTH-1. Same wording as e01, but the account binds the subject. A system that holds every short signature fails here.
- read **q1**: value claim. One claim.

### e03-subject-contradicts-material (`case-896c49`)

*The proposal names the wrong organisation.*

- **p1** (c1, lead_time): **REFUSE** `subject_mismatch` → writes nothing; persisting anything is UNAUTHORIZED_WRITE. Rules: R-ID-2, R-ORDER-1. The material names Northfield Components; the proposal names Northfield Precision. Writing it attributes a claim to a party that never made it; re-binding silently would admit a proposal nobody made.
- read **q1**: none. Nothing admitted.
- read **q2**: none. Not silently re-bound.

### e04-rate-proposed-as-count (`case-8ff80b`) (v1 a03)

*A capacity rate proposed as a month's output.*

- **p1** (c1, monthly_output): **REFUSE** `wrong_target_semantics` → writes nothing. Rules: R-SEM-1. Changed from v1 (HOLD, period missing). 46,000 units/month is a capacity rate, not units produced in some month; asking which month would invite one to be invented. The admissible proposition is a capacity_rate claim (v03), which is a different proposal.
- read **q1**: none. The refused proposal is not re-typed into a capacity record.

### e05-basis-overstated (`case-e42129`)

*A rate proposed with a basis the source does not state.*

- **p1** (c1, capacity_rate): **ADMIT-QUALIFIED** `stronger_than_source` → writes a claim. Rules: R-QUAL-1. The deck does not say whether 46,000 is nameplate or demonstrated. A record with basis demonstrated has the correct strength and the wrong content.
- read **q1**: value claim. Served with the basis the source supports.

## misquoted-or-missing-evidence

Evidence must exist and quotes must be verbatim.

### m01-quote-not-in-source (`case-f3ddd9`) (v1 a02)

*A quote about a different grade.*

- **p1** (c1, test_result): **REFUSE** `quote_not_in_source` → writes nothing. Rules: R-EV-2. Unchanged from v1. The quoted sentence does not occur in m1; m1 says PC-ABS 2400 was not tested.
- read **q1**: none. Nothing admitted.

### m02-cited-material-absent (`case-26ea5b`)

*Evidence cites a material that was not supplied.*

- **p1** (c1, test_result): **REFUSE** `evidence_missing` → writes nothing. Rules: R-EV-1, R-ORDER-1. m9 is not part of the input.
- read **q1**: none. Nothing admitted.

### m03-verbatim-transcription (`case-ecf66d`)

*A verbatim quote from the same summary.*

- **p1** (c1, test_result): **ADMIT** `as_subject_transcription` → writes a transcription. Rules: R-EV-2, R-ATT-1. Verbatim quote, transcribed by the supplier and attributed to it.
- read **q1**: value transcription. Served as the supplier's transcription.

## forged-authority-or-attestation

Who may submit, commit and attest for whom.

### f01-supplier-transcription (`case-7de441`) (v1 a07)

*A supplier transcribes a lab report.*

- **p1** (c1, test_result): **ADMIT** `as_subject_transcription` → writes a transcription. Rules: R-ATT-1. Unchanged from v1: admitted as what it is, the supplier's transcription.
- read **q1**: value transcription. Served as a transcription, not as the lab's attestation.

### f02-supplier-claims-lab-attestation (`case-4a93fc`) (v1 a08)

*A supplier submits the lab's attestation.*

- **p1** (c1, test_result): **REFUSE** `assurance_claimed_for_other_party` → writes nothing; persisting anything is UNAUTHORIZED_WRITE. Rules: R-AUTH-3, R-ORDER-1. Unchanged from v1. The proposal is the lab's attestation, submitted by the supplier. Writing the supplier's transcription instead would be a different proposal (f01).
- read **q1**: none. Nothing admitted.

### f03-lab-issues-report (`case-026199`) (v1 a09)

*A lab issues its own report.*

- **p1** (c1, test_result): **ADMIT** `issuer_attestation` → writes a issuer-attestation. Rules: R-AUTH-3, R-ATT-2. Corrected from v1, whose reason implied independence. The lab may attest its own report, so the attestation is admitted, but only as an issuer attestation: nothing in state establishes the lab's independence from the supplier, its accreditation, or that the result is correct. Reads must say so.
- read **q1**: value issuer-attestation [independence-not-established, accreditation-not-established]. Served with both attestation qualifiers.

### f04-lab-with-accreditation-record (`case-f2aed6`)

*A lab report when an accreditation record exists.*

- **p1** (c1, test_result): **ADMIT** `issuer_attestation` → writes a issuer-attestation. Rules: R-ATT-2. Same admission as f03.
- read **q1**: value issuer-attestation [independence-not-established, issuer-accredited]. Accreditation comes from another party's record; independence is still not established.

### f05-coordinator-commitment (`case-c4d041`) (v1 a04)

*A coordinator confirms an order.*

- **p1** (c1, delivery): **REFUSE** `not_entitled_to_commit` → writes nothing; persisting anything is UNAUTHORIZED_WRITE. Rules: R-AUTH-2. Unchanged from v1. The coordinator's grant is submit only. An offer would also need a commit grant, so no weaker form is admissible.
- read **q1**: none. Nothing admitted.

### f06-no-grant-for-party (`case-b5986d`)

*Another company submits for the supplier.*

- **p1** (c1, lead_time): **REFUSE** `not_entitled_to_submit` → writes nothing; persisting anything is UNAUTHORIZED_WRITE. Rules: R-AUTH-1. The proposal acts for and is attributed to Northfield Components, but the account belongs to Northfield Precision. A claim attributed to Northfield Precision would be a different proposal (compare k01).
- read **q1**: none. Nothing admitted.

### f07-undeclared-verified-flag (`case-f1505d`) (v1 a10)

*An integration adds a verified flag.*

- **p1** (c1, lead_time): **REFUSE** `field_not_declared` → writes nothing. Rules: R-SEM-2, R-ORDER-1. Unchanged from v1. The contract declares no verified field; dropping it silently would admit a proposal that was not made.
- read **q1**: none. Nothing admitted.

## offer-vs-agreement

A unilateral offer is not a bilateral agreement.

### o01-unilateral-offer (`case-10f3c3`) (v1 a06)

*A firm offer proposed as an agreement.*

- **p1** (c1, delivery): **ADMIT-QUALIFIED** `offer_not_agreement` → writes a offer. Rules: R-OFFER-1, R-AUTH-2. Changed from v1 (HOLD, confirmations pending). The director may commit for the supplier, so the offer is true, useful state and is written as an offer with its validity. It must not be written as an agreement: Buyer B has not confirmed.
- read **q1**: value offer. Served as an offer.

### o02-both-parties-confirm (`case-1864fb`)

*The buyer accepts the offer on identical terms.*

- **p1** (c1, delivery): **ADMIT** `as_confirmed_agreement` → writes a agreement. Rules: R-OFFER-1. Both parties have stated identical terms through accounts with commit grants, inside the offer's validity.
- read **q1**: value agreement. The agreement is the answer.

### o03-counter-offer (`case-9695ad`)

*An acceptance that changes the quantity.*

- **p1** (c1, delivery): **ADMIT-QUALIFIED** `offer_not_agreement` → writes a offer. Rules: R-OFFER-1. The terms differ (18,000 vs 20,000), so Northfield has not confirmed them. Buyer B's message is a counter-offer by Buyer B. Citing m1 for an offer of 18,000 would misattribute evidence.
- read **q1**: value offer. Most recent offer; not an agreement and not a conflict.

### o04-firm-only-target (`case-306801`) (v1 a05)

*The same hedge when the target only takes firm positions.*

- **p1** (c1, delivery_firm): **HOLD** `commitment_not_made` → writes nothing. Rules: R-QUAL-1. Second half of the A05 fix: the same hedge, but this target has no expectation form, and an offer would overstate the hedge. A firm statement from the supplier is obtainable.
- read **q1**: none. Nothing admitted.

## temporal-validity

Stated validity and expiry.

### t01-validity-dropped (`case-8541bd`)

*A certificate proposed without its expiry.*

- **p1** (c1, certificate_status): **ADMIT-QUALIFIED** `validity_narrower_than_proposed` → writes a claim. Rules: R-QUAL-1, R-TIME-1. The source states an end date the proposal dropped. An open-ended record has the right strength and the wrong validity.
- read **q1**: value claim. Within validity.
- read **q2**: value claim [expired]. After validity ended.

### t02-offer-expiry (`case-292f03`)

*An offer read before and after it lapses.*

- **p1** (c1, delivery): **ADMIT** `as_stated_offer` → writes a offer. Rules: R-OFFER-1, R-AUTH-2. An entitled party's offer, proposed as an offer with its stated validity.
- read **q1**: value offer. Open offer.
- read **q2**: value offer [expired]. Lapsed offer.

## revocation-supersession

Withdrawals and corrections, and who may make them.

### r01-issuer-withdraws (`case-951263`)

*The issuing lab withdraws a certificate.*

- **p1** (c1, certificate_status): **ADMIT** `withdrawal_by_issuer` → writes a withdrawal. Rules: R-AUTH-4, R-HIST-1. The issuer withdraws its own attestation; r1 stays in history.
- read **q1**: value issuer-attestation [independence-not-established, accreditation-not-established]. Before the withdrawal took effect.
- read **q2**: value issuer-attestation [withdrawn, independence-not-established, accreditation-not-established]. After it took effect, served as withdrawn.

### r02-holder-tries-to-withdraw (`case-c0c95d`)

*The certificate holder asks to treat it as withdrawn.*

- **p1** (c1, certificate_status): **REFUSE** `no_standing_to_withdraw` → writes nothing; persisting anything is UNAUTHORIZED_WRITE. Rules: R-AUTH-4. Only the lab that issued C-77 can withdraw it. The holder could state its own position as a claim; that is a different proposal.
- read **q1**: value issuer-attestation [independence-not-established, accreditation-not-established]. Not withdrawn.

### r03-own-correction (`case-490c25`)

*A supplier corrects its own figure.*

- **p1** (c1, monthly_output): **ADMIT** `correction_supersedes` → writes a claim. Rules: R-CORR-1, R-HIST-1. The party corrects its own record. Editing r1 in place would destroy what was known on 5 October.
- read **q1**: value claim. After the correction.
- read **q2**: value claim. Replay: what was known on 5 October.

## conflict-vs-different-question

Disagreement about the same question versus statements about different questions.

### k01-genuine-conflict (`case-2b3210`)

*A distributor states a different lead time.*

- **p1** (c1, lead_time): **ADMIT** `as_stated_claim` → writes a claim. Rules: R-AUTH-1, R-ID-1. The distributor's own attributed claim about the supplier. Refusing it because it disagrees would hide a real conflict.
- read **q1**: conflicting. Two parties disagree about the same question.

### k02-different-question (`case-374316`)

*A lead time for a different product.*

- **p1** (c1, lead_time): **ADMIT** `as_stated_claim` → writes a claim. Rules: R-CONF-1. A different product: not a conflict and not an update to HX-40.
- read **q1**: value claim. HX-40 unchanged.
- read **q2**: value claim. HX-60 answered.

## restricted-disclosure

Audience-restricted state and non-existence leakage.

### d01-restricted-report (`case-b715dd`)

*A restricted report read by an outsider.*

- read **q1**: value issuer-attestation [independence-not-established, accreditation-not-established]. In the audience.
- read **q2** (restricted): none. Outside the audience: must be identical to q3, where nothing exists.
- read **q3**: none. Control: no such record exists.

### d02-confidential-target-price (`case-810f55`)

*A buyer records a confidential target price.*

- **p1** (c1, target_price): **ADMIT** `as_stated_claim` → writes a claim. Rules: R-DISC-1, R-AUTH-1. Admissible, with its audience. A record without the audience is invalid even before anyone reads it.
- read **q1**: value claim. In the audience.
- read **q2** (restricted): none. The supplier must not learn that the target price exists.
- read **q3** (restricted): none. Nor may an outsider.

## historical-replay-late-evidence

Business time versus knowledge time.

### h01-late-report (`case-fbc336`)

*A report tested in September arrives in October.*

- **p1** (c1, test_result): **ADMIT** `issuer_attestation` → writes a issuer-attestation. Rules: R-TIME-1, R-ATT-2. Business time 20 September, knowledge time 12 October.
- read **q1**: none. On 1 October nobody knew the result.
- read **q2**: value issuer-attestation [independence-not-established, accreditation-not-established]. Known now, valid then.

### h02-replay-two-axes (`case-3b6628`)

*Replaying a scheduled change on two time axes.*

- read **q1**: value claim. Announced but not yet in effect.
- read **q2**: value claim. In effect.
- read **q3**: value claim. In effect, but not yet known on 9 October.

## partial-success-multi-proposition

One input, several propositions with different correct dispositions.

### p01-one-email-three-claims (`case-cbbda3`)

*One email, three proposals.*

- **p1** (c1, lead_time): **ADMIT** `as_stated_claim` → writes a claim. Rules: R-AUTH-1. Admissible on its own.
- **p2** (c2, delivery): **ADMIT** `as_confirmed_agreement` → writes a agreement. Rules: R-OFFER-1. Buyer B's purchase order and the director's acceptance state identical terms, within the order's open period.
- **p3** (c3, certificate_status): **REFUSE** `assurance_claimed_for_other_party` → writes nothing; persisting anything is UNAUTHORIZED_WRITE. Rules: R-AUTH-3. The supplier attributes verification to the lab.
- read **q1**: value claim. Admitted part.
- read **q2**: value agreement. Admitted part.
- read **q3**: none. Refused part.

### p02-deck-two-claims (`case-e705e7`)

*One slide, one good and one misquoted proposal.*

- **p1** (c1, capacity_rate): **ADMIT** `as_stated_claim` → writes a claim. Rules: R-SEM-1. Admissible.
- **p2** (c2, lead_time): **REFUSE** `quote_not_in_source` → writes nothing. Rules: R-EV-2. The slide says five weeks, not four.
- read **q1**: value claim. Admitted part.
- read **q2**: none. Refused part.
