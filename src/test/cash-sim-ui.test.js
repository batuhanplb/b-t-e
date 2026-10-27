// Nakit akışı sayfası: Orijinal / Simülasyon sekmesi ve tahmin satırları.
// Tahmin, geçmiş ayların ağırlıklı ortalamasıdır; cari ayda harcanan tutar
// tahminden düşülür (20.000 tahmin - 1.000 harcama = 19.000 kalan).
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM, VirtualConsole } from "jsdom";
import { describe, expect, it } from "vitest";
import * as C from "../../public/core.js";
import { simMonths, simEstimate, simRemaining, simMonthlyTotals, SIM_LOOKBACK } from "../../public/cash-sim.js";
import { formatAmountField } from "../../public/transaction-input.js";
import { stmtRange, parseStatementLines, reconcile, pdfLines } from "../../public/statement.js";

const here = path.dirname(fileURLToPath(import.meta.url));
// app.js bir ES modülüdür; jsdom modül çalıştıramadığı için import satırları
// silinir ve karşılıkları window'a elle verilir.
const APP_SRC = readFileSync(path.join(here, "../../public/app.js"), "utf8").replace(/^import[^\n]*\n/gm, "");

const ym = off => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + off);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
};

function seed() {
  const months = {};
  // Önceki 3 ay: her ay 20.000 ₺ Mutfak harcaması.
  [-1, -2, -3].forEach(off => {
    const m = ym(off);
    months[m] = [{ id: "h" + off, d: m + "-05", k: "e", a: 20000, t: "Market", cat: "c-mutfak", acc: "nakit" }];
  });
  // Cari ay: 1.000 ₺ harcandı → tahminin 19.000 ₺'si nakitten düşmeli.
  months[ym(0)] = [{ id: "now", d: ym(0) + "-02", k: "e", a: 1000, t: "Market", cat: "c-mutfak", acc: "nakit" }];
  return {
    meta: {
      accounts: [{ id: "nakit", name: "Nakit", type: "nakit", color: "#0091ea", start: 100000, order: 0 }],
      categories: [
        { id: "c-mutfak", name: "Mutfak", parent: null, type: "E", color: "#93a083" },
        { id: "c-kira", name: "Kira", parent: null, type: "E", color: "#a08393" },
      ],
      cash: { items: [], sim: { sel: [{ t: "cat", v: "c-mutfak" }] } },
    },
    months,
    debts: {},
  };
}

function boot(sd) {
  const dom = new JSDOM(
    '<!doctype html><html><body><div id="root"></div><dialog class="sheet" id="sheet"><div class="sh-in" id="sheet-in"></div></dialog></body></html>',
    { url: "http://localhost/?mock#cash", runScripts: "outside-only", virtualConsole: new VirtualConsole() },
  );
  const w = dom.window;
  w.__MOCK_SEED__ = JSON.parse(JSON.stringify(sd));
  w.matchMedia = q => ({ matches: false, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false });
  w.requestAnimationFrame = cb => w.setTimeout(() => cb(Date.now()), 0);
  w.cancelAnimationFrame = id => w.clearTimeout(id);
  if (!w.crypto || !w.crypto.getRandomValues) {
    Object.defineProperty(w, "crypto", {
      configurable: true,
      value: { getRandomValues: a => { for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256); return a; } },
    });
  }
  Object.assign(w, { C, formatAmountField, stmtRange, parseStatementLines, reconcile, pdfLines, simMonths, simEstimate, simRemaining, simMonthlyTotals, SIM_LOOKBACK });
  const dlg = w.document.getElementById("sheet");
  if (dlg && typeof dlg.showModal !== "function") {
    dlg.showModal = () => dlg.setAttribute("open", "");
    dlg.close = () => dlg.removeAttribute("open");
  }
  w.eval(APP_SRC);
  return dom;
}

const flush = () => new Promise(r => setTimeout(r, 30));
const click = (w, el) => el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
const txt = el => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");

describe("Nakit akışı simülasyon sekmesi", () => {
  it("orijinal görünümde tahmin kartı görünmez", async () => {
    const dom = boot(seed());
    const w = dom.window;
    await flush();
    const tabs = [...w.document.querySelectorAll(".cash-tabseg button")];
    expect(tabs.map(t => txt(t))).toEqual(["Orijinal", "Simülasyon"]);
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    expect(w.document.querySelector(".simcard")).toBeNull();
    dom.window.close();
  });

  it("simülasyon sekmesi tahmini ve kalan tutarı gösterir", async () => {
    const dom = boot(seed());
    const w = dom.window;
    await flush();
    click(w, w.document.querySelectorAll(".cash-tabseg button")[1]);
    await flush();
    expect(w.document.querySelector(".simcard")).not.toBeNull();
    expect(txt(w.document.querySelector(".simrow .r b"))).toContain("20.000");
    const rows = [...w.document.querySelectorAll(".crow.sim")];
    expect(rows.length).toBe(1);
    expect(txt(rows[0])).toContain("Mutfak");
    expect(txt(rows[0])).toContain("19.000"); // 20.000 tahmin - 1.000 harcanan
    expect(txt(rows[0])).toContain("harcandı");
    dom.window.close();
  });

  it("gelecek ayda tahminin tamamı düşülür", async () => {
    const dom = boot(seed());
    const w = dom.window;
    await flush();
    click(w, w.document.querySelectorAll(".cash-tabseg button")[1]);
    await flush();
    // Ay kartındaki "sonraki ay" oku.
    const nav = [...w.document.querySelectorAll('.cash-nav [data-act="cash-open"]')];
    const next = nav[nav.length - 1];
    click(w, next);
    await flush();
    const rows = [...w.document.querySelectorAll(".crow.sim")];
    expect(rows.length).toBe(1);
    const t = txt(rows[0]);
    expect(t).toContain("20.000");
    expect(t).not.toContain("harcandı");
    dom.window.close();
  });

  it("seçilen kalem meta.cash.sim.sel'e yazılır", async () => {
    const dom = boot(seed());
    const w = dom.window;
    await flush();
    click(w, w.document.querySelectorAll(".cash-tabseg button")[1]);
    await flush();
    click(w, w.document.querySelector('[data-act="sim-pick"]'));
    await flush();
    const btn = [...w.document.querySelectorAll('[data-act="sim-tog"]')].find(b => b.getAttribute("data-v") === "c-kira");
    expect(btn).toBeTruthy();
    click(w, btn);
    await flush();
    expect(w.__store.meta.cash.sim.sel).toEqual([{ t: "cat", v: "c-mutfak" }, { t: "cat", v: "c-kira" }]);
    dom.window.close();
  });
});
