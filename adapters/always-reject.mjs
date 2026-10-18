// Trivial baseline (kind: trivial). Declares REFUSE for every proposal and writes nothing. Reads use the
// no-policy reader in _naive.mjs. It exists to show which metrics a do-nothing policy can satisfy.
import { naiveSession } from "./_naive.mjs";
export default {
  name: "always-reject", kind: "trivial",
  description: "Declares REFUSE for every proposal, writes nothing, reads with no policy.",
  createSession: () => naiveSession({ decide: () => ({ outcome: "REFUSE", reason: null }), write: false })
};
