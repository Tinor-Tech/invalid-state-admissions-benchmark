// Plain-text rendering of Level 2 metrics.
const f = (r) => (r.value === null ? `n/a (0 units)` : `${r.num}/${r.den} = ${r.value.toFixed(3)}  [95% CI ${r.ci95[0].toFixed(3)}-${r.ci95[1].toFixed(3)}${r.zeroUpper95 !== undefined ? `; zero-of-n upper ${r.zeroUpper95.toFixed(3)}` : ""}]`);
export function renderMetrics(name, m) {
  const L = [];
  L.push(`Adapter: ${name}`);
  L.push(`Units: ${m.units.cases} cases, ${m.units.propositions} propositions, ${m.units.reads} reads (${m.units.restrictedReads} restricted)`);
  L.push(`Safety (lower is better)`);
  for (const k of ["OAR", "IPAR", "UFR", "DLR"]) L.push(`  ${k.padEnd(5)} ${f(m.safety[k])}`);
  L.push(`Valid-admission ability (higher is better)`);
  for (const k of ["VSAR", "CDR", "SRA"]) L.push(`  ${k.padEnd(5)} ${f(m.ability[k])}`);
  L.push(`Case completion`);
  L.push(`  CPR   ${f(m.completion.CPR)}`);
  L.push(`Critical failures: ${m.critical.total} (unauthorized write ${m.critical.UNAUTHORIZED_WRITE}, disclosure leak ${m.critical.DISCLOSURE_LEAK}, history altered ${m.critical.HISTORY_ALTERED}) in ${m.critical.casesWithCritical} cases`);
  L.push(`System errors: ${m.errors.cases} cases; OAR counting errors as violations ${f(m.errors.OAR_worst)}; IPAR likewise ${f(m.errors.IPAR_worst)}`);
  L.push(`Decision level (declared outcome only): CDR ${f(m.decisionLevel.CDR)}; OAR_decision ${f(m.decisionLevel.OAR_decision)}`);
  return L.join("\n");
}
export function compactRow(name, m) {
  const v = (r) => (r.value === null ? "n/a" : `${r.num}/${r.den}`);
  return { adapter: name, OAR: v(m.safety.OAR), IPAR: v(m.safety.IPAR), UFR: v(m.safety.UFR), DLR: v(m.safety.DLR), VSAR: v(m.ability.VSAR), CDR: v(m.ability.CDR), SRA: v(m.ability.SRA), CPR: v(m.completion.CPR), critical: m.critical.total, errors: m.errors.cases };
}
