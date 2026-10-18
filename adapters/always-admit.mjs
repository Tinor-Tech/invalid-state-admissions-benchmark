// Trivial baseline (kind: trivial). Declares ADMIT for every proposal and writes each proposal exactly as
// proposed. Reads use the no-policy reader in _naive.mjs.
import { naiveSession } from "./_naive.mjs";
export default {
  name: "always-admit", kind: "trivial",
  description: "Declares ADMIT and writes every proposal as proposed; reads with no policy.",
  createSession: () => naiveSession({ decide: () => ({ outcome: "ADMIT", reason: null }), write: true })
};
