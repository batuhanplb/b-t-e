import { describe, expect, it } from "vitest";
import { formatAmountInput, formatAmountField } from "../../public/transaction-input.js";
import { parseAmt } from "../../public/core.js";

describe("Transaction amount input", () => {
  it.each([
    ["", ""], ["50000", "50.000"], ["1000000", "1.000.000"],
    ["50.000,50", "50.000,50"], ["50000,", "50.000,"],
    [",5", "0,5"], ["00050", "50"], ["â‚º 1.250,75", "1.250,75"],
  ])("formats %s as %s", (raw, expected) => {
    expect(formatAmountInput(raw)).toBe(expected);
  });
  it.each([
    ["12.5", "12,5"], ["1234.5", "1.234,5"], ["0.5", "0,5"], ["12.", "12,"],
    [".5", "0,5"], ["1.250", "1.250"], ["5120.000", "5.120.000"],
    ["1.250,75", "1.250,75"], ["12,345", "12,34"], ["1.250.000.75", "1.250.000,75"],
    // A digit typed after a grouped thousand must extend the number, not turn it
    // into decimals (credit-card limit 400.000 used to collapse to 4,00).
    ["4.0000", "40.000"], ["40.0000", "400.000"], ["400.0000", "4.000.000"],
    ["1.2500", "12.500"],
  ])("maps dot separator %s to %s", (raw, expected) => {
    expect(formatAmountInput(raw)).toBe(expected);
  });
  it("lets a large limit be typed digit by digit", () => {
    let typed = "";
    for (const ch of "400000") typed = formatAmountInput(typed + ch);
    expect(typed).toBe("400.000");
    expect(parseAmt(typed)).toBe(400000);
  });
  it("still allows decimals after a grouped thousand", () => {
    let typed = "";
    for (const ch of "1250.5") typed = formatAmountInput(typed + ch);
    expect(typed).toBe("1.250,5");
    expect(parseAmt(typed)).toBe(1250.5);
  });
  it("keeps the amount numeric when saved", () => {
    expect(parseAmt(formatAmountInput("50000,50"))).toBe(50000.5);
    expect(parseAmt(formatAmountInput("50000.50"))).toBe(50000.5);
    expect(parseAmt(formatAmountInput("12.5"))).toBe(12.5);
    expect(parseAmt(formatAmountInput("1.250"))).toBe(1250);
  });
  it("keeps the cursor alongside the edited digits", () => {
    const input = document.createElement("input");
    input.value = "5120.000,50";
    input.setSelectionRange(2, 2);
    formatAmountField(input);
    expect(input.value).toBe("5.120.000,50");
    expect(input.selectionStart).toBe(3);
  });
  it("keeps the cursor after a freshly typed dot", () => {
    const input = document.createElement("input");
    input.value = "1234.";
    input.setSelectionRange(5, 5);
    formatAmountField(input);
    expect(input.value).toBe("1.234,");
    expect(input.selectionStart).toBe(6);
  });
  it("grows a field value when a big limit is typed key by key", () => {
    const input = document.createElement("input");
    for (const ch of "400000") {
      input.value += ch;
      input.setSelectionRange(input.value.length, input.value.length);
      formatAmountField(input);
    }
    expect(input.value).toBe("400.000");
    expect(input.selectionStart).toBe(7);
    expect(parseAmt(input.value)).toBe(400000);
  });
});
