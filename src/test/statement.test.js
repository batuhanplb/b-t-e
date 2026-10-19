import { describe, it, expect } from "vitest";
import { stmtRange, parseStatementLines, reconcile } from "../../public/statement.js";
describe("ekstre", () => {
  it("kesim günü dahil, ertesi gün yeni dönem", () => {
    expect(stmtRange(5, new Date(2026, 9, 19))).toEqual(["2026-09-06", "2026-10-05"]);
    expect(stmtRange(5, new Date(2026, 9, 3))).toEqual(["2026-08-06", "2026-09-05"]);
  });
  it("PDF satırlarını okur ve eşleştirir", () => {
    const b = parseStatementLines(["12.10.2026 MIGROS ISTANBUL 1.250,40", "13.10.2026 NETFLIX 229,99", "14/10/2026 ÖDEME TEŞEKKÜRLER -5.000,00"]);
    expect(b[0]).toMatchObject({ d: "2026-10-12", a: 1250.4 });
    expect(b[2].credit).toBe(true);
    const r = reconcile(b, [{ id: "1", d: "2026-10-12", a: 1250.4 }, { id: "2", d: "2026-10-13", a: 199.99 }, { id: "3", d: "2026-10-01", a: 50 }]);
    expect(r.ok.length).toBe(1); expect(r.diff.length).toBe(1); expect(r.missing.length).toBe(0); expect(r.extra.map(t => t.id)).toEqual(["3"]);
  });
});
describe("bölünmüş ve elle eşleştirme", () => {
  it("2000 TL satırını 500 + 1500 girişleriyle otomatik eşler", () => {
    const r = reconcile([{ d: "2026-10-12", a: 2000, t: "MARKET" }], [{ id: "a", d: "2026-10-12", a: 500 }, { id: "b", d: "2026-10-13", a: 1500 }]);
    expect(r.ok.length).toBe(1); expect(r.ok[0].ts.map(t => t.id)).toEqual(["a", "b"]); expect(r.extra.length).toBe(0);
  });
  it("elle eşleştirilenleri eşleşmiş sayar", () => {
    const r = reconcile([{ d: "2026-10-12", a: 1000, t: "X" }], [{ id: "a", d: "2026-10-12", a: 500 }, { id: "b", d: "2026-10-20", a: 400 }], [{ d: "2026-10-12", a: 1000, ids: ["a", "b"] }]);
    expect(r.ok[0].manual).toBe(true); expect(r.missing.length).toBe(0); expect(r.extra.length).toBe(0);
  });
});
