import { test } from "node:test";
import assert from "node:assert/strict";
import { clopperPearson, zeroOfNUpper, binomCdf, rate } from "../lib/stats.mjs";
const near = (a, b, eps = 1e-4) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
test("zero-of-n one-sided 95% upper bound is 1 - 0.05^(1/n), about 3/n", () => {
  near(zeroOfNUpper(10), 0.2589); near(zeroOfNUpper(41), 0.0705); near(zeroOfNUpper(100), 0.0295);
  assert.ok(Math.abs(zeroOfNUpper(300) - 3 / 300) < 0.0005);
});
test("Clopper-Pearson matches closed forms at the boundaries and a known interior value", () => {
  const [lo0, hi0] = clopperPearson(0, 10); assert.equal(lo0, 0); near(hi0, 1 - Math.pow(0.025, 1 / 10));
  const [loN, hiN] = clopperPearson(10, 10); near(loN, Math.pow(0.025, 1 / 10)); assert.equal(hiN, 1);
  const [lo, hi] = clopperPearson(5, 10); near(lo, 0.1871, 2e-4); near(hi, 0.8129, 2e-4);
});
test("binomial CDF sanity", () => { near(binomCdf(0, 3, 0.5), 0.125); near(binomCdf(2, 3, 0.5), 0.875); });
test("rate reports n/a for an empty denominator instead of 0", () => { assert.equal(rate(0, 0).value, null); assert.ok(rate(0, 5).zeroUpper95 > 0.4); });
