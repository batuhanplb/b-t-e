// Nakit akışı simülasyonu: geçmiş aylardan ağırlıklı tahmin.
// Basit ortalama değil: yakın aylar daha ağır, uç harcamalar kırpılır,
// ay içinde harcanan tutar tahminden düşülür.
import { describe, expect, it } from "vitest";
import { simMonths, simEstimate, simRemaining, simMonthlyTotals, weightedMean, capOutliers } from "../../public/cash-sim.js";

describe("Simülasyon tahmini", () => {
  it("cari aydan önceki ayları eski→yeni üretir", () => {
    expect(simMonths("2026-10", 12)).toEqual([
      "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03",
      "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09",
    ]);
    expect(simMonths("2026-01", 3)).toEqual(["2025-10", "2025-11", "2025-12"]);
  });

  it("sabit harcamada ağırlıklı ortalama sabit kalır", () => {
    expect(weightedMean(new Array(12).fill(1000))).toBeCloseTo(1000, 6);
  });

  it("yakın aylara daha çok ağırlık verir", () => {
    const jump = [...new Array(11).fill(0), 1000];
    // Düz ortalama 83,3 olurdu; ağırlıklı tahmin son ayı öne çıkarır.
    expect(weightedMean(jump)).toBeGreaterThan(200);
    expect(weightedMean(jump)).toBeLessThan(400);
  });

  it("son aylar yükseldiyse tahmin düz ortalamanın üstünde olur", () => {
    const rising = [1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 2200];
    const e = simEstimate(rising);
    expect(e.avg).toBeGreaterThan(e.raw);
    expect(e.trend).toBeGreaterThan(0.05);
    expect(e.active).toBe(12);
  });

  it("tek seferlik uç harcamayı kırpar", () => {
    const vals = [1000, 1000, 1000, 1000, 1000, 10000];
    expect(capOutliers(vals)[5]).toBe(2500);
    expect(simEstimate(vals).avg).toBeLessThan(4000);
  });

  it("yeni başlayan kalemde boş geçmiş aylar tahmini düşürmez", () => {
    const vals = [0, 0, 0, 0, 0, 0, 0, 0, 0, 20000, 20000, 20000];
    const e = simEstimate(vals);
    expect(e.avg).toBe(20000);
    expect(e.span).toBe(3);
    expect(e.active).toBe(3);
  });

  it("aradaki boş aylar tahmini düşürür", () => {
    const e = simEstimate([0, 1000, 0, 1000, 0, 1000]);
    expect(e.avg).toBeLessThan(700);
    expect(e.avg).toBeGreaterThan(300);
  });

  it("hiç harcama yoksa tahmin sıfırdır", () => {
    const e = simEstimate(new Array(12).fill(0));
    expect(e.avg).toBe(0);
    expect(e.active).toBe(0);
  });

  it("ay içinde harcanan tutar tahminden düşer", () => {
    expect(simRemaining(20000, 1000)).toEqual({ est: 20000, spent: 1000, rem: 19000, done: false });
    const done = simRemaining(20000, 25000);
    expect(done.rem).toBe(0);
    expect(done.done).toBe(true);
  });
});

describe("Seçili kalemlerin aylık toplamları", () => {
  const catMap = {
    "c-mutfak": { id: "c-mutfak", parent: null },
    "c-pazar": { id: "c-pazar", parent: "c-mutfak" },
    "c-kart": { id: "c-kart", parent: "c-pazar" },
  };
  const txs = [
    { d: "2026-08-03", a: 100, cat: "c-mutfak", t: "Market" },
    { d: "2026-08-04", a: 50, cat: "c-pazar", t: "Market" },
    { d: "2026-08-05", a: 30, cat: "c-kart", t: "Kırtasiye" },
    { d: "2026-09-01", a: 200, cat: "c-mutfak", t: "Market" },
    { d: "2026-09-02", a: 400, sp: [{ cat: "c-pazar", a: 150 }, { cat: "c-mutfak", a: 250 }], t: "A101" },
  ];
  const opt = { catMap, payOf: t => t.t, partsOf: t => (t.sp && t.sp.length ? t.sp : [{ cat: t.cat, a: t.a }]) };

  it("ana kategori alt kategorileri de kapsar, bölünmüş tutarlar ayrışır", () => {
    const r = simMonthlyTotals(txs, [{ t: "cat", v: "c-mutfak" }], opt);
    expect(r["cat:c-mutfak"]["2026-08"]).toBe(180);
    expect(r["cat:c-mutfak"]["2026-09"]).toBe(600);
  });

  it("alt kategori seçilirse sadece kendisi toplanır", () => {
    const r = simMonthlyTotals(txs, [{ t: "cat", v: "c-pazar" }], opt);
    expect(r["cat:c-pazar"]["2026-08"]).toBe(80);
    expect(r["cat:c-pazar"]["2026-09"]).toBe(150);
  });

  it("lehdar seçimi büyük/küçük harfe duyarsızdır", () => {
    const r = simMonthlyTotals(txs, [{ t: "pay", v: "market" }], opt);
    expect(r["pay:market"]["2026-08"]).toBe(150);
    expect(r["pay:market"]["2026-09"]).toBe(200);
  });
});
