# Baselines

Every baseline is reported with the same metrics (METRICS.md) and its execution cost. Each one is
labelled with what has actually been done to it.

| Baseline | Status | Adapter | Notes |
|---|---|---|---|
| always-reject | **Measured** | `always-reject` | Explanation only. Perfect OAR and IPAR, zero VSAR. |
| always-hold | **Measured** | `always-hold` | Explanation only. |
| always-admit (as proposed) | **Measured** | `always-admit` | Explanation only. High VSAR, fails every safety metric. |
| Schema validation + authority rules (non-LLM) | **Measured** (public set and probes) | `reference-rules` | Written with knowledge of the public cases. See below. |
| LLM + structured output | **Proposed, runnable harness, not run** | `llm-harness --mode structured` | No numbers exist. |
| LLM + evidence retrieval (RAG) | **Proposed, runnable harness, not run** | `llm-harness --mode rag` | No numbers exist. |
| LLM + human approval | **Proposed, runnable harness, not run** | `llm-harness --mode human-approval --approvals file` | No numbers exist. Needs recorded human decisions. |
| Real systems | **Proposed** | your adapter | None connected. |

Measured numbers are in [`baselines/results/SUMMARY.md`](baselines/results/SUMMARY.md) and in the article.

## Reference baseline: schema validation + evidence + identity + authority + temporal rules

`adapters/reference-rules.mjs`, under 200 lines, deterministic, no model. In rule order, it validates the
candidate against the target contract; checks that every cited material exists and every quote is
verbatim; binds the subject from the submitting account, full party names or the senders of the cited
materials; checks submit, commit and attest grants and who may withdraw or supersede; rejects rates
proposed as counts; detects exact duplicates; weakens hedged commitments to expectations (or holds them
when the target has no expectation form); requires matching terms from both parties for an agreement and
otherwise writes the offer of the party that made it; resets unstated bases to `unstated`; and caps
validity at a stated "valid until" date. Reads follow R-READ-1 to R-READ-4 and R-DISC-1.

**Results.** Public set: OAR 0/18, IPAR 0/41, UFR 0/39, DLR 0/3, VSAR 26/26, CDR 41/41, SRA 58/58, CPR 39/39,
no critical failures. Probes (7 paraphrases written afterwards): IPAR 1/7, UFR 2/3, VSAR 1/4, CDR 3/7,
SRA 4/7, CPR 3/7.

**Why the public-set score means little.** The same authors wrote the cases, the rules, the ground truth
and this baseline, in that order and with all of them in view. Its heuristics key on the phrasing of
the public cases ("should be able to", "valid until", "/month", comma thousands separators). The probes
change only phrasing and it fails four of seven: a different hedge ("anticipate", "provided"), a rate in
words ("each month"), an expiry written as "expires on", and "18 000" with a space. That is the expected
behaviour of overfitted rules, and it is why a public-set score from anyone, including a language model
that has seen this repository, cannot support a claim of generality. What the baseline does show is that
the protocol runs end to end, that the metrics are satisfiable jointly, and that the declared rules are
precise enough to implement without a model.

## Proposed LLM baselines (harness provided, not run)

`adapters/llm-harness.mjs` implements all three with a pluggable model function. The harness puts the
rules, reason vocabulary, qualifiers and contracts in the system prompt, and the parties, grants,
materials, current records and step in the user message. It asks for decisions and records as JSON
matching a schema, then answers each read with a second call. It never reads environment variables or
key files; the model module you pass supplies its own credentials. Running a model means:

```sh
node run.mjs --adapter llm-harness --model ./my-model.mjs --mode structured --out runs/structured-<model>-<date>.json
node score.mjs runs/structured-<model>-<date>.json
```

Record and publish the output file, the model identifier and version, the date, temperature and other
sampling settings, the number of runs, and the token and money cost reported by `cost()`. The recorded
file can be re-scored by anyone with `--adapter recorded` without calling the model again.

`examples/scripted-model.mjs` is a scripted stand-in (it refuses everything) used only to test the
plumbing offline. Its outputs are not language-model results.

## Cost

Cost is part of every result: model calls, input and output tokens, money, and human approvals for the
human-approval mode, as reported by the adapter's `cost()`, plus wall time measured by the runner. For
the baselines that were run, cost is wall time only (milliseconds; see SUMMARY.md); none makes model calls.
