// Template for connecting a system under test (kind: system-under-test). Copy, fill in, then:
//   node run.mjs --adapter ./examples/adapter-template.mjs --out my-run.json
// The runner calls, per case: init(context) -> submit(step) for each step -> exportRecords() -> read(query).
// Contract details: ADAPTERS.md. Report your system's real behaviour: export what it actually persisted,
// answer reads from its actual state, and do not consult ground-truth/.
export default {
  name: "my-system", kind: "system-under-test",
  description: "Describe the system, its version and its configuration.",
  createSession(options) {
    return {
      // context: { id, contracts, rules, vocabulary, parties, accounts, grants, materials, initialRecords } (frozen)
      async init(context) { throw new Error("load context.initialRecords into a fresh instance of your system"); },
      // step: { id, at, submittedBy, request, candidates[] }. Return one decision per candidate (and per target, if you split).
      async submit(step) { return { decisions: step.candidates.map((c) => ({ candidate: c.ref, outcome: "HOLD", reason: null })) }; },
      // Every record your system holds after the steps, initial records included, in schemas/record.schema.json form.
      async exportRecords() { return []; },
      // query: { id, viewer, subject, target, match, asOf, knownAt }. Answer as the viewer would be answered.
      async read(query) { return { read: query.id, status: "none" }; },
      async cost() { return { modelCalls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 }; }
    };
  }
};
