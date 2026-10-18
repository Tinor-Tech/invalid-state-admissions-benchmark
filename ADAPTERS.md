# Adapter contract (Level 2)

An adapter connects one system to the runner. It is architecture-neutral: the runner only sees what
goes in and what comes out, never how the system decides or stores.

## Lifecycle per case

```
createSession(options)                 fresh, isolated instance per case
  init(context)                        initial state and visible context
  submit(step)        -> { decisions } once per step, in order
  exportRecords()     -> records[]     everything the system holds afterwards
  read(query)         -> answer        once per read, after all steps
  cost()?             -> { ... }       optional: model calls, tokens, money
  close()?
```

`context` (deep-frozen): `id` (opaque), `contracts` (only those the case uses), `rules`, `vocabulary`,
`parties`, `accounts`, `grants`, `materials`, `initialRecords`. Steps and queries are frozen copies of
the case. Ground truth is never passed and is loaded by the runner only after the adapter has finished.

## Outputs

- **Decision**: `{ candidate, target?, outcome, reason }`, one per proposal (add `target` if you split a
  candidate into several propositions). `reason` may be `null`; it then never matches.
- **Record**: [`schemas/record.schema.json`](schemas/record.schema.json). Export initial records unchanged
  (any change is HISTORY_ALTERED) and new records with `candidate` set to the proposal they were written
  for. `submittedBy` must be the step's account and `recordedAt` the step time.
- **Answer**: `{ read, status: "value" | "none" | "conflicting", recordType?, attributedTo?, fields?, qualifiers?, claims? }`.
  For a viewer outside a record's audience, answer exactly as if the record did not exist.

Any exception, or output not matching [`schemas/output.schema.json`](schemas/output.schema.json), makes
the case a system error (METRICS.md, Section 3).

## Adapter kinds

The `kind` field is printed with every result so that nobody mistakes one kind for another.

| Kind | Meaning | In this repository |
|---|---|---|
| `trivial` | a fixed policy, for explanation | always-reject, always-hold, always-admit |
| `reference` | a non-LLM baseline written by the benchmark authors | reference-rules |
| `mock` | replays ground truth to test the scorer; never a result | oracle-mock |
| `harness` | runs a proposed baseline against a model you supply | llm-harness (not run) |
| `recorded` | replays a recorded output file | recorded |
| `system-under-test` | a real system, connected by its owner or an evaluator | none |

No adapter here calls, emulates or stands in for any vendor's product, including Tinor's. A
system-under-test result is only as trustworthy as the honesty of its export; see REVIEW.md.
