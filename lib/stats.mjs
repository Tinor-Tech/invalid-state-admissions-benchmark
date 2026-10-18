// Exact binomial intervals. Clopper & Pearson (1934), Biometrika 26(4):404-413.
function lnGamma(z) {
  const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  z -= 1; let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}
const lnChoose = (n, k) => lnGamma(n + 1) - lnGamma(k + 1) - lnGamma(n - k + 1);
/** P(X <= k) for X ~ Binomial(n, p). */
export function binomCdf(k, n, p) {
  if (k < 0) return 0; if (k >= n) return 1;
  if (p <= 0) return 1; if (p >= 1) return 0;
  let s = 0;
  for (let i = 0; i <= k; i++) s += Math.exp(lnChoose(n, i) + i * Math.log(p) + (n - i) * Math.log(1 - p));
  return Math.min(1, s);
}
function bisect(f, lo = 0, hi = 1) { // f decreasing in p; find p with f(p) = 0
  for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (f(mid) > 0) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
/** Two-sided exact (Clopper-Pearson) interval for k successes in n trials. */
export function clopperPearson(k, n, alpha = 0.05) {
  if (n === 0) return [0, 1];
  const lower = k === 0 ? 0 : bisect((p) => (1 - binomCdf(k - 1, n, p)) < alpha / 2 ? 1 : -1);
  const upper = k === n ? 1 : bisect((p) => binomCdf(k, n, p) - alpha / 2);
  return [lower, upper];
}
/** One-sided upper bound when 0 of n failed: 1 - alpha^(1/n). About 3/n at 95% (Hanley & Lippman-Hand 1983). */
export const zeroOfNUpper = (n, alpha = 0.05) => (n === 0 ? 1 : 1 - Math.pow(alpha, 1 / n));

const r4 = (x) => Math.round(x * 10000) / 10000;
/** A rate with its exact 95% interval; zero numerators also get the one-sided 95% upper bound. */
export function rate(num, den) {
  if (den === 0) return { num, den, value: null, ci95: null, note: "undefined (empty denominator)" };
  const [lo, hi] = clopperPearson(num, den);
  const out = { num, den, value: r4(num / den), ci95: [r4(lo), r4(hi)] };
  if (num === 0) out.zeroUpper95 = r4(zeroOfNUpper(den));
  return out;
}
