// Display-only formatting; persisted transaction amounts remain numeric.
export function formatAmountInput(value) {
  const clean = String(value ?? "").replace(/[^\d,]/g, "");
  if (!clean) return "";
  const comma = clean.indexOf(",");
  const integer = (comma < 0 ? clean : clean.slice(0, comma)).replace(/^0+(?=\d)/, "");
  const grouped = (integer || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return grouped + (comma < 0 ? "" : "," + clean.slice(comma + 1).replace(/,/g, "").slice(0, 2));
}

export function formatAmountField(input) {
  const raw = input.value;
  const start = input.selectionStart ?? raw.length;
  const end = input.selectionEnd ?? start;
  const count = position => raw.slice(0, position).replace(/[^\d,]/g, "").length;
  const position = (formatted, target) => {
    if (!target) return 0;
    let seen = 0;
    for (let i = 0; i < formatted.length; i++) {
      if (/[\d,]/.test(formatted[i])) seen++;
      if (seen === target) return i + 1;
    }
    return formatted.length;
  };
  input.value = formatAmountInput(raw);
  input.setSelectionRange(position(input.value, count(start)), position(input.value, count(end)));
}