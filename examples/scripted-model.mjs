// A SCRIPTED STAND-IN FOR A MODEL, used only to test the LLM harness plumbing offline. It is not a
// language model and its outputs are not LLM results. It refuses every proposal (reason null) and
// answers every read with status "none".
export default async function scriptedModel({ purpose, user }) {
  const input = JSON.parse(user);
  if (purpose === "submit") return { json: { decisions: input.step.candidates.map((c) => ({ candidate: c.ref, outcome: "REFUSE", reason: null })), records: [] }, usage: { inputTokens: user.length, outputTokens: 50 } };
  return { json: { status: "none" }, usage: { inputTokens: user.length, outputTokens: 5 } };
}
