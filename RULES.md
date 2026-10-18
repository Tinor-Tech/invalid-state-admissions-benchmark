# Rules (v2.0.0)

Generated from `spec/rules.json` by `tools/gen-docs.mjs`. These rules are system-visible: they are handed to every adapter. Ground truth cites them by id.

They are this benchmark's declared policy, not a claim about how any product works. Results are relative to them (see REVIEW.md, rule dependence).

- **R-ORDER-1.** When several rules reject a proposal, the reason reported is the first that applies in this order: field_not_declared, evidence_missing, quote_not_in_source, subject identity (subject_mismatch, subject_ambiguous), authority (no_standing_to_withdraw, assurance_claimed_for_other_party, not_entitled_to_submit, not_entitled_to_commit), target meaning (wrong_target_semantics, period_missing), duplicate_of_existing, then strength (stronger_than_source, validity_narrower_than_proposed, offer_not_agreement, commitment_not_made).
- **R-ID-1.** An organisation subject is bound when it is the submitting account's party, or when the material names exactly one party of the directory by its full name. If the material only matches several parties (for example by a shared first name) and the account's party is not the subject, the proposal is held (subject_ambiguous).
- **R-ID-2.** If the material names exactly one party by its full name and the proposed subject is a different party, the proposal is refused (subject_mismatch). The subject is never silently re-bound.
- **R-AUTH-1.** A record acts for a party only if the submitting account holds a submit grant for that party (otherwise not_entitled_to_submit). A claim is attributed to the party it acts for.
- **R-AUTH-2.** An offer, an acceptance or an agreement on behalf of a party requires a commit grant for that party (otherwise not_entitled_to_commit).
- **R-AUTH-3.** An issuer attestation may only be attributed to the submitting account's own party, by an account holding an attest grant for it. Attributing an attestation to another party is refused (assurance_claimed_for_other_party).
- **R-AUTH-4.** Only the party a record is attributed to may withdraw it, through an account with an attest grant (for attestations) or submit grant (for claims) for that party. Otherwise no_standing_to_withdraw.
- **R-EV-1.** Every admitted record cites at least one material that is part of the input. Citing a material that is not part of the input is refused (evidence_missing).
- **R-EV-2.** Every quote must occur verbatim, after collapsing whitespace, in the material it cites (otherwise quote_not_in_source).
- **R-SEM-1.** A value is admitted only into a target whose meaning it has (spec/contracts.json). A rate (per month, per week) is not a count over a period: proposing it as one is refused (wrong_target_semantics), because asking for a period would invite one to be invented. A count with no determinable period is held (period_missing).
- **R-SEM-2.** Fields that the target contract does not declare, and values outside declared enumerations, are refused (field_not_declared).
- **R-QUAL-1.** A proposal stronger than its source (a hedged or conditional statement proposed as firm, a basis or scope the source does not state, a longer validity than stated) is admitted only in the weaker form the source supports, if the target has a record type for that form (ADMIT-QUALIFIED). A hedged statement becomes an expectation carrying its condition. If the target has no weaker form, the proposal is held (commitment_not_made).
- **R-OFFER-1.** An agreement binds its debtor and creditor. It is admitted only when each of them has stated identical terms through an account with a commit grant for it (as_confirmed_agreement). A unilateral offer, or an acceptance with changed terms (a counter-offer), is written as an offer by the party that made it (offer_not_agreement when an agreement was proposed; as_stated_offer when an offer was proposed).
- **R-ATT-1.** A party's transcription of another party's document is written as a transcription attributed to the transcribing party, never as the other party's attestation.
- **R-ATT-2.** An issuer attestation establishes who issued what, and when. It does not establish the issuer's independence, its accreditation, or that the content is correct. Reads of an issuer attestation carry independence-not-established, and accreditation-not-established unless the state holds an accreditation record for the issuer, from another party, whose scope names the standard and which is valid at asOf (then issuer-accredited).
- **R-DUP-1.** A proposal identical to a current record (same target, subject, attribution, record type, fields and cited materials) changes nothing (NO-CHANGE, duplicate_of_existing). A new statement by the same party with different fields is admitted and replaces the earlier one from its validity start.
- **R-CORR-1.** A party may correct its own earlier record by a record that supersedes it (correction_supersedes). The superseded record stays in history and is still returned for knowledge times before the correction was recorded.
- **R-HIST-1.** Records are never edited or deleted. The exported records must contain every initial-state record unchanged; changes are new records (withdrawals, corrections, replacements).
- **R-TIME-1.** validity.from and validity.to are business time, taken from the material; recordedAt is knowledge time, the time of the step that wrote the record. Late evidence keeps its business-time validity.
- **R-READ-1.** A read (subject, target, match, asOf, knownAt, viewer) considers records with recordedAt at or before knownAt, visible to the viewer, matching subject, target and the match fields, with validity.from at or before asOf. Withdrawal records are not answers; superseded records are dropped; among records attributed to the same party the one with the latest validity.from wins (then latest recordedAt).
- **R-READ-2.** If one record remains, status is value with its recordType, attributedTo, fields and qualifiers. If records from different parties remain and their non-key fields differ, status is conflicting with one claim per party. If none remains, status is none and nothing else is returned.
- **R-READ-3.** Qualifiers: conditional for expectations; expired when validity.to is before asOf; withdrawn when a visible withdrawal recorded by knownAt takes effect on or before asOf; plus the attestation qualifiers of R-ATT-2.
- **R-READ-4.** For delivery targets, a current agreement is the answer if one exists; otherwise the most recently recorded offer or expectation (negotiation is sequential, so an offer and a counter-offer are not a conflict).
- **R-CONF-1.** Statements about different products, periods or targets are different questions and are not conflicts.
- **R-DISC-1.** A record with an audience is visible only to accounts of parties in the audience. To any other viewer, every answer must be exactly what it would be if the record did not exist: no value, no count, no restricted marker, no qualifier.

