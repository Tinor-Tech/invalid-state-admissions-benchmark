// Trivial baseline (kind: trivial). Declares HOLD for every proposal and writes nothing. Reads use the
// no-policy reader in _naive.mjs. It exists to show which metrics a do-nothing policy can satisfy.
import { naiveSession } from "./_naive.mjs";
export default {
  name: "always-hold", kind: "trivial", contract: "isa-adapter/2.1",
  description: "Declares HOLD for every proposal, writes nothing, reads with no policy.",
  createSession: () => naiveSession({ decide: () => ({ outcome: "HOLD", reason: null }), write: false })
};
