// v1.0.0 stays reproducible: the v1 scorer and cases are kept verbatim under v1/fact-admission.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { ROOT } from "../lib/load.mjs";
const run = (b) => execFileSync(process.execPath, [join(ROOT, "v1/fact-admission/score.mjs"), join(ROOT, "v1/fact-admission/cases.json"), "--baseline", b], { encoding: "utf8" }).split("\n")[0];
test("v1 baseline numbers are unchanged", () => {
  assert.equal(run("always-reject"), "cases 10 · ISAR (disposition) 0/8 · VSAR (disposition) 0/3 · CDR 0/10 · outcome-only 4/10");
  assert.equal(run("always-hold"), "cases 10 · ISAR (disposition) 0/8 · VSAR (disposition) 0/3 · CDR 0/10 · outcome-only 3/10");
  assert.equal(run("always-admit"), "cases 10 · ISAR (disposition) 8/8 · VSAR (disposition) 0/3 · CDR 0/10 · outcome-only 2/10");
});