## Reasons

| Reason | Outcome | Rules | Meaning |
|---|---|---|---|
| `as_stated_claim` | ADMIT | R-ID-1, R-AUTH-1, R-EV-2 | A party's attributed claim, written as stated. |
| `as_stated_offer` | ADMIT | R-AUTH-2, R-OFFER-1 | A unilateral offer proposed and written as an offer. |
| `as_subject_transcription` | ADMIT | R-ATT-1 | A party's transcription of another party's document, written as that party's transcription. |
| `issuer_attestation` | ADMIT | R-AUTH-3, R-ATT-2 | An issuer's own attestation, written as an issuer attestation (not as independent verification). |
| `as_confirmed_agreement` | ADMIT | R-OFFER-1 | Every bound party has confirmed identical terms through an account entitled to commit for it. |
| `withdrawal_by_issuer` | ADMIT | R-AUTH-4 | The issuer of a record withdraws it. |
| `correction_supersedes` | ADMIT | R-CORR-1 | A party corrects its own earlier record; the correction supersedes it and the earlier record stays in history. |
| `stronger_than_source` | ADMIT-QUALIFIED | R-QUAL-1 | The proposal is stronger than its source (hedge, condition, basis or scope); the weaker supported form is written. |
| `validity_narrower_than_proposed` | ADMIT-QUALIFIED | R-QUAL-1, R-TIME-1 | The source states a shorter validity than proposed; the stated validity is written. |
| `offer_not_agreement` | ADMIT-QUALIFIED | R-OFFER-1 | An agreement was proposed but only one party has committed to these terms; the offer is written. |
| `subject_ambiguous` | HOLD | R-ID-1 | More than one party could be the subject and nothing in the input disambiguates. |
| `period_missing` | HOLD | R-SEM-1 | A count over a period was proposed and no period is determinable. Kept for v1 compatibility; no v2 case expects it. |
| `confirmations_pending` | HOLD | R-OFFER-1 | An agreement awaits a confirmation and the target has no offer form. Kept for v1 compatibility; no v2 case expects it. |
| `commitment_not_made` | HOLD | R-QUAL-1 | The target only accepts firm commitments and the source makes none; a firm statement must be obtained. |
| `quote_not_in_source` | REFUSE | R-EV-2 | A cited quote does not occur verbatim in the cited material. |
| `evidence_missing` | REFUSE | R-EV-1 | No evidence is cited, or a cited material is not part of the input. |
| `wrong_target_semantics` | REFUSE | R-SEM-1 | The value does not have the meaning of the target (for example a rate written as a count over a period). |
| `subject_mismatch` | REFUSE | R-ID-2 | The proposed subject contradicts the party that the material identifies; it is not silently re-bound. |
| `not_entitled_to_submit` | REFUSE | R-AUTH-1 | The submitting account holds no submit grant for the party it acts for. |
| `not_entitled_to_commit` | REFUSE | R-AUTH-2 | An offer, acceptance or agreement on behalf of a party needs a commit grant the account does not hold. |
| `assurance_claimed_for_other_party` | REFUSE | R-AUTH-3 | An attestation is attributed to a party other than the submitting account's party. |
| `no_standing_to_withdraw` | REFUSE | R-AUTH-4 | Only the issuer of a record may withdraw it. |
| `field_not_declared` | REFUSE | R-SEM-2 | The proposal sets a field or value the target contract does not declare. |
| `duplicate_of_existing` | NO-CHANGE | R-DUP-1 | The state already holds an identical record. |

## Read qualifiers

| Qualifier | Meaning |
|---|---|
| `conditional` | The record is an expectation that carries a condition or hedge. |
| `expired` | The record's validity ended before the read's asOf date. |
| `withdrawn` | The record was withdrawn by its issuer with effect on or before asOf. |
| `independence-not-established` | An issuer attestation; nothing in state establishes the issuer's independence from the subject. |
| `accreditation-not-established` | An issuer attestation; no valid accreditation record for the issuer covering the standard is in state. |
| `issuer-accredited` | An issuer attestation; a valid accreditation record from an accreditation body covering the standard is in state. |

## Target contracts

| Target | Meaning | Fields (key fields marked *) | Record types (strength rank) |
|---|---|---|---|
| `lead_time` | Order-to-delivery lead time a party states for a product. | product*, value, unit (week/day) | evidence-note 1, claim 2 |
| `capacity_rate` | A production rate (units per time unit). A rate, not a count over a specific period. | value, unit (units/month/units/week), basis (nameplate/demonstrated/unstated) | evidence-note 1, claim 2 |
| `monthly_output` | Units actually produced in one stated calendar month. A count over a period, not a rate. | value, unit (units), period* | evidence-note 1, claim 2 |
| `delivery` | Delivery position between a debtor (who delivers) and a creditor. Expectation < offer < agreement. | object*, quantity, dueBy, price, condition, debtor, creditor | expectation 1, offer 2, agreement 3 |
| `delivery_firm` | Firm delivery positions only (offer or agreement). Has no expectation form. | object*, quantity, dueBy, price, debtor, creditor | offer 2, agreement 3 |
| `test_result` | Result of a named test on a material. | material*, standard*, thicknessMm*, result, reportId | transcription 1, issuer-attestation 2 |
| `certificate_status` | Status of a certificate held by an organisation. | certificateId*, scope, status (valid) | claim 1, issuer-attestation 2, withdrawal 2 |
| `accreditation` | An accreditation body's accreditation of an organisation for a scope. | scope* | issuer-attestation 2 |
| `target_price` | A party's internal target price. | object*, price | claim 2 |
