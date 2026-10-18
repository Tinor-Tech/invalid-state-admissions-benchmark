// Replays a recorded run output (schemas/output.schema.json) through the same runner and scorer.
// Use it to score outputs produced by any other harness, language or system, including recorded LLM
// runs: node run.mjs --adapter recorded --recorded path/to/output.json
import { readFileSync } from "node:fs";
import { clone } from "../lib/util.mjs";
export default {
  name: "recorded", kind: "recorded",
  description: "Replays decisions, records and answers from a recorded output file.",
  createSession(options = {}) {
    if (!options.recorded) throw new Error("recorded adapter needs --recorded <file>");
    const file = JSON.parse(readFileSync(options.recorded, "utf8"));
    let o;
    return {
      async init(ctx) { o = file.outputs[ctx.id]; if (!o) throw new Error(`no recorded output for ${ctx.id}`); if (o.error) throw new Error(o.error); },
      async submit(step) {
        const refs = new Set(step.candidates.map((c) => c.ref));
        return { decisions: clone(o.decisions.filter((d) => refs.has(d.candidate))) };
      },
      async exportRecords() { return clone(o.records); },
      async read(q) { return clone(o.answers.find((a) => a.read === q.id) ?? null); }
    };
  }
};
