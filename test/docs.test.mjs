import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../lib/load.mjs";
import { renderRules, renderCases } from "../tools/gen-docs.mjs";
import { spec, cases, truths } from "./_helpers.mjs";
test("RULES.md and CASES.md are up to date with spec/ and ground-truth/", () => {
  assert.equal(readFileSync(join(ROOT, "RULES.md"), "utf8"), renderRules(spec));
  assert.equal(readFileSync(join(ROOT, "CASES.md"), "utf8"), renderCases(spec, cases, truths));
});
