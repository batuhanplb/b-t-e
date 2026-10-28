// Display-only formatting; persisted transaction amounts remain numeric.
// Both "." and "," work as decimal separators while typing; the field always
// renders "," as the decimal separator and "." as the thousands separator.

const DECIMALS = 2;

const stripSeps = s => String(s ?? "").replace(/[.,]/g, "");

export function formatAmountInput(value) {
  const clean = String(value ?? "").replace(/\u066B/g, ",").replace(/\u066C/g, ".").replace(/[^\d.,]/g, "");
  if (!clean) return "";
  let integer = clean;
  let decimal = "";
  let hasDecimal = false;
  const comma = clean.indexOf(",");
  if (comma >= 0) {
    integer = stripSeps(clean.slice(0, comma));
    decimal = stripSeps(clean.slice(comma + 1)).slice(0, DECIMALS);
    hasDecimal = true;
  } else if (clean.includes(".")) {
    const last = clean.lastIndexOf(".");
    const before = clean.slice(0, last);
    const after = stripSeps(clean.slice(last + 1));
    // "1.250" / "5120.000": 3+ digits after the dot is thousands grouping, not
    // decimals. It has to be "3 or more", not "exactly 3": after "4.000" the next
    // typed digit makes "4.0000", which used to be read as decimals and collapsed
    // the field to "4,00" (a 400.000 credit-card limit could not be typed).
    // Two decimals is the maximum anyway, so a longer tail is always grouping.
    const grouped = after.length > DECIMALS && /\d/.test(before);
    if (grouped) integer = stripSeps(clean);
    else { integer = stripSeps(before); decimal = after.slice(0, DECIMALS); hasDecimal = true; }
  }
  const trimmed = integer.replace(/^0+(?=\d)/, "");
  const groupedInt = (trimmed || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return groupedInt + (hasDecimal ? "," + decimal : "");
}

export function formatAmountField(input) {
  const raw = input.value;
  const start = input.selectionStart ?? raw.length;
  const end = input.selectionEnd ?? start;
  const digitsBefore = pos => (raw.slice(0, pos).match(/\d/g) || []).length;
  const sepBefore = pos => /[.,]\s*$/.test(raw.slice(0, pos));
  const position = (formatted, digits, afterSep) => {
    if (!digits) return afterSep && formatted[0] === "," ? 1 : 0;
    let seen = 0, pos = formatted.length;
    for (let i = 0; i < formatted.length; i++) {
      if (/\d/.test(formatted[i])) {
        seen++;
        if (seen === digits) { pos = i + 1; break; }
      }
    }
    if (afterSep && formatted[pos] === ",") pos++;
    return pos;
  };
  input.value = formatAmountInput(raw);
  input.setSelectionRange(position(input.value, digitsBefore(start), sepBefore(start)), position(input.value, digitsBefore(end), sepBefore(end)));
}
