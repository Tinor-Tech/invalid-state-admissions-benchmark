# Reproduction guide

Everything below runs offline on Node.js 22 or later, with no dependencies. Expected outputs are the
committed files; any difference is a bug.

## 1. Get the exact version

```sh
git clone https://github.com/Tinor-Tech/invalid-state-admissions-benchmark.git
cd invalid-state-admissions-benchmark
git checkout <tag or commit>      # cite the tag or commit you used; v2.0.0 is not released yet
node --version                    # >= 22
```

## 2. Run the tests

```sh
npm test
```

Expected: all tests pass. They check the data against the schemas, the separation of inputs from ground
truth, every scorer definition against deliberately wrong outputs, the statistics, the v1 numbers, the
offline LLM harness plumbing, and that the committed baseline results match a fresh run.

## 3. Reproduce the baseline numbers

```sh
node baselines/run-baselines.mjs
git diff --stat baselines/results/   # only SUMMARY.md's wall-time table should differ
```

Individual runs:

```sh
node run.mjs --adapter always-reject
node run.mjs --adapter always-hold
node run.mjs --adapter always-admit
node run.mjs --adapter reference-rules
node run.mjs --adapter reference-rules --cases probes/cases --truth probes/ground-truth
node score-dispositions.mjs --baseline always-admit
```

## 4. Reproduce v1.0.0

```sh
cd v1/fact-admission
node score.mjs cases.json --baseline always-reject
# cases 10 · ISAR (disposition) 0/8 · VSAR (disposition) 0/3 · CDR 0/10 · outcome-only 4/10
```

## 5. Evaluate a system

1. Copy `examples/adapter-template.mjs` and connect it to a fresh instance of the system for each case.
   Export what the system actually persisted, and answer reads from its actual state.
2. Run it at least three times: `node run.mjs --adapter ./my-adapter.mjs --runs 3 --out runs/my-system.json`.
3. Publish the output file, the system and model versions, the configuration, the date, the commit of
   this repository, and the full metric printout including critical failures, system errors and cost.
4. Declare your thresholds before the run. State results as in METRICS.md, Section 5.
5. Do not tune on `ground-truth/`, `CASES.md` or `probes/`, and say so. A public-set result is a
   development result. Formal comparison needs the hidden set described in REVIEW.md, which does not exist yet.

## 6. Score a recorded output from elsewhere

```sh
node score.mjs path/to/output.json      # must match schemas/output.schema.json
```
