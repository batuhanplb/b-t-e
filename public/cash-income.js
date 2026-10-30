// Effective-month changes: each amount lasts until the next change.
export function incomeAmount(amts, month) {
  return (amts || []).filter(x => x.from <= month).sort((a, b) => b.from.localeCompare(a.from))[0]?.a || 0;
}
export function applyIncomeRange(amts, from, count, amount, addMonth) {
  const end = addMonth(from, count), after = incomeAmount(amts, end);
  const next = (amts || []).filter(x => x.from < from || x.from >= end).map(x => ({ ...x }));
  next.push({ from, a: amount });
  if (!next.some(x => x.from === end)) next.push({ from: end, a: after });
  return next.sort((a, b) => a.from.localeCompare(b.from));
}
// Variable plan: consecutive periods [{n, a}] starting at `from`; the last amount continues.
// Entries before `from` (history) are kept untouched.
export function periodsToAmts(amts, from, pers, addMonth) {
  const out = (amts || []).filter(x => x.from < from).map(x => ({ ...x }));
  let m = from;
  for (const p of pers || []) { if (!(p.n > 0) || !(p.a >= 0)) continue; out.push({ from: m, a: p.a }); m = addMonth(m, p.n); }
  return out.sort((a, b) => a.from.localeCompare(b.from));
}
