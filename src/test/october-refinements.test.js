import { describe, expect, it } from "vitest";
import { incomeAmount, applyIncomeRange } from "../../public/cash-income.js";
import { changeSelected } from "../../public/transaction-bulk.js";
import { addM } from "../../public/core.js";

describe("Gelecek gelir dönemleri", () => {
  it("6 aylık tutar önceki ayları değiştirmez ve sonraki plana döner", () => {
    const plan = [{ from: "2026-10", a: 50000 }, { from: "2027-07", a: 70000 }];
    const next = applyIncomeRange(plan, "2027-01", 6, 60000, addM);
    expect(incomeAmount(next, "2026-12")).toBe(50000);
    for (let i = 0; i < 6; i++) expect(incomeAmount(next, addM("2027-01", i))).toBe(60000);
    expect(incomeAmount(next, "2027-07")).toBe(70000);
    expect(plan).toEqual([{ from: "2026-10", a: 50000 }, { from: "2027-07", a: 70000 }]);
  });
  it("tek ay düzenlemesi yalnızca o ayı değiştirir", () => {
    const next = applyIncomeRange([{ from: "2026-10", a: 50000 }], "2026-12", 1, 55000, addM);
    expect(incomeAmount(next, "2026-11")).toBe(50000);
    expect(incomeAmount(next, "2026-12")).toBe(55000);
    expect(incomeAmount(next, "2027-01")).toBe(50000);
  });
});
describe("Toplu işlem düzenleme", () => {
  const tx = { id: "t1", d: "2026-10-29", a: 1250, t: "Migros", k: "e", cat: "old", acc: "cash" };
  it("seçili işlem başka kategoriye taşınır; tarih, tutar ve özel lehdar korunur", () => {
    expect(changeSelected(tx, { t1: "2026-10" }, "cat", { id: "new", type: "E" })).toEqual({ ...tx, cat: "new" });
    expect(changeSelected(tx, {}, "cat", { id: "new", type: "E" })).toBe(tx);
  });
  it("seçili işlem başka hesaba taşınır", () => {
    expect(changeSelected(tx, { t1: "2026-10" }, "acc", { id: "bank" })).toEqual({ ...tx, acc: "bank" });
  });
  it("gelir/gider türleri karıştırılmaz", () => {
    expect(changeSelected(tx, { t1: "2026-10" }, "cat", { id: "salary", type: "I" })).toBe(tx);
  });
  it("aynı hesaba transfer oluşturmaz", () => {
    const transfer = { ...tx, k: "tr", to: "bank" };
    expect(changeSelected(transfer, { t1: "2026-10" }, "acc", { id: "bank" })).toBe(transfer);
  });
});