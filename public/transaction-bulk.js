// Change only selected transactions; dates, amounts and custom payees stay intact.
export function changeSelected(t, selected, kind, target) {
  if (!selected[t.id]) return t;
  if (kind === "cat") {
    if (t.k === "tr") return t;
    const next = { ...t, cat: target.id };
    delete next.sp;
    return next;
  }
  if (t.k === "tr" && t.to === target.id) return t;
  const next = { ...t, acc: target.id };
  delete next.so;
  return next;
}