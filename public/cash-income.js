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