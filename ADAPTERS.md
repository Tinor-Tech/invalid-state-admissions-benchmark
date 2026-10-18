# Adapter contract (Level 2), isa-adapter/2.1

An adapter connects one system to the runner. It is architecture-neutral: the runner only sees what
goes in and what comes out, never how the system decides or stores.

## Lifecycle per case

```
createSession(options)                 fresh, isolated instance per case
  init(context)                        initial state and visible context
  for each step, in order:
    submit(step)      -> { decisions }
    exportRecords()   -> records[]     snapshot: everything the system holds now
  (a case without steps: one exportRecords() after init)
  for each read, after all steps:
    read(query)       -> answer
    exportRecords()   -> records[]     snapshot after that read
  cost()?             -> { ... }       optional: model calls, tokens, money
  close()?
```

**Requirements added in 2.1.** `exportRecords()` must be callable at any point, return the system's
current persisted state, and have no side effects. A step's writes must be persisted, and visible to
`exportRecords()`, before `submit(step)` resolves. `read(query)` must not change state. The scorer
checks all three (METRICS.md, Section 2.4): an invalid record that exists in any snapshot counts even if
it is later deleted or overwritten, a write that first appears after another step is
`observed_after_other_step`, and a state change during any read is a `STATE_CHANGED_BY_READ` critical failure.

**Snapshots are self-reported.** They are what `exportRecords()` returns, cloned at once. The runner
cannot see state between calls or verify that an export is what the system stores; a system that
changes state between two exports and restores it before the next, or exports something other than
its store, is not detected. This is the export-honesty requirement below, applied to every snapshot.

**Duplicates.** Return one decision per proposition and one answer per read. Identical duplicates count
once; differing ones are scored as conflicting (METRICS.md, Section 2.5).

An adapter may declare `contract: "isa-adapter/2.1"`; the runner records it in the output. The
adapters in this repository all declare it.

`context` (deep-frozen): `id` (opaque), `contracts` (only those the case uses), `rules`, `vocabulary`,
`parties`, `accounts`, `grants`, `materials`, `initialRecords`. Steps and queries are frozen copies of
the case. Ground truth is never passed and is loaded by the runner only after the adapter has finished.

## Outputs

- **Decision**: `{ candidate, target?, outcome, reason }`, one per proposal (add `target` if you split a
  candidate into several propositions). `reason` may be `null`; it then never matches.
- **Record**: [`schemas/record.schema.json`](schemas/record.schema.json). Export initial records unchanged
  (any change is HISTORY_ALTERED) and new records with `candidate` set to the proposal they were written
  for. `step` must be the id of the step that submitted the candidate, `submittedBy` that step's account
  and `recordedAt` that step's `at`, as an RFC 3339 date-time with an offset, within one second
  (`step.at ≤ recordedAt < step.at + 1 s`; METRICS.md, Section 2.2).
- **Answer**: `{ read, status: "value" | "none" | "conflicting", recordType?, attributedTo?, fields?, qualifiers?, claims? }`.
  For a viewer outside a record's audience, answer exactly as if the record did not exist. Every field
  you serve is a claim: fields beyond the ones a read checks must hold the values of the true state
  (METRICS.md, Section 2.3).

## Output schema and compatibility

The runner writes `isa-run-output/2.1` (`benchmarkVersion` 2.1.0): each case output carries, besides
`decisions`, `records` (the state after the last step, before reads, as in 2.0.0) and `answers`, a
`snapshots` array of `{ after, records }`, one per step (`after` = step id; `init` for a case without
steps) and one per read (`after` = `read:<read id>`).

- **2.0.0 adapters** run unchanged if their `exportRecords()` is side-effect free and reflects current
  state; it is now called once per step and once per read instead of once. An adapter that only
  materialises its state on the first call, or whose export changes state, is incompatible and must be
  fixed. Its 2.1 results are not comparable with 2.0.0 results.
- **2.0.0 output files** (`isa-run-output/2`, no snapshots) still validate and score, on `records`
  only; `metrics.coverage.casesWithSnapshots` is then 0. The `recorded` adapter replays a 2.1 file's
  snapshots in order and a 2.0 file's `records` for every export.
- `examples/output.example.json` shows the 2.1 format; `examples/output.v2.0.example.json` the 2.0 format.

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
