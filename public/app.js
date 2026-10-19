import * as C from "./core.js";
import { formatAmountField } from "./transaction-input.js";
import { stmtRange, parseStatementLines, reconcile, pdfLines } from "./statement.js";
const APP_VERSION = "1.2.24.1";
const applyTheme = t => { t = t === "dark" ? "dark" : "light"; document.documentElement.dataset.theme = t; try { localStorage.setItem("butce-theme", t); } catch (e) {} const m = document.querySelectorAll('meta[name="theme-color"]'); m.forEach(x => x.content = t === "dark" ? "#1c1f1f" : "#f5f5f3"); };
try { applyTheme(localStorage.getItem("butce-theme")); } catch (e) {}
function ask(msg, opts) {
  opts = opts || [{ l: "Sil", v: true, red: 1 }];
  return new Promise(res => {
    const o = document.createElement("div"); o.className = "askov";
    o.innerHTML = '<div class="askbox"><p>' + msg + '</p>' + opts.map((x, i) => '<button class="btn' + (x.red ? ' askred' : '') + '" data-i="' + i + '">' + x.l + '</button>').join("") + '<button class="btn ghost" data-i="-1">Vazgeç</button></div>';
    const done = v => { o.remove(); res(v); };
    o.addEventListener("click", e => { e.stopPropagation(); const b = e.target.closest("button"); if (b) done(+b.dataset.i < 0 ? null : opts[+b.dataset.i].v); else if (e.target === o) done(null); });
    (typeof dlg !== "undefined" && dlg.open ? dlg : document.body).appendChild(o);
  });
}

// Android uygulaması (Capacitor) içinde çalışırken: paylaşım bağlantıları canlı siteye gider, tarayıcı hissi kapatılır.
const NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const SITE = NATIVE ? "https://butceapp.lovable.app" : location.origin;
if (NATIVE) document.documentElement.classList.add("native");
// Havadan güncelleme: açılışta ve Ayarlar'dan elle; yeni paket varsa indirip hemen uygular (uygulama yenilenir).
const OTA = { cur: null };
async function otaCheck(manual) {
  const U = NATIVE && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorUpdater;
  if (!U) return { s: "na" };
  let step = "sürüm";
  try {
    try { const cur = await U.current(); OTA.cur = (cur.bundle && cur.bundle.version) || "builtin"; } catch (e) { OTA.cur = OTA.cur || "builtin"; }
    step = "bilgi";
    const u = SITE + "/ota/latest.json?t=" + Date.now();
    const H = window.Capacitor.Plugins.CapacitorHttp;
    let latest = null, why = "";
    if (H && H.get) { try { const r = await H.get({ url: u, headers: { "Cache-Control": "no-cache" } });
      if (r.status === 200) latest = typeof r.data === "string" ? JSON.parse(r.data) : r.data; else why = "HTTP " + r.status; } catch (e) { why = String(e && e.message || e); } }
    if (!latest) { try { const r = await fetch(u, { cache: "no-store" }); if (r.ok) latest = await r.json(); else why = "HTTP " + r.status; } catch (e) { why = why || String(e && e.message || e); } }
    if (!latest) return { s: "err", d: why };
    if (!latest.version || OTA.cur === latest.version) return { s: "ok" };
    if (manual) toast("Yeni sürüm indiriliyor…");
    step = "indirme";
    const list = await U.list();
    let b = (list.bundles || []).find(x => x.version === latest.version && x.status !== "error");
    if (!b) b = await U.download({ url: SITE + latest.url, version: latest.version });
    step = "kurulum";
    await U.set({ id: b.id }); // uygulamayı yeni sürümle hemen yeniden yükler
    return { s: "upd" };
  } catch (e) { console.warn("OTA", e); return { s: "err", d: step + ": " + String(e && e.message || e) }; }
}
if (NATIVE) (async () => {
  const U = window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorUpdater;
  if (!U) return;
  try { await U.notifyAppReady(); } catch (e) {}
  otaCheck(false);
  // Uygulama arka plandan öne gelince de kontrol et
  const A = window.Capacitor.Plugins.App;
  if (A && A.addListener) A.addListener("appStateChange", st => { if (st && st.isActive) otaCheck(false); });
})();
/* ============ utilities ============ */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const nf2 = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
const nfp = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const f2 = n => nf2.format(n || 0), f0 = n => nf0.format(Math.round(n || 0));
const amtIn = n => (n == null || n === "" || isNaN(n)) ? "" : nfp.format(n).replace(/,00$/, "");
const today = () => C.ymd(new Date());
const CUR = () => today().slice(0, 7);
const mLabel = m => { const [y, mo] = m.split("-").map(Number); return C.TR_M[mo - 1] + " " + y; };
const mShort = m => { const [y, mo] = m.split("-").map(Number); return C.TR_M[mo - 1] + " '" + String(y).slice(2); };
const dLabel = d => { const [y, m, dd] = d.split("-").map(Number); const dt = new Date(y, m - 1, dd); return dd + " " + C.TR_M[m - 1] + " " + dt.toLocaleDateString("tr-TR", { weekday: "long" }); };
const ICON = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/></svg>',
  card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19M6.5 15h4"/></svg>',
  table: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3.5" width="18" height="17" rx="1.5"/><path d="M3 9h18M3 14.5h18M9 3.5v17"/></svg>',
  wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3"/><rect x="4" y="8" width="16.5" height="11" rx="2"/><circle cx="16.5" cy="13.5" r="1"/></svg>',
  tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 12.3V4.5a1 1 0 0 1 1-1h7.8l8.2 8.2a1.5 1.5 0 0 1 0 2.1l-6.1 6.1a1.5 1.5 0 0 1-2.1 0z"/><circle cx="8" cy="8" r="1.3"/></svg>',
  trend: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10" width="15" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="3.5"/><path d="M4.5 20c.8-4 3.9-6 7.5-6s6.7 2 7.5 6"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeoff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4l16 16M9.9 5.9A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.3 4M6.6 7.9A17 17 0 0 0 2.5 12S6 18.5 12 18.5c1 0 1.9-.2 2.7-.5"/></svg>',
  pie: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 9 9h-9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/></svg>',
  pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  l: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  r: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>',
  g: '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="#4285F4" d="M22.5 12.2c0-.8-.1-1.4-.2-2H12v3.9h5.9c-.1 1-.8 2.5-2.3 3.5l3.6 2.7c2.1-2 3.3-4.9 3.3-8.1z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8C3.9 20.6 7.6 23 12 23z"/><path fill="#FBBC05" d="M5.8 14.2c-.2-.7-.4-1.4-.4-2.2s.1-1.5.4-2.2V7H2.1C1.4 8.5 1 10.2 1 12s.4 3.5 1.1 5z"/><path fill="#EA4335" d="M12 5.4c1.6 0 2.8.7 3.4 1.3l2.6-2.5C16.5 2.8 14.4 2 12 2 7.6 2 3.9 4.4 2.1 8l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z"/></svg>'
};

let toastT;
function toast(msg) {
  let t = $(".toast"); if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
  t.textContent = msg; clearTimeout(toastT); toastT = setTimeout(() => t.remove(), 2600);
}

/* ============ data layer ============ */
// Data layer: Lovable Cloud (auth + database). See src/cloud-store/entry.ts.
async function loadCloudStore(onUser) {
  const { cloudStore } = await import("/cloud-store.js");
  return cloudStore(onUser, toast);
}
function authMsg(e) {
  const c = e && e.code || "";
  if (c.includes("popup-closed") || c.includes("cancelled")) return "";
    if (c.includes("network")) return "Bağlantı yok, tekrar deneyin.";
  return "Giriş yapılamadı (" + c + ").";
}

function mockStore(onUser) {
  const data = clone(window.__MOCK_SEED__ || { meta: null, months: {}, debts: {} });
  let h = null;
  const emit = () => setTimeout(() => { if (!h) return; h.meta(clone(data.meta)); h.months(clone(data.months), false); h.debts(clone(data.debts)); }, 0);
  const store = {
    kind: "mock", user: { email: "test@ornek.com", name: "Test" }, writes: 0,
    signIn() { }, signOut() { },
    listen(x) { h = x; emit(); },
    setMeta(m) { data.meta = clone(m); store.writes++; emit(); },
    setMonth(m, items) { if (items.length) data.months[m] = clone(items); else delete data.months[m]; store.writes++; emit(); },
    setDebt(id, d) { data.debts[id] = clone(d); store.writes++; emit(); },
    delDebt(id) { delete data.debts[id]; emit(); },
    setShare(t, d) { data.shares = data.shares || {}; data.shares[t] = clone(d); }, delShare(t) { if (data.shares) delete data.shares[t]; },
    async getShare(t) { return (data.shares || {})[t] || (window.__SHARE_SEED__ || null); },
    async bulk(ops) { ops.forEach(o => { const [c, id] = o.path; const tgt = c === "meta" ? null : c === "tx" ? data.months : data.debts; if (c === "meta") data.meta = o.op === "del" ? null : clone(o.data); else if (o.op === "del") delete tgt[id]; else tgt[id] = c === "tx" ? clone(o.data.items) : clone(o.data); }); store.writes += ops.length; emit(); }
  };
  window.__store = data;
  setTimeout(() => onUser(store.user), 0);
  return store;
}

/* ============ state ============ */
const DEFAULT_META = {
  accounts: [
    { id: "nakit", name: "Nakit", type: "nakit", color: "#0091ea", start: 0, exclude: false, hidden: false, order: 0 },
    { id: "banka", name: "Banka", type: "banka", color: "#43a047", start: 0, exclude: false, hidden: false, order: 1 },
    { id: "kart", name: "Kredi kartı", type: "kart", color: "#d50000", start: 0, exclude: true, hidden: false, order: 2 }
  ],
  categories: [
    { id: "c-araba", name: "Araba", parent: null, type: "E", color: "#6b7a5b" },
    { id: "c-ev", name: "Ev", parent: null, type: "E", color: "#84b17a" }, { id: "c-mutfak", name: "Mutfak", parent: "c-ev", type: "E", color: "#93a083" },
    { id: "c-aidat", name: "Aidat", parent: "c-ev", type: "E", color: "#6b7f8c" },
    { id: "c-kirtasiye", name: "Kırtasiye", parent: null, type: "E", color: "#8e6bb1" },
    { id: "c-ulasim", name: "Ulaşım", parent: null, type: "E", color: "#c98326" },
    { id: "c-toplu", name: "Toplu taşıma", parent: "c-ulasim", type: "E", color: "#d49a4a" }, { id: "c-taksi", name: "Taksi", parent: "c-ulasim", type: "E", color: "#b8862e" },
    { id: "c-ucak", name: "Uçak", parent: "c-ulasim", type: "E", color: "#a8742a" },
    { id: "c-maas", name: "Maaş", parent: null, type: "I", color: "#1d7f47" }, { id: "c-yatirim", name: "Yatırım", parent: null, type: "I", color: "#2b6cb0" }
  ]
};
const S = {
  store: null, user: null, authErr: "", meta: null, months: {}, debts: {}, loaded: { meta: false, months: false, debts: false },
  view: "home", month: CUR(), q: "", accF: "", year: Number(CUR().slice(0, 4)), tTab: "cat", tKind: "e", expanded: new Set(), onlyMine: false, borcMine: true,
  ver: 0, cache: null
};
S.accFs = []; S.per = "m"; S.showPastTx = true; S.showFutTx = false; S.showE = true; S.showI = true;
S.pFrom = CUR() + "-01"; S.pTo = today(); S.pCat = ""; S.catF = null; S.showPast = false;
const meta = () => S.meta || DEFAULT_META;
function derived() {
  if (S.cache && S.cache.ver === S.ver) return S.cache;
  const all = Object.values(S.months).flat();
  const catMap = Object.fromEntries(meta().categories.map(c => [c.id, c]));
  const accMap = Object.fromEntries(meta().accounts.map(a => [a.id, a]));
  const bal = C.accountBalances(meta().accounts, all);
  S.cache = { ver: S.ver, all, catMap, accMap, bal, payees: C.payeeMemory(all), favs: C.favourites(all, Date.now(), 40) };
  return S.cache;
}
const bump = () => { S.ver++; };
const catOf = id => derived().catMap[id];
function catLabel(id, short) {
  const c = catOf(id); if (!c) return "Kategorisiz";
  const p = c.parent ? catOf(c.parent) : null;
  return p && !short ? p.name + " › " + c.name : c.name;
}
const payName = t => (t.t || (t.k !== "tr" && t.cat ? catLabel(t.cat, true) : "")).trim();
function allPayees(k) { const m = new Map(); derived().all.forEach(t => { if (t.k === "tr" || (k && t.k !== k)) return; const n = payName(t); if (!n) return; const key = n.toLocaleLowerCase("tr"); const e = m.get(key) || { t: n, n: 0, a: 0, k: t.k }; e.n++; e.a += t.a; m.set(key, e); }); return [...m.values()].sort((a, b) => a.t.localeCompare(b.t, "tr")); }
const catColor = id => { const c = catOf(id); return c ? c.color : "#9a9fa3"; };
const accName = id => (derived().accMap[id] || {}).name || "Hesap yok";
const visibleAccs = () => meta().accounts.filter(a => !a.hidden).sort((a, b) => (a.order || 0) - (b.order || 0));
const monthItems = m => S.months[m] || [];
function saveMonth(m, items) { S.months[m] = items; if (!items.length) delete S.months[m]; bump(); return S.store.setMonth(m, items); }

/* ============ boot ============ */
async function boot() {
  const mock = new URLSearchParams(location.search).has("mock") || window.__MOCK_SEED__;
  const shareTok = new URLSearchParams(location.search).get("s");
  if (shareTok) {
    $("#root").innerHTML = '<div class="boot">Yükleniyor…</div>';
    try { const st = mock ? mockStore(() => { }) : await loadCloudStore(() => { }); S.share = await st.getShare(shareTok); S.shTab = "debt"; renderShare(); }
    catch (e) { console.error(e); $("#root").innerHTML = '<div class="boot">Paylaşılan sayfa açılamadı.</div>'; }
    return;
  }
  const VIEWS = ["home", "tx", "debt", "cash", "table", "pie", "inv", "acc", "cat", "pay", "subs"];
  const hv = location.hash.slice(1);
  if (VIEWS.includes(hv)) S.view = hv;
  addEventListener("hashchange", () => { const h = location.hash.slice(1); if (VIEWS.includes(h) && h !== S.view) { S.view = h; S.catF = null; S.payF = null; render(); window.scrollTo(0, 0); } });
  const onUser = (u, err) => {
    if (err !== undefined) { S.authErr = err; render(); return; }
    S.user = u;
    if (u) {
      S.loaded = { meta: false, months: false, debts: false };
      S.store.listen({
        meta: m => { S.meta = m; S.loaded.meta = true; bump(); render(); },
        months: (o) => { S.months = o; S.loaded.months = true; bump(); render(); if (!S._recDone && S.loaded.meta) { S._recDone = true; extendRecs(); } },
        debts: o => { S.debts = o; S.loaded.debts = true; render(); },
        err: e => { console.error(e); toast("Veri bağlantısı kesildi, tekrar deneniyor."); }
      });
    }
    render();
  };
  try { S.store = mock ? mockStore(onUser) : await loadCloudStore(onUser); }
  catch (e) { console.error(e); $("#root").innerHTML = '<div class="boot">Uygulama yüklenemedi. İnternet bağlantınızı kontrol edip sayfayı yenileyin.</div>'; }
}

/* ============ render ============ */
function render() {
  if (S.stmt && S.stmt.bank && S.months) try { stmtRun(); } catch (e) { console.error(e); }
  if (S.meta && S.meta.theme) applyTheme(S.meta.theme);
  const root = $("#root");
  if (!S.store) return;
  if (!S.user) {
    root.innerHTML = '<div class="login"><h1>Bütçe</h1><p class="muted">Harcamalarınız, hesaplarınız ve kredileriniz tek yerde.</p><button class="btn" data-act="signin">' + ICON.g + 'Google ile giriş yap</button>' + (S.authErr ? '<p class="neg small">' + esc(S.authErr) + '</p>' : '') + '</div>';
    return;
  }
  if (!S.loaded.months || !S.loaded.meta) { root.innerHTML = '<div class="boot">Veriler yükleniyor…</div>'; return; }
  const titles = { home: "Anasayfa", tx: "İşlemler", debt: "Borç takvimi", cash: "Nakit akışı", table: "Gider", pie: "Dağılım", inv: "Yatırımlar", acc: "Hesaplar", cat: "Kategoriler", pay: "Lehdarlar", subs: "Abonelikler" };
  const ctl = "";
  const body = { home: vHome, tx: vTx, debt: vDebt, cash: vCash, table: vTable, pie: vPie, inv: vInv, acc: vAcc, cat: vCat, pay: vPay, subs: vSubs }[S.view]();
  const scrollY = window.scrollY;
  const keep = root.dataset.view === S.view;
  root.dataset.view = S.view;
  const tw = document.querySelector(".tw"); const twScroll = tw ? [tw.scrollTop, tw.scrollLeft] : null;
  root.innerHTML =
    (navigator.onLine ? "" : '<div class="offline">Çevrimdışı: kayıtlar bağlantı gelince eşitlenecek.</div>') +
    '<header class="top"><div class="top-in"><div class="ttl"><div class="crumb">Bütçe <span>›</span> ' + titles[S.view] + '</div><h1>' + titles[S.view] + '</h1></div>' + ctl + '<button class="ib topset" data-act="settings" aria-label="Ayarlar">' + ICON.gear + '</button></div></header>' +
    '<main>' + (["cash", "tx", "pie"].includes(S.view) ? '<div class="narrow wide">' + body + '</div>' : body) + '</main>' +
    '<nav class="tabs" aria-label="Bölümler"><div class="nav-brand">' + LOGO + '</div>' +
    [["MENÜ"], ["home", "Anasayfa", ICON.home], ["tx", "İşlemler", ICON.list], ["ANALİZ"], ["table", "Gider", ICON.table], ["pie", "Dağılım", ICON.pie], ["inv", "Yatırımlar", ICON.trend, 1], ["ÖDEME"], ["debt", "Borç takvimi", ICON.card], ["cash", "Nakit akışı", ICON.trend], ["TANIMLAR"], ["acc", "Hesaplar", ICON.wallet], ["cat", "Kategoriler", ICON.tag], ["pay", "Lehdarlar", ICON.user]].map(([v, l, i, lk]) => l ? '<button data-act="nav" data-v="' + v + '" aria-current="' + (S.view === v ? "page" : "false") + '">' + i + l + (lk ? '<span class="lockb">' + ICON.lock + '</span>' : '') + '</button>' : '<div class="nav-sec">' + v + '</div>').join("") +
    '<div class="nav-foot"><button class="nav-new" data-act="add">' + ICON.plus + 'Yeni işlem</button><button data-act="nav" data-v="tx">' + ICON.search + 'Ara</button><button data-act="acct">' + ICON.user + '<span class="nfn">' + esc((S.user && (S.user.name || S.user.email)) || "Hesabım") + '</span></button><button data-act="settings">' + ICON.gear + 'Ayarlar</button></div>' +
    '</nav>' +
    mbar() +
    (S.view === "home" || S.view === "tx" ? '<button class="fab" data-act="add" aria-label="İşlem ekle">' + ICON.plus + '</button>' : '');
  scheduleShare();
  if (keep) { window.scrollTo(0, scrollY); const t2 = document.querySelector(".tw"); if (t2 && twScroll) { t2.scrollTop = twScroll[0]; t2.scrollLeft = twScroll[1]; } }
  if (S._toCur || (!keep && (S.view === "table" || S.view === "debt"))) { S._toCur = false; const t2 = document.querySelector(".tw"); const r = t2 && t2.querySelector("tr.cur"); if (r) t2.scrollTop = Math.max(0, r.offsetTop - t2.clientHeight / 2); }
  afterRender();
}
const ANA = [["table", "Gider", ICON.table], ["pie", "Dağılım", ICON.pie], ["inv", "Yatırımlar", ICON.trend, 1]];
const PAY = [["debt", "Borç takvimi", ICON.card], ["cash", "Nakit akışı", ICON.trend]];
const TAN = [["acc", "Hesaplar", ICON.wallet], ["cat", "Kategoriler", ICON.tag], ["pay", "Lehdarlar", ICON.user]];
function mbar() {
  const inA = ANA.some(([v]) => v === S.view), inP = PAY.some(([v]) => v === S.view), inT = TAN.some(([v]) => v === S.view), op = S.bub;
  const bub = (list, cls) => '<div class="bubs ' + cls + '">' + list.map(([v, l, i], k) => '<button class="bub" data-act="nav" data-v="' + v + '" style="--k:' + k + '"' + (S.view === v ? ' aria-current="page"' : '') + '><span class="bi">' + i + '</span><span class="bl">' + l + '</span></button>').join("") + '</div>';
  return '<div class="mbar' + (op ? " open" : "") + '">' + (op ? '<button class="scrim" data-act="bub" data-v="" aria-label="Kapat"></button>' + bub(op === "ana" ? ANA : op === "pay" ? PAY : TAN, op) : '') +
    '<nav class="mnav" aria-label="Bölümler">' +
    '<button data-act="nav" data-v="home" aria-current="' + (S.view === "home" ? "page" : "false") + '">' + ICON.home + 'Anasayfa</button>' +
    '<button data-act="nav" data-v="tx" aria-current="' + (S.view === "tx" ? "page" : "false") + '">' + ICON.list + 'İşlemler</button>' +
    '<button class="mx ' + (op === "ana" ? "on" : "") + '" data-act="bub" data-v="ana" aria-current="' + (inA ? "page" : "false") + '">' + (op === "ana" ? ICON.x : ICON.pie) + 'Analiz</button>' +
    '<button class="mx ' + (op === "pay" ? "on" : "") + '" data-act="bub" data-v="pay" aria-current="' + (inP ? "page" : "false") + '">' + (op === "pay" ? ICON.x : ICON.card) + 'Ödeme</button>' +
    '<button class="mx ' + (op === "tan" ? "on" : "") + '" data-act="bub" data-v="tan" aria-current="' + (inT ? "page" : "false") + '">' + (op === "tan" ? ICON.x : ICON.tag) + 'Tanımlar</button>' +
    '</nav></div>';
}
const monthBar = () => '<div class="monthbar"><button class="ib" data-act="mprev" aria-label="Önceki ay">' + ICON.l + '</button><span class="l">' + mLabel(S.month) + '</span><button class="ib" data-act="mnext" aria-label="Sonraki ay">' + ICON.r + '</button></div>';

const svgI = p => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';
const CI = {
  cart: '<path d="M3 4h2l2.2 10.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.4-1.1L20.5 8H6.2"/><circle cx="9.5" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/>',
  car: '<path d="M5 16v-4.5L6.8 7a2 2 0 0 1 1.9-1.3h6.6A2 2 0 0 1 17.2 7l1.8 4.5V16M4 16h16v2.5H4zM5 11.5h14"/>',
  home: '<path d="M4 11 12 4.5 20 11M6 9.5V20h12V9.5M10 20v-5h4v5"/>',
  bolt: '<path d="M13 3 5.5 13.5H12L11 21l7.5-10.5H12z"/>',
  drop: '<path d="M12 3.5s-6 6.6-6 10.7a6 6 0 0 0 12 0C18 10.1 12 3.5 12 3.5z"/>',
  flame: '<path d="M12 21a6 6 0 0 0 6-6c0-3.5-2.5-5.5-3.5-8.5-2 1.5-3 3.5-3 5.5-1-.8-1.7-2-2-3.2C8 10.2 6 12.5 6 15a6 6 0 0 0 6 6z"/>',
  wifi: '<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.3a9.5 9.5 0 0 1 13 0M8.6 15.6a5 5 0 0 1 6.8 0"/><circle cx="12" cy="19" r=".9"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.2"/><path d="M11 18.5h2"/>',
  tv: '<rect x="3" y="5" width="18" height="12" rx="1.8"/><path d="M8 21h8M12 17v4"/>',
  health: '<path d="M12 20.5s-8-4.6-8-10.4A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 8 2.5c0 5.8-8 10.4-8 10.4zM12 10.5v5M9.5 13h5"/>',
  music: '<path d="M9 18V5.5l10-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  people: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3 20c.6-3.4 3-5.5 6-5.5s5.4 2.1 6 5.5M16 5.6a3 3 0 0 1 0 5.8M17.5 14.8c1.8.7 3.1 2.6 3.5 5.2"/>',
  gift: '<rect x="3.5" y="8.5" width="17" height="4" rx="1"/><path d="M5 12.5V20h14v-7.5M12 8.5V20M12 8.5C10.5 5 7 5 7 7s3 1.5 5 1.5 5 .5 5-1.5-3.5-1.5-5 1.5z"/>',
  card: '<rect x="2.5" y="5.5" width="19" height="13" rx="2"/><path d="M2.5 10h19M6.5 15h4"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="M14.5 8.8c-.6-.8-1.5-1.1-2.6-1.1-1.5 0-2.6.8-2.6 2s1 1.7 2.7 2.1 2.8 1 2.8 2.3-1.2 2.1-2.8 2.1c-1.2 0-2.2-.4-2.8-1.2M12 6v1.7M12 16.3V18"/>',
  laptop: '<rect x="4.5" y="5" width="15" height="10" rx="1.5"/><path d="M2.5 19h19"/>',
  bag: '<path d="M5.5 8h13l-1 12.5h-11zM9 10V6.5a3 3 0 0 1 6 0V10"/>',
  bus: '<rect x="5" y="3.5" width="14" height="14" rx="2.5"/><path d="M5 11h14M8.5 20.5v-3M15.5 20.5v-3"/>',
  food: '<path d="M7 3.5v7a2 2 0 0 0 2 2v8M5 3.5v5M9 3.5v5M16.5 20.5V3.5c-2 1-3.5 3.5-3.5 7h3.5"/>',
  smoke: '<path d="M3 15.5h13v3H3zM18.5 15.5v3M21 15.5v3M18.5 12c0-1.5 2.5-1.5 2.5-3.5s-2-2.5-2-4"/>',
  book: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"/>',
  swap: '<path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5"/>',
  tag: '<path d="M3.5 12.3V4.5a1 1 0 0 1 1-1h7.8l8.2 8.2a1.5 1.5 0 0 1 0 2.1l-6.1 6.1a1.5 1.5 0 0 1-2.1 0z"/><circle cx="8" cy="8" r="1.3"/>',
  game: '<rect x="2.5" y="7" width="19" height="10" rx="5"/><path d="M7 10.5v3M5.5 12h3"/><circle cx="16" cy="11" r=".8"/><circle cx="18" cy="13" r=".8"/>',
  coffee: '<path d="M4 8h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM16 9.5h1.5a2.5 2.5 0 0 1 0 5H16M7 3.5v2M10 3.5v2M13 3.5v2"/>',
  paw: '<circle cx="8" cy="8" r="1.8"/><circle cx="16" cy="8" r="1.8"/><circle cx="5" cy="12.5" r="1.6"/><circle cx="19" cy="12.5" r="1.6"/><path d="M12 12c-3 0-5 3.5-5 5.5 0 1.5 1.3 2 2.5 2 1 0 1.6-.6 2.5-.6s1.5.6 2.5.6c1.2 0 2.5-.5 2.5-2 0-2-2-5.5-5-5.5z"/>',
  sport: '<path d="M3 12h2M19 12h2M6 8v8M18 8v8M8 10v4M16 10v4M8 12h8"/>',
  plane: '<path d="M10.5 13.5 3 11l1.5-1.5 7.5.5L16 5.5a2 2 0 0 1 3 3L14.5 13l.5 7.5-1.5 1.5-2.5-7.5"/>',
  shirt: '<path d="M8 4 3.5 6.5l2 4L7 9.8V20h10V9.8l1.5.7 2-4L16 4c-.5 1.5-2 2.5-4 2.5S8.5 5.5 8 4z"/>'
};
const CI_MAP = [["bolt", ["elektrik", "fatura"]], ["drop", ["=su"]], ["flame", ["doğalgaz"]], ["wifi", ["internet"]], ["phone", ["telefon"]], ["tv", ["digitürk", "netflix", "dizi"]], ["music", ["spotify", "müzik"]], ["cart", ["mutfak", "market"]], ["food", ["yiyecek", "hazır", "yemek", "restoran", "kafe"]], ["car", ["benzin", "araba", "otopark", "hgs", "yıkama", "tamir", "aksesuar", "ceza", "resmi"]], ["bus", ["ulaşım", "taksi", "otobüs"]], ["home", ["=ev", "aidat", "kira", "eşya", "tadilat", "çeyiz"]], ["health", ["sağlık", "hastane", "ilaç", "eczane"]], ["gift", ["hediye", "hatun", "evlilik"]], ["people", ["dost", "sosyal", "arkadaş", "etkinlik", "aile"]], ["card", ["borç", "kredi", "kyk", "ücret"]], ["coin", ["maaş", "faiz", "gelir", "yatırım", "borsa", "fon", "nakit"]], ["laptop", ["teknoloji", "donanım", "yazılım"]], ["bag", ["alışveriş", "giyim", "lego"]], ["smoke", ["sigara", "alkol", "bad things"]], ["book", ["kırtasiye", "eğitim", "kitap"]]];
function catIcon(id) {
  const c = catOf(id); if (!c) return svgI(CI.tag);
  if (c.img) return '<img src="' + c.img + '" alt="">';
  if (c.icon && CI[c.icon]) return svgI(CI[c.icon]);
  const p = c.parent ? catOf(c.parent) : null;
  for (const nm of [c.name, p && p.name]) { if (!nm) continue; const n = nm.toLocaleLowerCase("tr");
    for (const [k, kws] of CI_MAP) if (kws.some(w => w[0] === "=" ? n === w.slice(1) : n.includes(w))) return svgI(CI[k]); }
  return svgI(CI.tag);
}
function txRow(t, m) {
  const fut = t.d > today();
  let title, sub, amt, cls, color;
  const spc = t.sp && t.sp.length ? t.sp.slice().sort((x, y) => y.a - x.a)[0].cat : t.cat;
  if (t.k === "tr") {
    title = t.t || "Transfer"; sub = accName(t.acc) + " → " + accName(t.to); amt = f2(t.a); cls = "muted"; color = "var(--tr)";
  } else {
    const sp = t.sp && t.sp.length ? t.sp.slice().sort((x, y) => y.a - x.a) : null;
    title = t.t || (sp ? sp.map(x => catLabel(x.cat, true)).join(" + ") : catLabel(t.cat, true));
    sub = sp ? "(" + sp.map(x => f0(x.a) + " × " + catLabel(x.cat, true)).join(", ") + ") " + accName(t.acc)
      : (t.t ? catLabel(t.cat) + ", " : (catOf(t.cat) && catOf(t.cat).parent ? catLabel(t.cat) + ", " : "")) + accName(t.acc);
    amt = (t.k === "e" ? "-" : "+") + f2(t.a); cls = t.k === "e" ? "neg" : "pos"; color = catColor(spc);
  }
  if (t.ins) sub += ", taksit " + t.ins;
  if (t.n) sub += ", " + t.n;
  return '<li><button class="tx' + (fut ? " future" : "") + (S.sel && S.sel[t.id] ? " picked" : "") + '" data-act="edit-tx" data-id="' + esc(t.id) + '" data-m="' + (m || t.d.slice(0, 7)) + '"><span class="cic" style="--c:' + color + '">' + (t.k === "tr" ? svgI(CI.swap) : catIcon(spc)) + '</span><span class="m"><span class="t">' + esc(title) + '</span><span class="s">' + (((derived().accMap[t.acc] || {}).logo) ? '<img class="alogo xs" src="' + esc(derived().accMap[t.acc].logo) + '" alt="">' : '') + esc(sub) + '</span></span><span class="a ' + cls + '">' + amt + '</span></button></li>';
}

const LOGO = '<span class="lgw"><img class="lgi" src="/icons/icon-192.png" alt=""><span class="lgt">Bütçe</span></span>';
const shortN = v => { const a = Math.abs(v), sg = v < 0 ? "-" : ""; return a >= 1e6 ? sg + (a / 1e6).toFixed(1).replace(".", ",") + "M" : a >= 1e3 ? sg + Math.round(a / 1e3) + "B" : sg + Math.round(a); };
function smoothPath(pts) {
  if (!pts.length) return "";
  let d = "M" + pts[0][0].toFixed(1) + " " + pts[0][1].toFixed(1);
  for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const lo = Math.min(p1[1], p2[1]), hi = Math.max(p1[1], p2[1]), cl = v => Math.min(hi, Math.max(lo, v));
    d += " C" + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + " " + cl(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) + " " + (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + " " + cl(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) + " " + p2[0].toFixed(1) + " " + p2[1].toFixed(1); }
  return d;
}
const CH = {}; let chSeq = 0;
function chartBox(kind, ...args) { const id = "c" + (++chSeq); CH[id] = { kind, args }; return '<div class="chartbox" data-cid="' + id + '"></div>'; }
function thinLabels(labels, xf, minGap) { let last = -1e9; const out = []; (labels || []).forEach(([i, t]) => { const xx = xf(i); if (xx - last >= minGap) { out.push([i, t, xx]); last = xx; } }); return out; }
function cumTips(a, b) { return a.map((v, i) => v == null ? "" : (i + 1) + ". gün: " + f0(v) + (b && b[i] != null ? " · önceki: " + f0(b[i]) : "")); }
function lineSvg(a, b, labels, W = 340, H = 170, tips) {
  const pr = W < 230 ? 34 : 46, pl = 6, pt = 10, pb = H < 90 ? 8 : 26, gn = H < 90 ? 2 : 3, n = Math.max(a.length, (b || []).length);
  const vals = a.concat(b || []).filter(v => v != null), lo = Math.min(0, ...vals), hi = Math.max(1, ...vals), rg = hi - lo || 1;
  const x = i => pl + (W - pl - pr) * (n > 1 ? i / (n - 1) : 0), y = v => pt + (H - pt - pb) * (1 - (v - lo) / rg);
  let g = ""; for (let k = 0; k <= gn; k++) { const v = lo + rg * k / gn, yy = y(v); g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + yy.toFixed(1) + '" y2="' + yy.toFixed(1) + '" class="gl"/><text x="' + (W - 4) + '" y="' + (yy + 4).toFixed(1) + '" text-anchor="end" class="ax">' + shortN(v) + '</text>'; }
  const pa = a.map((v, i) => v == null ? null : [x(i), y(v)]).filter(Boolean), pbb = (b || []).map((v, i) => v == null ? null : [x(i), y(v)]).filter(Boolean);
  const xl = pb < 20 ? "" : thinLabels(labels, x, 34).map(([i, t, xx]) => '<text x="' + xx.toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle" class="ax">' + t + '</text>').join("");
  return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' + g + (pbb.length ? '<path d="' + smoothPath(pbb) + '" class="ln2"/>' : '') + (pa.length ? '<path d="' + smoothPath(pa) + '" class="ln1"/>' : '') + xl + (tips ? (() => { const st = n > 1 ? (W - pl - pr) / (n - 1) : W; return tips.map((t, i) => '<rect x="' + Math.max(0, x(i) - st / 2).toFixed(1) + '" y="0" width="' + st.toFixed(1) + '" height="' + H + '" fill="transparent" class="bhit" data-tip="' + esc(t || "") + '"></rect>').join(""); })() : '') + '</svg>';
}
function barSvg(vals, labels, tips, W = 340, H = 150, hi = -1) {
  const pt = 8, pb = H < 90 ? 16 : 24, n = vals.length, mx = Math.max(1, ...vals), pl = 30, bw = (W - pl - 4) / n, gn = H < 90 ? 2 : 3;
  let g = ""; for (let k = 1; k <= gn; k++) { const v = mx * k / gn, yy = H - pb - (H - pt - pb) * k / gn; g += '<line x1="' + pl + '" x2="' + W + '" y1="' + yy.toFixed(1) + '" y2="' + yy.toFixed(1) + '" class="gl" stroke-dasharray="3 3"/><text x="' + (pl - 4) + '" y="' + (yy + 3).toFixed(1) + '" text-anchor="end" class="ax">' + shortN(v) + '</text>'; }
  const bars = vals.map((v, i) => { const h = (H - pt - pb) * v / mx; return '<rect x="' + (pl + i * bw).toFixed(1) + '" y="0" width="' + bw.toFixed(1) + '" height="' + (H - pb) + '" fill="transparent" class="bhit" data-tip="' + esc((tips && tips[i]) || "") + '"></rect><rect x="' + (pl + i * bw + bw * 0.18).toFixed(1) + '" y="' + (H - pb - h).toFixed(1) + '" width="' + (bw * 0.64).toFixed(1) + '" height="' + Math.max(v ? 2 : 0, h).toFixed(1) + '" rx="2" class="br' + (i === hi ? ' cur' : '') + '" pointer-events="none"/>'; }).join("") + g;
  const xl = thinLabels(labels, i => pl + i * bw + bw / 2, 8).map(([i, t, xx]) => '<text x="' + xx.toFixed(1) + '" y="' + (H - 3) + '" text-anchor="middle" class="ax">' + t + '</text>').join("");
  return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' + bars + '<line x1="0" x2="' + W + '" y1="' + (H - pb) + '" y2="' + (H - pb) + '" class="gl"/>' + xl + '</svg>';
}
function fillCharts() {
  document.querySelectorAll(".chartbox").forEach(b => { const c = CH[b.dataset.cid]; if (!c) return; const W = Math.floor(b.clientWidth), H = Math.floor(b.clientHeight);
    if (W < 40 || H < 40) { if (b.dataset.k) { b.dataset.k = ""; b.innerHTML = ""; } return; }
    const key = W + "x" + H; if (b.dataset.k === key) return; b.dataset.k = key;
    b.innerHTML = c.kind === "line" ? lineSvg(c.args[0], c.args[1], c.args[2], W, H, c.args[3]) : barSvg(c.args[0], c.args[1], c.args[2], W, H, c.args[3] == null ? -1 : c.args[3]); });
}
let chRO = null, chQ = 0;
function afterRender() {
  if (S.view === "acc") accDrag();
  if (typeof ResizeObserver === "undefined") { fillCharts(); return; }
  if (!chRO) chRO = new ResizeObserver(() => { if (chQ) return; chQ = requestAnimationFrame(() => { chQ = 0; fillCharts(); }); });
  chRO.disconnect(); document.querySelectorAll(".mod, .chartbox").forEach(el => chRO.observe(el));
  fillCharts();
}
function delta(cur, prev, goodDown) {
  if (!prev) return '<span class="dl muted">—</span>';
  const p = (cur - prev) / Math.abs(prev) * 100, up = p >= 0, good = goodDown ? !up : up;
  return '<span class="dl ' + (good ? "pos" : "neg") + '">' + (up ? "↑" : "↓") + " " + nfp.format(Math.abs(p)).replace(/,00$/, "") + '%</span>';
}
const MODS = [["exp", "Toplam gider", 1, 1], ["inc", "Toplam gelir", 1, 1], ["cash", "Nakit akışı", 1, 0], ["cats", "Dağılım", 1, 1], ["daily", "Günlük harcama", 1, 1], ["tips", "Öneri ve dikkat", 1, 1], ["debtcal", "Borç takvimi", 1, 0], ["fav", "Hızlı ekle", 1, 0], ["sub", "Abonelikler", 1, 0]];
const normW = v => v === 2 || v === "w" ? "w" : v === 0 || v === "s" ? "s" : "n";
const DG = { exp: [2, 2], inc: [2, 2], cash: [2, 2], cats: [2, 2], daily: [2, 2], tips: [2, 2], debtcal: [2, 3], recent: [2, 3], fav: [2, 1], sub: [2, 2] };
const clampN = (v, a, b) => Math.max(a, Math.min(b, Math.round(v)));
const normG = (g, id, w) => { const d = DG[id] || [2, 2]; const o = { w: clampN(g && +g.w || (w === "w" ? 4 : d[0]), 1, 6), h: clampN(g && +g.h || d[1], 1, 6) }; if (g && +g.x >= 1 && +g.y >= 1) { o.x = clampN(+g.x, 1, 6); o.y = clampN(+g.y, 1, 400); } return o; };
function packLayout(list, cols) {
  const placed = [], free = (x, y, w, h) => x >= 1 && y >= 1 && x + w - 1 <= cols && !placed.some(p => x < p.x + p.w && x + w > p.x && y < p.y + p.h && y + h > p.y);
  const out = {};
  list.forEach(it => { if (it.g.x && it.g.y) { const w = Math.min(it.g.w, cols), h = it.g.h; if (free(it.g.x, it.g.y, w, h)) { const q = { id: it.id, x: it.g.x, y: it.g.y, w, h }; placed.push(q); out[it.id] = q; } } });
  list.forEach(it => { if (out[it.id]) return; const w = Math.min(it.g.w, cols), h = it.g.h; let q = null;
    for (let y = 1; !q; y++) for (let x = 1; x + w - 1 <= cols; x++) if (free(x, y, w, h)) { q = { id: it.id, x, y, w, h }; break; }
    placed.push(q); out[it.id] = q; });
  return list.map(it => out[it.id]);
}
// Modül boy seçenekleri: [genişlik, yükseklik]; genişlik 2 = tüm satır (telefon), küçükten büyüğe.
const SZ = { debtcal: [[2, 1], [2, 2]], exp: [[1, 1]], inc: [[1, 1]], daily: [[1, 1], [2, 1]], cash: [[1, 1], [2, 1]], recent: [[1, 2], [2, 2]], cats: [[1, 1], [1, 2], [1, 3]], sub: [[1, 1], [1, 2]], tips: [[1, 1], [1, 2]], fav: [[1, 1], [1, 2]] };
const szOpts = id => SZ[id] || [[1, 1]];
const szNames = id => { const n = (SZ[id] || [[1, 1]]).length; return n === 1 ? ["Tek boy"] : n === 2 ? ["Küçük", "Büyük"] : ["Küçük", "Orta", "Büyük"]; };
// Herkes için varsayılan sıra (kayıt yokken ve "Varsayılana dön" sonrası kullanılır).
const DEF_DASH = { v: 3, items: [{ id: "cash", sz: 0, x: 5, y: 5 }, { id: "fav", sz: 0, x: 7, y: 6 }, { id: "tips", sz: 0, x: 7, y: 4 }, { id: "cats", sz: 2, x: 5, y: 1 }, { id: "daily", sz: 1, x: 1, y: 3 }, { id: "debtcal", sz: 1, x: 1, y: 5 }, { id: "sub", sz: 1, x: 7, y: 1 }, { id: "exp", sz: 0, x: 1, y: 1 }, { id: "inc", sz: 0, x: 3, y: 1 }].map(o => ({ ...o, on: true })) };
const dashMobile = () => !matchMedia("(min-width:900px)").matches;
const dashCols = () => dashMobile() ? (matchMedia("(max-width:359px)").matches ? 1 : 2) : 8;
const dashKey = () => dashMobile() ? "dashMobile" : "dash";
const dashCfg = () => { const mobile = dashMobile(), own = (S.dashEdit && S.dashDraft) || meta()[dashKey()], md = own || meta().dash || DEF_DASH;
  let saved = (md && md.items) || [];
  if (md.v !== 3) saved = saved.slice().sort((a, b) => ((a.g && a.g.y) || 99) - ((b.g && b.g.y) || 99) || ((a.g && a.g.x) || 0) - ((b.g && b.g.x) || 0));
  const out = MODS.map(([id, , , dyn]) => { const f = saved.find(x => x.id === id), opts = szOpts(id), sz = f && Number.isInteger(f.sz) ? clampN(f.sz, 0, opts.length - 1) : 0, [w, hh] = opts[sz];
    const px = !mobile && f && f.x >= 1 && f.y >= 1 ? { x: f.x, y: f.y } : {};
    return { id, on: f ? f.on !== false : ["exp", "inc", "cash", "cats", "daily", "debtcal", "fav"].includes(id), sz, dyn, ...px, g: { w: mobile ? (id === "fav" ? 2 : w) : w * 2, h: id === "fav" ? hh : hh === 1 ? 2 : (mobile ? hh * 2 : hh + 1), ...px } }; });
  if (saved.length) out.sort((a, b) => { const i = saved.findIndex(x => x.id === a.id), j = saved.findIndex(x => x.id === b.id); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j); });
  return out; };
const modName = id => (MODS.find(m => m[0] === id) || [, id])[1];
const mod = (ic, title, go, inner, cls) => '<section class="mod ' + (cls || "") + '"><div class="mod-h"' + (go ? ' data-act="mod-go" data-v="' + go + '" role="link" style="cursor:pointer"' : '') + '><span class="mod-ic">' + ic + '</span><h3>' + title + '</h3></div>' + inner + '</section>';
function vHome() {
  for (const k in CH) delete CH[k]; chSeq = 0;
  const D = derived(), m = S.hm || CUR(), pm = C.addM(m, -1), tdy = today(), isCur = m === CUR();
  const items = mm => monthItems(mm).filter(t => t.d <= tdy), cur = items(m), prev = items(pm);
  const sum = (arr, k) => arr.filter(t => t.k === k).reduce((s, t) => s + t.a, 0);
  const dm = C.daysIn(m), dp = C.daysIn(pm), lastDay = isCur ? Number(tdy.slice(8, 10)) : dm;
  const prevSame = prev.filter(t => Number(t.d.slice(8, 10)) <= lastDay);
  const te = sum(cur, "e"), ti = sum(cur, "i"), pe = sum(prevSame, "e"), pi = sum(prevSame, "i");
  const cum = (arr, k, days, upto) => { let c = 0; const out = []; for (let d = 1; d <= days; d++) { c += arr.filter(t => t.k === k && Number(t.d.slice(8, 10)) === d).reduce((s, t) => s + t.a, 0); out.push(d <= upto ? c : null); } return out; };
  const n = Math.max(dm, dp), lbl = [[0, "1"], [7, "8"], [14, "15"], [21, "22"], [n - 1, String(n)]];
  const leg = '<div class="legend"><span><i class="l1"></i>' + mLabel(m) + '</span><span><i class="l2"></i>' + mLabel(pm) + '</span></div>';
  const accsT = visibleAccs(), netT = accsT.filter(a => !a.exclude).reduce((s, a) => s + (D.bal[a.id] || 0), 0);
  const cfgM = dashCfg(), on = cfgM.filter(x => x.on);
  const M = {};
  M.exp = () => mod(svgI(CI.bag), "Toplam gider", "g:e", '<div class="mod-n inl"><b>' + f0(te) + '</b>' + delta(te, pe, true) + '</div>' + chartBox("line", cum(cur, "e", dm, lastDay), cum(prev, "e", dp, dp), lbl, cumTips(cum(cur, "e", dm, lastDay), cum(prev, "e", dp, dp))) + leg);
  M.inc = () => mod(svgI(CI.coin), "Toplam gelir", "g:i", '<div class="mod-n inl"><b>' + f0(ti) + '</b>' + delta(ti, pi) + '</div>' + chartBox("line", cum(cur, "i", dm, lastDay), cum(prev, "i", dp, dp), lbl, cumTips(cum(cur, "i", dm, lastDay), cum(prev, "i", dp, dp))) + leg);
  M.cash = () => { const pl = cashPlan(); return mod(svgI(CI.home), "Nakit akışı", "cash", '<div class="mod-n tr"><b class="' + (pl[0].kalan < 0 ? "neg" : "") + '">' + f0(pl[0].kalan) + '</b><span class="muted small">' + (salDay() > 1 ? salDay() + "'ine kadar" : "bu ay sonu") + '</span></div>' + chartBox("bar", pl.map(p => Math.max(0, p.kalan)), [[0, C.TR_M[Number(pl[0].m.slice(5)) - 1].slice(0, 3)], [3, C.TR_M[Number(pl[3].m.slice(5)) - 1].slice(0, 3)], [6, C.TR_M[Number(pl[6].m.slice(5)) - 1].slice(0, 3)], [9, C.TR_M[Number(pl[9].m.slice(5)) - 1].slice(0, 3)], [11, C.TR_M[Number(pl[11].m.slice(5)) - 1].slice(0, 3)]], pl.map(p => mLabel(p.m) + ": " + f2(p.kalan)), 0) ); };
  const tops = (arr) => { const o = {}; arr.filter(t => t.k === "e").forEach(t => catParts(t).forEach(pp => { const c = C.topCat(D.catMap, pp.cat); const k = c ? c.id : "_"; o[k] = (o[k] || 0) + pp.a; })); return o; };
  const tc = tops(cur), tp = tops(prev), rows = Object.entries(tc).sort((a, b) => b[1] - a[1]);
  M.cats = () => mod(svgI(CI.tag), "Dağılım", "pie", (rows.length ? '<div class="klist">' + rows.slice(0, 20).map(([id, v]) => '<button class="krow" data-act="' + (id === "_" ? "nav" : "cat-tx") + '" data-id="' + esc(id) + '" data-v="tx"><span class="cic kcic" style="--c:' + catColor(id === "_" ? null : id) + '">' + catIcon(id === "_" ? null : id) + '</span><span><b>' + esc(id === "_" ? "Kategorisiz" : catOf(id).name) + '</b><span class="muted small">%' + nfp.format(te ? v / te * 100 : 0).replace(/,00$/, "") + ' pay</span></span><span class="r"><b>' + f0(v) + '</b>' + delta(v, tp[id] || 0, true) + '</span></button>').join("") + '</div>' : '<div class="empty">Bu ay gider yok.</div>'));
  const curAll = monthItems(m), daily = []; for (let d = 1; d <= dm; d++) daily.push(curAll.filter(t => t.k === "e" && Number(t.d.slice(8, 10)) === d).reduce((s, t) => s + t.a, 0));
  M.daily = () => mod(svgI(CI.cart), "Günlük harcama", "g:e", '<div class="mod-n"><b>' + f0(isCur ? daily[lastDay - 1] || 0 : (lastDay ? te / lastDay : 0)) + '</b></div>' + chartBox("bar", daily, daily.map((_, i) => [i, String(i + 1)]).filter(([i]) => i % 2 === 0), daily.map((v, i) => (i + 1) + " " + C.TR_M[Number(m.slice(5)) - 1] + ": " + f2(v)), isCur ? lastDay - 1 : -1)).replace('class="chartbox"', 'class="chartbox" data-daym="' + m + '"');
  M.top = () => { const big = cur.filter(t => t.k === "e").sort((a, b) => b.a - a.a).slice(0, 20);
    return mod(svgI(CI.bag), "En büyük harcamalar", "tx", big.length ? '<div class="klist">' + big.map(t => '<button class="krow" data-act="edit-tx" data-id="' + esc(t.id) + '" data-m="' + t.d.slice(0, 7) + '"><span><b>' + esc(t.t || catLabel(t.cat, true)) + '</b><span class="muted small">' + dLabel(t.d) + '</span></span><span class="r"><b>' + f0(t.a) + '</b></span></button>').join("") + '</div>' : '<div class="empty">Bu ay gider yok.</div>'); };
  M.ratio = () => { const r = ti ? te / ti * 100 : 0, sav = ti - te;
    return mod(svgI(CI.coin), "Gelir-gider dengesi", null, '<div class="mod-n"><b class="' + (sav < 0 ? "neg" : "pos") + '">' + f0(sav) + '</b><span class="muted small">bu ay kalan</span></div><div class="ratiobar"><i style="width:' + Math.min(100, r).toFixed(1) + '%;background:' + (r > 100 ? "var(--exp)" : "var(--primary)") + '"></i></div><div class="legend" style="justify-content:space-between"><span>Gider gelirin %' + nfp.format(r).replace(/,00$/, "") + '\'i</span><span>' + f0(te) + ' / ' + f0(ti) + '</span></div>'); };
  M.sub = () => { const sr = subList().map(x => [x, x.items.filter(t => t.d.slice(0, 7) === m)]).filter(([, a]) => a.length), tot = sr.reduce((s, [, a]) => s + a.reduce((q, t) => q + t.a, 0), 0);
    return mod(svgI(CI.swap), "Abonelikler", "subs", '<div class="mod-n tr"><b>' + f0(tot) + '</b></div>' + (sr.length ? '<div class="klist">' + sr.slice(0, 20).map(([x, a]) => '<button class="krow" data-act="edit-tx" data-id="' + esc(a[0].id) + '" data-m="' + m + '"><span><b>' + esc(x.name) + '</b></span><span class="r"><b>' + f0(a.reduce((q, t) => q + t.a, 0)) + '</b></span></button>').join("") + '</div>' : '<div class="empty">Abonelik yok.</div>')); };
  M.tips = () => { const tips = [];
    const pl = cashPlan(), neg = pl.find(p => p.kalan < 0);
    if (neg) tips.push(["warn", "Nakit eksiye düşüyor", mLabel(neg.m) + " sonunda " + f2(neg.kalan) + ". Gelir ekleyin ya da gideri öne alın.", "cash"]);
    const payDue = debtCols().flatMap(([, d]) => (d.sched || []).filter(x => x.m === CUR() && !isPaid(d, x)).map(x => [d, x]));
    if (payDue.length) tips.push(["info", payDue.length + " ödeme bekliyor", "Bu ay toplam " + f2(payDue.reduce((s, [, x]) => s + x.a, 0)) + " ödenecek.", "debt"]);
    rows.slice(0, 3).forEach(([id, v]) => { const pv = tp[id] || 0; if (pv && v > pv * 1.4 && v - pv > 1000) tips.push(["warn", (id === "_" ? "Kategorisiz" : catOf(id).name) + " arttı", "Geçen aya göre " + f2(v - pv) + " fazla.", null]); });
    if (ti && te > ti) tips.push(["warn", "Gider geliri aştı", "Bu ay " + f2(te - ti) + " fazla harcama var.", "tx"]);
    const unc = cur.filter(t => t.k === "e" && !t.cat && !(t.sp && t.sp.length)).length;
    if (unc) tips.push(["info", unc + " işlem kategorisiz", "Kategori atarsanız raporlar daha doğru olur.", "tx"]);
    meta().accounts.filter(a => a.type === "kart" && a.cut && !a.hidden).forEach(a => { const r = stmtRange(a.cut), nd = (new Date(today()) - new Date(r[1])) / 864e5; if (nd >= 0 && nd <= 4) { const tot = derived().all.filter(t => t.acc === a.id && t.k === "e" && t.d >= r[0] && t.d <= r[1]).reduce((q, t) => q + t.a, 0); tips.unshift(["warn", a.name + " ekstresi kesildi", "Dönem toplamı " + f2(tot) + ". Kontrol için dokun.", "stmt:" + a.id]); } });
    { const pm = prevM(CUR()); if (+today().slice(8) <= 5 && !(meta().reportSeen || {})[pm] && derived().all.some(t => t.d.startsWith(pm))) tips.unshift(["info", mLabel(pm) + " raporu hazır", "Geçen aya göre değişimleri görmek için dokun.", "rep:" + pm]); }
    if (!tips.length) tips.push(["ok", "Her şey yolunda", "Dikkat çeken bir durum görünmüyor.", null]);
    return mod(svgI(CI.bolt), "Öneri ve dikkat", null, '<div class="tips">' + tips.slice(0, 8).map(([k, t, d, go]) => '<' + (go ? (go.startsWith("stmt:") ? 'button data-act="stmt" data-id="' + esc(go.slice(5)) + '"' : go.startsWith("rep:") ? 'button data-act="rep" data-m="' + esc(go.slice(4)) + '"' : 'button data-act="nav" data-v="' + go + '"') : 'div') + ' class="tip ' + k + '"><b>' + esc(t) + '</b><span class="muted small">' + esc(d) + '</span></' + (go ? 'button' : 'div') + '>').join("") + '</div>'); };
  const cols = debtCols();
  const cell = (d, mm) => (d.sched || []).filter(x => x.m === mm && !isPaid(d, x)).reduce((s, x) => s + x.a, 0);
  M.debtcal = x => { const nm = desk && x ? Math.max(6, 3 * Math.min(6, x.g.w)) : 6, hm = [...Array(nm)].map((_, i) => C.addM(CUR(), i)), gt = nm > 6 ? ' style="grid-template-columns:minmax(70px,1.3fr) repeat(' + nm + ',1fr)"' : '';
    const mxv = Math.max(1, ...cols.flatMap(([, d]) => hm.map(mm => cell(d, mm)))), tot6 = hm.map(mm => cols.reduce((s, [, d]) => s + cell(d, mm), 0));
    return mod(svgI(CI.card), "Borç takvimi", "debt", '<div class="mod-n tr"><b>' + f0(tot6[0]) + '</b><span class="muted small">bu ay</span></div><div class="heat"><div class="hrow hh"' + gt + '><span></span>' + hm.map(mm => '<span>' + C.TR_M[Number(mm.slice(5)) - 1].slice(0, 3) + '</span>').join("") + '</div><div class="hrow hs"' + gt + '><span>Toplam</span>' + tot6.map(v => '<span>' + shortN(v) + '</span>').join("") + '</div>' +
      cols.map(([id, d]) => '<div class="hrow"' + gt + '><span title="' + esc(d.name) + '">' + esc(d.name) + '</span>' + hm.map(mm => { const all = (d.sched || []).filter(x => x.m === mm).reduce((s, x) => s + x.a, 0), v = cell(d, mm); if (!all) return '<i style="opacity:0"></i>'; const pd = v < 0.005; return '<i class="bhit ' + (pd ? "pd" : "up") + '" data-tip="' + esc(d.name + ' · ' + mLabel(mm) + (pd ? " (ödendi)" : "") + ': ' + f2(all)) + '"' + (pd ? '' : ' style="opacity:' + (0.22 + 0.33 * v / mxv).toFixed(2) + '"') + '></i>'; }).join("") + '</div>').join("") + '</div>'); };
  M.accs = () => mod(svgI(CI.card), "Hesaplar", "acc", '<div class="mod-n"><b class="' + (netT < 0 ? "neg" : "") + '">' + f0(netT) + '</b><span class="muted small">net bakiye</span></div><div class="klist">' + accsT.map(a => '<button class="krow" data-act="acc-tx" data-id="' + esc(a.id) + '"><span><b>' + accIcon(a) + esc(a.name) + '</b></span><span class="r"><b class="' + ((D.bal[a.id] || 0) < 0 ? "neg" : "") + '">' + f2(D.bal[a.id] || 0) + '</b></span></button>').join("") + '</div>');
  M.recent = () => { const recent = D.all.filter(t => t.d <= tdy).sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 20);
    return mod(svgI(CI.tag), "Son işlemler", "tx", recent.length ? '<ul class="list">' + recent.map(t => txRow(t)).join("") + '</ul>' : '<div class="empty">Henüz işlem yok.</div>', "mod-pad"); };
  M.fav = () => { if (!D.favs.length) return ""; const big = ((cfgM.find(x => x.id === "fav") || {}).sz || 0) > 0, rows = big ? 2 : 1; let h = "";
    for (let r = 0; r < rows; r++) { const part = D.favs.slice(r * 5, r * 5 + 5); if (!part.length) break; h += '<div class="chips favchips" style="margin-top:6px">' + part.map((f, j) => '<button class="chip" data-act="fav" data-i="' + (r * 5 + j) + '"><i style="background:' + catColor(f.cat) + '"></i>' + esc(f.t || catLabel(f.cat, true)) + '</button>').join("") + '</div>'; }
    return mod(svgI(CI.bolt), "Hızlı ekle", null, h); };
  let h = '<section class="card accstrip"><div class="net"><span class="muted small">Net bakiye</span><b class="' + (netT < 0 ? "neg" : "") + '">' + f2(netT) + '</b></div><div class="accs">' + accsT.map(a => '<button class="acc" data-act="acc-tx" data-id="' + esc(a.id) + '"><div class="n">' + (a.logo ? '<img class="alogo sm" style="margin:0" src="' + esc(a.logo) + '" alt="" onerror="this.style.display=\'none\'">' : '<i style="background:' + a.color + '"></i>') + esc(a.name) + '</div><div class="v ' + ((D.bal[a.id] || 0) < 0 ? "neg" : "") + '">' + f2(D.bal[a.id] || 0) + '</div></button>').join("") + '</div></section>';
  const desk = !dashMobile(), gridCols = dashCols(), edit = !!S.dashEdit;
  const wrap = (x, out, pos) => { const cls = (edit ? "editing " : "") + (out.indexOf('class="mod-n"') < 0 ? "nn " : "");
    const attrs = 'data-id="' + x.id + '" data-x="' + pos.x + '" data-y="' + pos.y + '" data-w="' + pos.w + '" data-h="' + pos.h + '" style="--gx:' + pos.x + ';--gy:' + pos.y + ';--gw:' + pos.w + ';--gh:' + pos.h + '" ';
    let o = out.replace('<section class="mod ', '<section ' + (edit && desk ? 'draggable="true" ' : '') + attrs + 'class="mod ' + cls);
    if (edit) { const names = szNames(x.id); o = o.replace(/<\/section>$/, '<div class="ed-bar">' + (names.length > 1 ? '<button class="ed-b ed-sz" data-act="dg-sz" data-id="' + x.id + '">' + names[x.sz] + '</button>' : '') + '<button class="ed-b ed-rm" data-act="dg-hide" data-id="' + x.id + '" aria-label="Kaldır">' + ICON.x + '</button></div></section>'); }
    return o; };
  const section = list => { const rendered = list.map(x => [x, M[x.id] ? M[x.id](x) : ""]).filter(([, o]) => o);
    const lay = packLayout(rendered.map(([x]) => ({ id: x.id, g: { w: x.g.w, h: x.g.h, x: desk ? x.g.x : 0, y: desk ? x.g.y : 0 } })), gridCols);
    return rendered.map(([x, o], i) => wrap(x, o, lay[i])).join(""); };
  const hidden = cfgM.filter(x => !x.on);
  h += '<div class="toolbar dash-tb"><div class="pill"><button class="ib" data-act="hprev" aria-label="Önceki ay">' + ICON.l + '</button><span>' + mLabel(m) + '</span><button class="ib" data-act="hnext" aria-label="Sonraki ay">' + ICON.r + '</button></div><span style="flex:1"></span>' +
    (edit ? (desk ? '<button class="btn sm ghost" data-act="dg-tray">+ Modül ekle' + (hidden.length ? " (" + hidden.length + ")" : "") + '</button>' : '') + '<button class="btn sm ghost" data-act="dg-reset">Varsayılana dön</button><button class="btn sm ghost" data-act="dash-edit-cancel">Vazgeç</button><button class="btn sm" data-act="dash-edit-off">Bitti</button>'
      : '<button class="ib dash-pencil" data-act="dash-edit-on" aria-label="Modülleri düzenle" title="Modülleri düzenle">' + ICON.pen + '</button>') + '</div>';
  if (edit && !desk) { // telefonda kartların yerine sade bir liste
    const shown = on, up = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg>', dn = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
    h += '<div class="card dg-list">' + shown.map((x, i) => { const names = szNames(x.id);
      return '<div class="dg-row"><span class="dg-name">' + esc(modName(x.id)) + '</span>' + (names.length > 1 ? '<div class="seg dg-seg">' + names.map((nm, k) => '<button aria-pressed="' + (k === x.sz) + '" data-act="dg-sz" data-id="' + x.id + '" data-s="' + k + '">' + nm + '</button>').join("") + '</div>' : '<span class="dg-fixed muted small">Tek boy</span>') +
        '<button class="ib dg-b" data-act="dg-mv" data-id="' + x.id + '" data-d="-1" aria-label="Yukarı"' + (i ? '' : ' disabled') + '>' + up + '</button><button class="ib dg-b" data-act="dg-mv" data-id="' + x.id + '" data-d="1" aria-label="Aşağı"' + (i < shown.length - 1 ? '' : ' disabled') + '>' + dn + '</button><button class="ib dg-b dg-rm" data-act="dg-hide" data-id="' + x.id + '" aria-label="Kaldır">' + ICON.x + '</button></div>'; }).join("") +
      (hidden.length ? '<div class="dg-sub small muted">Gizli modüller</div><div class="chips">' + hidden.map(x => '<button class="chip" data-act="dg-add" data-id="' + x.id + '">+ ' + esc(modName(x.id)) + '</button>').join("") + '</div>' : '') + '</div>';
    return h; }
  if (edit) {
    if (S.dashTray) h += '<div class="card dg-tray">' + (hidden.length ? '<div class="chips">' + hidden.map(x => '<button class="chip" data-act="dg-add" data-id="' + x.id + '">+ ' + esc(modName(x.id)) + '</button>').join("") + '</div>' : '<span class="small muted">Tüm modüller açık.</span>') + '</div>'; }
  if (on.length) h += '<div class="mods manual-grid">' + section(on) + '</div>';
  return h;
}
function subList() {
  const g = {}; derived().all.filter(t => t.k === "e" && t.grp && !t.ins).forEach(t => (g[t.grp] = g[t.grp] || []).push(t));
  const recs = meta().recs || [];
  return Object.entries(g).map(([grp, items]) => { items.sort((a, b) => a.d.localeCompare(b.d)); const l = items[items.length - 1]; return { grp, items, name: l.t || catLabel(l.cat, true), cat: l.cat, open: recs.some(r => r.grp === grp) }; });
}
function vSubs() {
  const tdy = today(), cm = CUR(), L = subList().map(x => { const nx = x.items.find(t => t.d >= tdy), cur = x.items.filter(t => t.d.slice(0, 7) === cm), ref = nx || x.items[x.items.length - 1];
    return { ...x, nx, ref, mon: cur.length ? cur.reduce((s, t) => s + t.a, 0) : (nx ? nx.a : 0), paid: x.items.filter(t => t.d <= tdy).length, active: !!nx || x.open }; });
  const act = L.filter(x => x.active).sort((a, b) => b.mon - a.mon), old = L.filter(x => !x.active), mt = act.reduce((s, x) => s + x.mon, 0);
  const spent = L.reduce((s, x) => s + x.items.filter(t => t.d <= tdy && t.d.slice(0, 4) === tdy.slice(0, 4)).reduce((q, t) => q + t.a, 0), 0);
  const nxt = act.filter(x => x.nx).sort((a, b) => a.nx.d.localeCompare(b.nx.d))[0];
  let h = '<div class="kpis"><div class="card kpi"><span>Aylık toplam</span><b>' + f2(mt) + '</b></div><div class="card kpi"><span>Yıllık tahmini</span><b>' + f2(mt * 12) + '</b></div><div class="card kpi"><span>Bu yıl ödenen</span><b>' + f2(spent) + '</b></div><div class="card kpi"><span>Sıradaki ödeme</span><b>' + (nxt ? esc(nxt.name) : "—") + '</b>' + (nxt ? '<span class="small muted">' + dLabel(nxt.nx.d) + ' · ' + f2(nxt.nx.a) + '</span>' : '') + '</div></div>';
  const row = x => '<li><button class="set-row" data-act="edit-tx" data-id="' + esc(x.ref.id) + '" data-m="' + x.ref.d.slice(0, 7) + '"><span class="cic" style="--c:' + catColor(x.cat) + ';width:32px;height:32px">' + catIcon(x.cat) + '</span><span class="grow">' + esc(x.name) + '<span class="small muted" style="display:block">' + (x.nx ? "Sonraki: " + dLabel(x.nx.d) : "Son: " + dLabel(x.ref.d)) + ' · ' + x.paid + ' ödeme yapıldı</span></span><span><b>' + f2(x.mon || x.ref.a) + '</b><span class="small muted" style="display:block;text-align:right">/ay</span></span></button></li>';
  h += '<div class="sec-h" style="margin-top:18px"><h2>Aktif abonelikler (' + act.length + ')</h2><button class="btn sm" data-act="add-sub">Abonelik ekle</button></div>';
  h += act.length ? '<div class="card"><ul class="list">' + act.map(row).join("") + '</ul></div>' : '<div class="card empty">Aktif abonelik yok. Yeni işlemde "Abonelik" seçerek ekleyebilirsin.</div>';
  if (old.length) h += '<div class="sec-h" style="margin-top:18px"><h2>Biten abonelikler</h2></div><div class="card"><ul class="list">' + old.map(row).join("") + '</ul></div>';
  return h;
}
function vTx() {
  const D = derived();
  let items;
  const qs = S.q.trim().toLocaleLowerCase("tr"), qy = qs || ((S.catF || S.payF) ? "*" : "");
  if (S.catF) items = D.all.filter(t => catParts(t).some(pp => inCat(pp.cat, S.catF)));
  else if (S.payF) { const pf = S.payF.toLocaleLowerCase("tr"); items = D.all.filter(t => t.k !== "tr" && payName(t).toLocaleLowerCase("tr") === pf); }
  else if (qy) items = D.all.filter(t => ((t.t || "") + " " + (t.n || "") + " " + catLabel(t.cat) + " " + accName(t.acc)).toLocaleLowerCase("tr").includes(qs));

  else if (S.stmt) items = D.all.filter(t => t.d >= S.stmt.r[0] && t.d <= S.stmt.r[1]);
  else { const r = perRange(); items = D.all.filter(t => t.d >= r[0] && t.d <= r[1]); }
  if (S.stmt) return vStmt(items.filter(t => t.acc === S.stmt.acc && t.k === "e"));
  if (S.fYear) items = items.filter(t => Number(t.d.slice(0, 4)) === S.fYear);
  const tdy = today();
  if (!S.showPastTx) items = items.filter(t => t.d >= tdy);
  if (!S.showFutTx) items = items.filter(t => t.d <= tdy);
  if (!S.showE) items = items.filter(t => t.k !== "e");
  if (!S.showI) items = items.filter(t => t.k !== "i");
  if (S.accFs.length) items = items.filter(t => S.accFs.includes(t.acc) || (t.to && S.accFs.includes(t.to)));
  items.sort((a, b) => b.d.localeCompare(a.d) || (b.ts || 0) - (a.ts || 0));
  if (qy) items = items.slice(0, 300);
  const te = items.filter(t => t.k === "e").reduce((s, t) => s + t.a, 0), ti = items.filter(t => t.k === "i").reduce((s, t) => s + t.a, 0);
  const nPast = items.filter(t => t.d < tdy).length, nFut = items.filter(t => t.d > tdy).length;
  let h = '<div class="toolbar"><input class="search" type="search" placeholder="Ara: açıklama, kategori, not" value="' + esc(S.q) + '" data-in="q"><button class="sel accbtn" data-act="accf-open">' + (S.accFs.length ? S.accFs.length + " hesap" : "Tüm hesaplar") + ' ▾</button></div>';
  if (S.accOpen) h += '<div class="card" style="padding:10px 12px;margin-bottom:10px"><div class="chips">' + meta().accounts.map(a => '<button class="chip" data-act="accf-t" data-id="' + esc(a.id) + '" aria-pressed="' + S.accFs.includes(a.id) + '"><i style="background:' + a.color + '"></i>' + esc(a.name) + '</button>').join("") + (S.accFs.length ? '<button class="chip" data-act="accf-clear">Temizle ✕</button>' : '') + '</div></div>';
  if (!qs && !S.catF && !S.payF) h += '<div class="scroll-x" style="margin-bottom:10px">' + [["30", "Son 30 gün"], ["m", "Bu ay"], ["pm", "Geçen ay"], ["3", "Son 3 ay"], ["6", "Son 6 ay"], ["y", "Bu yıl"], ["all", "Tümü"]].map(([v, l]) => '<button class="chip" data-act="per" data-v="' + v + '" aria-pressed="' + (S.per === v) + '">' + l + '</button>').join("") + '</div>';
  h += '<div class="chips" style="margin-bottom:10px"><button class="chip" data-act="tgl-past" aria-pressed="' + S.showPastTx + '">Geçmiş</button><button class="chip" data-act="tgl-fut" aria-pressed="' + S.showFutTx + '">Gelecek</button><span style="flex:1"></span><button class="chip" data-act="tgl-e" aria-pressed="' + S.showE + '">Gider</button><button class="chip" data-act="tgl-i" aria-pressed="' + S.showI + '">Gelir</button></div>';
  if (S.catF || S.payF) h += '<div class="chips" style="margin-bottom:10px"><button class="chip" aria-pressed="true" data-act="catf-clear">' + esc(S.payF ? S.payF : catLabel(S.catF)) + (S.fYear ? " · " + S.fYear : "") + ' ✕</button></div>';
  h += '<div class="card"><div class="sum"><div>Gider<b class="neg">' + f2(te) + '</b></div><div>Gelir<b class="pos">' + f2(ti) + '</b></div><div>' + (qy ? "Sonuç" : "Fark") + '<b>' + (qy ? items.length : f2(ti - te)) + '</b></div></div></div>';
  if (!items.length) return h + '<div class="empty">' + "Eşleşen işlem yok." + '</div>';
  let day = null, out = "";
  for (const t of items) {
    if (t.d !== day) {
      if (day) out += '</ul></div>';
      day = t.d; const dt = items.filter(x => x.d === day && x.k === "e").reduce((s, x) => s + x.a, 0);
      out += '<div class="day"><span>' + dLabel(day) + (qy ? " " + day.slice(0, 4) : "") + (day > today() ? ", planlı" : "") + '</span><span>' + (dt ? "-" + f2(dt) : "") + '</span></div><div class="card"><ul class="list">';
    }
    out += txRow(t);
  }
  return h + out + '</ul></div>' + selBar();
}
function vStmt(items) {
  const st = S.stmt, a = meta().accounts.find(x => x.id === st.acc) || { name: "Kart" };
  items.sort((x, y) => y.d.localeCompare(x.d));
  const tot = items.reduce((q, t) => q + t.a, 0), R = st.res;
  let h = '<div class="toolbar"><button class="ib" data-act="stmt-per" data-v="-1" aria-label="Önceki ekstre">' + ICON.l + '</button><span style="flex:1;text-align:center"><b>' + esc(a.name) + '</b><br><span class="muted small">' + dLabel(st.r[0]) + ' – ' + dLabel(st.r[1]) + '</span></span><button class="ib" data-act="stmt-per" data-v="1" aria-label="Sonraki ekstre">' + ICON.r + '</button></div>';
  h += '<div class="card"><div class="sum"><div>Uygulamada<b class="neg">' + f2(tot) + '</b></div><div>Ekstre<b>' + (R ? f2(R.bankTot) : "–") + '</b></div><div>Fark<b>' + (R ? f2(R.bankTot - tot) : "–") + '</b></div></div></div>';
  h += '<div class="chips" style="margin:10px 0"><button class="btn sm" data-act="stmt-up">' + (st.busy ? "Okunuyor…" : R ? "Başka PDF yükle" : "Ekstre PDF yükle ve karşılaştır") + '</button><span style="flex:1"></span><button class="chip" data-act="stmt-close">Kapat ✕</button></div>';
  if (st.err) h += '<div class="empty">' + esc(st.err) + '</div>';
  const pk = st.pick;
  const tn = t => esc(t.t || catLabel(t.cat, true));
  const row = (b, t, kind, x) => '<li><div class="set-row"><span class="grow"><b>' + esc(b ? b.t || "İşlem" : tn(t)) + '</b><br><span class="muted small">' + dLabel((b || t).d) + (b && t && kind === "diff" ? " · uygulamada " + f2(t.a) : "") + (kind === "ok" && x ? " · " + (x.manual ? "elle · " : x.split ? "bölünmüş · " : "") + x.ts.map(q => tn(q) + " " + f2(q.a)).join(" + ") : "") + '</span></span><b style="white-space:nowrap">' + f2((b || t).a) + '</b>' +
    (kind === "miss" ? '<button class="btn sm ghost" data-act="stmt-pick" data-i="' + R.missing.indexOf(b) + '">Eşleştir</button><button class="btn sm" data-act="stmt-add" data-i="' + R.missing.indexOf(b) + '">Ekle</button>' : kind === "diff" ? '<button class="btn sm ghost" data-act="stmt-pick" data-di="' + R.diff.findIndex(y => y.b === b) + '">Eşleştir</button><button class="btn sm" data-act="stmt-fix" data-i="' + R.diff.findIndex(y => y.b === b) + '">Düzelt</button>' : kind === "extra" ? (pk ? '<input type="checkbox" class="stmt-ck" data-act="stmt-ck" data-id="' + esc(t.id) + '"' + (pk.ids.includes(t.id) ? ' checked' : '') + ' style="width:22px;height:22px">' : '<button class="btn sm" data-act="edit-tx" data-id="' + esc(t.id) + '" data-m="' + t.d.slice(0, 7) + '">Aç</button>') : kind === "ok" && x && x.manual ? '<button class="btn sm ghost" data-act="stmt-unlink" data-d="' + b.d + '" data-a="' + b.a + '">Ayır</button>' : '') + '</div></li>';
  const sec = (title, list, kind) => list.length ? '<div class="day"><span>' + title + '</span><span>' + list.length + '</span></div><div class="card"><ul class="list">' + list.map(x => kind === "miss" ? row(x, null, kind) : kind === "extra" ? row(null, x, kind) : row(x.b, x.t, kind, x)).join("") + '</ul></div>' : '';
  if (R) {
    if (pk) {
      const sum = R.extra.filter(t => pk.ids.includes(t.id)).reduce((q, t) => q + t.a, 0);
      h += '<div class="card" style="padding:12px"><b>' + esc(pk.b.t || "İşlem") + ' · ' + f2(pk.b.a) + '</b><br><span class="muted small">' + dLabel(pk.b.d) + ' — aşağıdan bu satıra ait işlemleri seç. Seçilen: ' + f2(sum) + (Math.abs(sum - pk.b.a) < 0.01 ? ' ✓' : ' (fark ' + f2(pk.b.a - sum) + ')') + '</span><div class="chips" style="margin-top:8px"><button class="btn sm ghost" data-act="stmt-pick-x">Vazgeç</button><button class="btn sm" data-act="stmt-link"' + (pk.ids.length ? '' : ' disabled') + '>Eşleştir</button></div></div>';
      h += sec("Uygulamada var, ekstrede yok", R.extra, "extra");
      if (!R.extra.length) h += '<div class="empty">Eşleştirilecek boşta işlem yok.</div>';
    } else {
      h += sec("Ekstrede var, uygulamada yok", R.missing, "miss") + sec("Tutarı farklı", R.diff, "diff") + sec("Uygulamada var, ekstrede yok", R.extra, "extra") + sec("Eşleşenler ✓", R.ok, "ok");
      if (!R.missing.length && !R.diff.length && !R.extra.length) h += '<div class="empty">Her şey eşleşiyor ✓</div>';
    }
  } else h += items.length ? '<div class="card"><ul class="list">' + items.map(txRow).join("") + '</ul></div>' : '<div class="empty">Bu dönemde işlem yok.</div>';
  return h;
}
function stmtRun() { const st = S.stmt; if (!st || !st.bank) return; const mine = derived().all.filter(t => t.acc === st.acc && t.k === "e" && t.d >= C.ymd(new Date(new Date(st.r[0]) - 3 * 864e5)) && t.d <= C.ymd(new Date(new Date(st.r[1]).getTime() + 3 * 864e5))); const inR = st.bank.filter(b => !b.credit); st.res = { ...reconcile(st.bank, mine, ((meta().stmtLinks || {})[st.acc]) || []), bankTot: inR.reduce((q, b) => q + b.a, 0) }; st.res.extra = st.res.extra.filter(t => t.d >= st.r[0] && t.d <= st.r[1]); if (st.pick) { const R = st.res, pb = st.pick.b; R.diff = R.diff.filter(x => { if (x.b.d === pb.d && x.b.a === pb.a && x.b.t === pb.t) { R.extra.push(x.t); return false; } return true; }); } }
function selBar() {
  if (!S.sel) return "";
  const ids = Object.keys(S.sel), all = derived().all, tot = ids.reduce((s, id) => { const t = all.find(x => x.id === id); return !t || t.k === "tr" ? s : s + (t.k === "e" ? -t.a : t.a); }, 0);
  return '<div class="selbar"><div class="selinfo"><b>' + ids.length + ' seçildi</b><span class="' + (tot < 0 ? "neg" : "pos") + '">Toplam: ' + (tot < 0 ? "-" : "") + f2(Math.abs(tot)) + '</span></div><button class="btn sm ghost" data-act="sel-x">Vazgeç</button><button class="btn sm" style="background:var(--exp);color:#fff" data-act="sel-del"' + (ids.length ? "" : " disabled") + '>Sil</button></div>';
}

/* ---- debts ---- */
function dueDate(d, m) { const [y, mo] = m.split("-").map(Number); return new Date(y, mo - 1, Math.min(d.day || 1, C.daysIn(m))); }
function isPaid(d, it) { if (it.p === true) return true; if (it.p === false) return false; const t = new Date(); return dueDate(d, it.m) < new Date(t.getFullYear(), t.getMonth(), t.getDate()); }
const debtKalan = d => C.r2((d.sched || []).reduce((s, it) => s + (isPaid(d, it) ? 0 : it.a), 0));
const debtTotal = d => C.r2((d.sched || []).reduce((s, it) => s + it.a, 0));
const debtTitle = d => d.name + " " + (d.kind === "kart" ? "kart" : "kredi");
const sortedDebts = () => Object.entries(S.debts).sort((a, b) => (a[1].order || 0) - (b[1].order || 0));

function cardSched(a) {
  const cut = a.cut || 31, due = a.due || 15, by = {};
  derived().all.forEach(t => { if (t.acc !== a.id) return; const v = t.k === "i" ? -t.a : t.a; const dd = Number(t.d.slice(8, 10));
    let m = t.d.slice(0, 7); if (dd > cut) m = C.addM(m, 1); if (due <= cut) m = C.addM(m, 1); by[m] = (by[m] || 0) + v; });
  const paid = a.paid || {};
  return Object.keys(by).sort().filter(m => C.r2(by[m]) > 0).map(m => { const o = { m, a: C.r2(by[m]) }; if (m in paid) o.p = paid[m]; return o; });
}
function debtCols() {
  const cards = meta().accounts.filter(a => a.type === "kart" && !a.hidden && !a.closed).sort((a, b) => (a.order || 0) - (b.order || 0))
    .map(a => [a.id, { src: "acc", name: a.name, kind: "kart", day: a.due || 15, principal: a.limit ?? null, total: null, rate: null, term: null, payoff: null, sched: cardSched(a) }]);
  return cards.concat(sortedDebts().filter(([, d]) => d.kind !== "kart" && !d.closed).map(([id, d]) => [id, { ...d, src: "debt" }]));
}
function vDebt() {
  const list = debtCols(), m = CUR();
  const kalan = list.reduce((s, [, d]) => s + debtKalan(d), 0);
  const buay = list.reduce((s, [, d]) => s + (d.sched || []).filter(it => it.m === m && !isPaid(d, it)).reduce((a, it) => a + it.a, 0), 0);
  let h = '<div class="kpis"><div class="card kpi"><span>Kalan borcum</span><b>' + f2(kalan) + '</b></div><div class="card kpi"><span>' + C.TR_M[Number(m.slice(5)) - 1] + ' ayında ödenecek</span><b>' + f2(buay) + '</b></div></div>';
  h += '<div class="toolbar" style="margin-top:14px"><span class="small muted" style="flex:1">Kredi kartları, Hesaplar’da kredi kartı olarak işaretlenen hesaplardan otomatik gelir.</span><button class="btn sm" data-act="new-debt">Kredi ekle</button></div>';
  if (!list.length) return h + '<div class="card empty">Henüz borç yok. "Kredi ekle" ile taksit takvimini oluşturun.</div>';
  return h + tDebt(list);
}
function gtDefault() {
  const ex = meta().categories.filter(c => c.type === "E");
  const find = n => { const l = n.toLocaleLowerCase("tr"); const m = ex.filter(c => c.name.toLocaleLowerCase("tr") === l); return (m.find(c => c.parent) || m[0] || {}).id; };
  return { g1: ["Benzin", "Mutfak", "Aidat", "Elektrik", "Su", "Doğalgaz", "İnternet", "Sosyal"].map(find).filter(Boolean), g2: ["Telefon", "Digitürk", "Spotify", "Amazon", "Warp"].map(find).filter(Boolean) };
}
const gtCfg = () => meta().gtable || gtDefault();
function vTable() {
  const ys = [...new Set(Object.keys(S.months).map(m => Number(m.slice(0, 4))))].sort(); if (!ys.includes(S.year)) ys.push(S.year);
  let h = '<div class="toolbar"><div class="chips">' + ys.map(y => '<button class="chip" data-act="year" data-v="' + y + '" aria-pressed="' + (y === S.year) + '">' + y + '</button>').join("") + '</div><span style="flex:1"></span><button class="btn sm" data-act="gt-edit">Sütunları seç</button></div>';
  return h + tCat();
}
function tCat() {
  const y = S.year, now = CUR(), cfg = gtCfg();
  const hid = cfg.hid || [];
  const cols = [...cfg.g1.filter(id => !hid.includes(id)).map(id => ({ id, g: "g1" })), { st: "g1" }, ...cfg.g2.filter(id => !hid.includes(id)).map(id => ({ id, g: "g2" })), { st: "g2" }].filter(c => !c.id || c.id.startsWith("p:") || catOf(c.id));
  if (!cfg.g1.length && !cfg.g2.length) return '<div class="card empty">Tabloda gösterilecek kategorileri "Sütunları seç" ile belirleyin.</div>';
  const ms = [...Array(12)].map((_, i) => y + "-" + C.pad(i + 1)), sel = new Set([...cfg.g1, ...cfg.g2].filter(id => !hid.includes(id))), sums = {};
  const pays = {}; [...sel].filter(x => x.startsWith("p:")).forEach(x => pays[x.slice(2).toLocaleLowerCase("tr")] = x);
  ms.forEach(m => { const o = sums[m] = {}; monthItems(m).forEach(t => { if (t.k !== "e") return; const pk = pays[payName(t).toLocaleLowerCase("tr")]; if (pk) o[pk] = (o[pk] || 0) + t.a;
    catParts(t).forEach(pp => { let c = catOf(pp.cat), g = 0; while (c && g++ < 5) { if (sel.has(c.id)) o[c.id] = (o[c.id] || 0) + pp.a; c = c.parent ? catOf(c.parent) : null; } }); }); });
  const grp = (m, g) => cfg[g].filter(id => !hid.includes(id)).reduce((s, id) => s + (sums[m][id] || 0), 0);
  const val = (m, c) => c.id ? (sums[m][c.id] || 0) : grp(m, c.st);
  const tot = m => grp(m, "g1") + grp(m, "g2");
  const done = ms.filter(m => m < now && tot(m) > 0), n = done.length || 1;
  let h = '<div class="tw"><table class="sh"><thead><tr><th>' + y + '</th>' + cols.map(c => c.id ? '<th class="click ' + c.g + '" data-act="gt-open" data-id="' + esc(c.id) + '" title="İşlemleri göster">' + esc(c.id.startsWith("p:") ? c.id.slice(2) : catOf(c.id).name) + '</th>' : '<th class="st ' + c.st + '">' + esc(cfg["n" + c.st.slice(1)] || "Ara toplam") + '</th>').join("") + '<th>Toplam</th></tr></thead><tbody>';
  ms.forEach(m => { const fut = m > now, has = tot(m) > 0;
    h += '<tr><td>' + C.TR_M[Number(m.slice(5)) - 1] + '</td>' + cols.map(c => '<td class="' + (c.id ? c.g : "st " + c.st) + (fut ? " fut" : "") + '">' + (has ? f0(val(m, c)) : "") + '</td>').join("") + '<td class="' + (fut ? "fut" : "") + '">' + (has ? f0(tot(m)) : "") + '</td></tr>'; });
  const sum = (c, set) => set.reduce((s, m) => s + val(m, c), 0);
  const fs = ' style="background:var(--c1)!important;color:var(--ink)!important"', fa = ' style="background:var(--c1)!important;color:var(--ink)!important;font-style:italic"';
  h += '</tbody><tfoot><tr><td' + fs + '>Toplam</td>' + cols.map(c => '<td class="' + (c.id ? c.g : "st " + c.st) + '"' + fs + '>' + f0(sum(c, ms)) + '</td>').join("") + '<td' + fs + '>' + f0(ms.reduce((s, m) => s + tot(m), 0)) + '</td></tr>';
  h += '<tr><td' + fa + '>Ortalama</td>' + cols.map(c => '<td class="' + (c.id ? c.g : "st " + c.st) + '"' + fa + '>' + f0(sum(c, done) / n) + '</td>').join("") + '<td' + fa + '>' + f0(done.reduce((s, m) => s + tot(m), 0) / n) + '</td></tr></tfoot></table></div>';
  return h + '<p class="small muted">Her grubun son sütunu o grubun toplamıdır. Ortalama, tamamlanmış ' + done.length + ' ay üzerinden.</p>';
}
function cashAmt(it, m) {
  if (it.rep === "once") return it.date && it.date.slice(0, 7) === m ? (it.amts[0] || {}).a || 0 : 0;
  if (!it.start || m < it.start || (it.end && m > it.end)) return 0;
  let a = 0, f = ""; (it.amts || []).forEach(x => { if (x.from <= m && x.from >= f) { f = x.from; a = x.a; } }); return a;
}
const salDay = () => Math.min(31, Math.max(1, parseInt(meta().salaryDay) || 1));
// Dönem anahtarı: maaş günü sd ise, "K" dönemi K ayının sd'si ile sonraki ayın sd-1'i arasıdır.
const cycKey = (m, day) => (day >= salDay() ? m : C.addM(m, -1));
function cycEnd(K) { const sd = salDay(); if (sd === 1) return K + "-" + String(C.daysIn(K)).padStart(2, "0"); const n = C.addM(K, 1); return n + "-" + String(Math.min(sd - 1, C.daysIn(n))).padStart(2, "0"); }
function cashPlan() {
  const tdy = today(), sd = salDay(), cm = cycKey(CUR(), Number(tdy.slice(8, 10))), Dd = derived();
  const accs = meta().accounts.filter(a => a.type !== "kart" && !a.exclude && !a.hidden), ids = new Set(accs.map(a => a.id));
  const bal = C.accountBalances(meta().accounts, Dd.all.filter(t => t.d <= tdy));
  let elde = C.r2(accs.reduce((s, a) => s + (bal[a.id] || 0), 0));
  const items = (meta().cash || {}).items || [], exd = (meta().cash || {}).exDebts || [], cols = debtCols().filter(([id]) => !exd.includes(id)), out = [];
  for (let i = 0; i < 12; i++) {
    const m = C.addM(cm, i), lines = [];
    const skip = (meta().cash || {}).skip || {};
    items.forEach(it => { const day = it.rep === "once" ? Number((it.date || "").slice(8, 10)) : (it.day || 1);
      const am = it.rep === "once" ? (it.date ? cycKey(it.date.slice(0, 7), day) === m ? it.date.slice(0, 7) : null : null) : (day >= sd ? m : C.addM(m, 1));
      if (!am) return; const a = cashAmt(it, am); if (!a) return;
      lines.push({ k: it.k === "inc" ? "+" : "-", n: it.name, a, day, id: it.id, on: !(it.skip || []).includes(m), ref: "ci|" + it.id + "|" + m }); });
    cols.forEach(([id, d]) => { (d.sched || []).forEach((x, xi) => { if (cycKey(x.m, d.day || 1) !== m || !(x.a > 0)) return; const pd = isPaid(d, x);
      lines.push({ k: "-", n: d.name + (d.kind === "kart" ? " ekstresi" : " taksiti"), a: C.r2(x.a), day: d.day || 1, debt: true, on: !pd, ref: "debt|" + id + "|" + d.src + "|" + xi }); }); });
    const plan = Dd.all.filter(t => cycKey(t.d.slice(0, 7), Number(t.d.slice(8, 10))) === m && t.d > tdy && t.k !== "tr" && ids.has(t.acc));
    const pi = plan.filter(t => t.k === "i").reduce((s, t) => s + t.a, 0), pe = plan.filter(t => t.k === "e").reduce((s, t) => s + t.a, 0);
    if (pi) lines.push({ k: "+", n: "Planlı gelir işlemleri", a: C.r2(pi), day: 0, on: !skip["pi|" + m], ref: "plan|pi|" + m }); if (pe) lines.push({ k: "-", n: "Planlı gider işlemleri", a: C.r2(pe), day: 0, on: !skip["pe|" + m], ref: "plan|pe|" + m });
    const ord = dd => (dd >= sd ? dd - sd : dd + 31);
    lines.sort((a, b) => (a.k === b.k ? 0 : a.k === "+" ? -1 : 1) || ord(a.day) - ord(b.day));
    const inc = lines.filter(l => l.k === "+" && l.on).reduce((s, l) => s + l.a, 0), exp = lines.filter(l => l.k === "-" && l.on).reduce((s, l) => s + l.a, 0);
    const kalan = C.r2(elde + inc - exp);
    out.push({ m, end: cycEnd(m), elde, inc: C.r2(inc), exp: C.r2(exp), kalan, lines }); elde = kalan;
  }
  return out;
}
const cycLabel = p => salDay() === 1 ? mLabel(p.m) : dLabel(p.end) + "’e kadar";
function vCash() {
  const pl = cashPlan(), items = (meta().cash || {}).items || [];
  const mx = Math.max(1, ...pl.map(p => Math.abs(p.kalan)));
  let h = '<p class="small muted" style="margin:0 0 10px">Önümüzdeki 12 ayın tahmini: her ay elimizde ne kalacak. Bir aya dokunun, o ayın gelir ve giderini görün.</p><div class="card cashbars">' + pl.map(p => '<button class="cb" data-act="cash-open" data-m="' + p.m + '" title="' + mLabel(p.m) + ': ' + f2(p.kalan) + '"><i style="height:' + Math.max(3, Math.abs(p.kalan) / mx * 100).toFixed(1) + '%;background:' + (p.kalan < 0 ? "var(--exp)" : "var(--primary)") + '"></i><span class="cbv">' + f0(p.kalan) + '</span><span>' + C.TR_M[Number(p.m.slice(5)) - 1].slice(0, 3) + '</span></button>').join("") + '</div>';
  h += '<div class="toolbar" style="margin-top:16px"><span style="flex:1"></span><button class="btn sm ghost" data-act="ci-new" data-k="inc">Gelir ekle</button><button class="btn sm" data-act="ci-new" data-k="exp">Gider ekle</button></div>';
  h += pl.map((p, i) => { const row = l => '<div class="crow' + (l.on ? '' : ' off') + '"><button class="ck' + (l.on ? '' : ' on') + '" data-act="cash-tick" data-ref="' + esc(l.ref) + '" aria-label="Gerçekleşti / gerçekleşmedi"></button><' + (l.id ? 'button data-act="ci-edit" data-id="' + esc(l.id) + '"' : 'span') + ' class="cl"><span>' + esc(l.n) + (l.day ? ' <span class="small muted">' + dayTxt(l.day) + '</span>' : '') + '</span><span class="' + (l.k === "+" ? "pos" : "") + '">' + f2(l.a) + '</span></' + (l.id ? 'button' : 'span') + '></div>'; const incL = p.lines.filter(l => l.k === "+"), expL = p.lines.filter(l => l.k === "-");
    return '<details class="card mcard" id="cm-' + p.m + '"' + (i === 0 || S.cashOpen === p.m ? " open" : "") + '><summary><span><b>' + cycLabel(p) + '</b><span class="small muted" style="display:block">Elde ' + f2(p.elde) + ', giriş ' + f2(p.inc) + ', çıkış ' + f2(p.exp) + '</span></span><b class="' + (p.kalan < 0 ? "neg" : "pos") + '">' + f2(p.kalan) + '</b></summary>' +
    '<div class="cash-cols"><div><div class="cash-colh">Gelir</div><div class="crow elde-row"><span>Elde</span><span>' + f2(p.elde) + '</span></div>' + (incL.length ? incL.map(row).join("") : '<div class="crow muted"><span>—</span></div>') + '</div><div><div class="cash-colh">Gider</div>' + (expL.length ? expL.map(row).join("") : '<div class="crow muted"><span>—</span></div>') + '</div></div>' +
    '<div class="crow tot"><span>Ay sonu kalan</span><span class="' + (p.kalan < 0 ? "neg" : "") + '">' + f2(p.kalan) + '</span></div></details>'; }).join("");
  if (items.length) h += '<div class="sec-h" style="margin-top:18px"><h2>Düzenli gelir ve giderler</h2></div><div class="card"><ul class="list">' + items.map(it => '<li><button class="set-row" data-act="ci-edit" data-id="' + esc(it.id) + '"><span class="cic" style="--c:' + (it.k === "inc" ? "var(--inc)" : "var(--exp)") + ';width:32px;height:32px">' + svgI(it.k === "inc" ? CI.coin : CI.bolt) + '</span><span class="grow">' + esc(it.name) + '<span class="small muted" style="display:block">' + (it.rep === "once" ? "Tek seferlik, " + it.date : "Her ay, " + dayTxt(it.day) + (it.end ? ", " + mLabel(it.end) + "’e kadar" : "")) + '</span></span><span class="' + (it.k === "inc" ? "pos" : "") + '">' + f2(cashAmt(it, it.rep === "once" ? it.date.slice(0, 7) : (CUR() < it.start ? it.start : CUR()))) + '</span></button></li>').join("") + '</ul></div>';
  return h + '<p class="small muted">Elde: kredi kartı dışındaki hesapların bugünkü bakiyesi. Bu ay için sadece henüz gerçekleşmemiş kalemler sayılır. Her ayın kalanı bir sonraki aya devreder; böylece ileriye dönük nakit akışınızın tamamını burada görürsünüz.</p>';
}
const BANKS = { ziraat: "ziraatbank.com.tr", garanti: "garantibbva.com.tr", akbank: "akbank.com", yapi: "yapikredi.com.tr", "yapı": "yapikredi.com.tr", kredi: "yapikredi.com.tr", isbank: "isbank.com.tr", "iş": "isbank.com.tr", vakif: "vakifbank.com.tr", "vakıf": "vakifbank.com.tr", halk: "halkbank.com.tr", qnb: "qnb.com.tr", finans: "qnb.com.tr", deniz: "denizbank.com", teb: "teb.com.tr", ing: "ing.com.tr", hsbc: "hsbc.com.tr", enpara: "enpara.com", papara: "papara.com", ininal: "ininal.com", paycell: "paycell.com.tr", "şeker": "sekerbank.com.tr", odeabank: "odeabank.com.tr", "kuveyt": "kuveytturk.com.tr", "albaraka": "albaraka.com.tr", "emlak": "emlakkatilim.com.tr", "fibabanka": "fibabanka.com.tr", "anadolu": "anadolubank.com.tr", "burgan": "burgan.com.tr", "alternatif": "alternatifbank.com.tr", "n kolay": "aktifbank.com.tr", "aktif": "aktifbank.com.tr" };
const logoUrl = dom => "https://www.google.com/s2/favicons?sz=128&domain=" + encodeURIComponent(dom);
function guessDomain(name) { const n = (name || "").toLocaleLowerCase("tr"); for (const k in BANKS) if (n.includes(k)) return BANKS[k]; return ""; }
const LOGO_DB = [["Ziraat Bankası", "ziraatbank.com.tr"], ["Garanti BBVA", "garantibbva.com.tr"], ["Akbank", "akbank.com"], ["Yapı Kredi", "yapikredi.com.tr"], ["İş Bankası", "isbank.com.tr"], ["VakıfBank", "vakifbank.com.tr"], ["Halkbank", "halkbank.com.tr"], ["QNB", "qnb.com.tr"], ["DenizBank", "denizbank.com"], ["TEB", "teb.com.tr"], ["ING", "ing.com.tr"], ["HSBC", "hsbc.com.tr"], ["Enpara", "enpara.com"], ["Papara", "papara.com"], ["ininal", "ininal.com"], ["Paycell", "paycell.com.tr"], ["Şekerbank", "sekerbank.com.tr"], ["Odeabank", "odeabank.com.tr"], ["Kuveyt Türk", "kuveytturk.com.tr"], ["Albaraka", "albaraka.com.tr"], ["Emlak Katılım", "emlakkatilim.com.tr"], ["Fibabanka", "fibabanka.com.tr"], ["Anadolubank", "anadolubank.com.tr"], ["Burgan", "burgan.com.tr"], ["Alternatif Bank", "alternatifbank.com.tr"], ["Aktif Bank / N Kolay", "aktifbank.com.tr"], ["Ziraat Katılım", "ziraatkatilim.com.tr"], ["Vakıf Katılım", "vakifkatilim.com.tr"], ["Türkiye Finans", "turkiyefinans.com.tr"], ["Midas", "getmidas.com"], ["Revolut", "revolut.com"], ["Wise", "wise.com"], ["PayPal", "paypal.com"], ["Binance", "binance.com"], ["BtcTurk", "btcturk.com"], ["Paribu", "paribu.com"], ["Tosla", "tosla.com"], ["Colendi", "colendi.com"]];
let lgT = null;
async function logoSearch(q) {
  const box = $("#lgres"); if (!box) return; q = (q || "").trim(); const ql = q.toLocaleLowerCase("tr");
  if (!q) { box.innerHTML = ""; return; }
  let res = LOGO_DB.filter(([n, d]) => n.toLocaleLowerCase("tr").includes(ql) || d.includes(ql)).map(([n, d]) => ({ n, d }));
  const draw = () => { box.innerHTML = res.length ? res.slice(0, 12).map(r => '<button class="lgopt" data-act="acc-logo" data-d="' + esc(r.d) + '" title="' + esc(r.d) + '"><img src="' + logoUrl(r.d) + '" alt=""><span>' + esc(r.n) + '</span></button>').join("") : '<span class="small muted">Sonuç yok. Kurumun site adresini yazabilirsiniz, örn. ornek.com</span>'; };
  if (/\.[a-z]{2,}/i.test(q) && !res.some(r => r.d === q)) res.unshift({ n: q, d: q.replace(/^https?:\/\//, "").replace(/\/.*$/, "") });
  draw();
  try { const r = await fetch("https://autocomplete.clearbit.com/v1/companies/suggest?query=" + encodeURIComponent(q)); if (r.ok) { const j = await r.json(); if ($("#lgq") && $("#lgq").value.trim() === q) { j.forEach(c => { if (c.domain && !res.some(x => x.d === c.domain)) res.push({ n: c.name, d: c.domain }); }); draw(); } } } catch (e) { }
}
function accIcon(a) { return a.logo ? '<img class="alogo" src="' + esc(a.logo) + '" alt="" onerror="this.style.display=\'none\'">' : '<i class="dotc" style="background:' + a.color + '"></i>'; }
const stripAct = h => (h || "").replace(/ data-act="[^"]*"/g, "");
function buildShare() {
  const yr = Number(CUR().slice(0, 4)), sy = S.year; S.year = yr;
  const g = { debt: stripAct(tDebt(debtCols())), cash: stripAct(vCash()), table: stripAct(tCat()), year: yr, ts: Date.now(), name: (S.user && S.user.name) || "" };
  S.year = sy; return g;
}
let shT = null, shLast = "", shNow = false;
function scheduleShare(now) {
  const sh = meta().share; if (!sh || !sh.token || !S.store || !S.store.setShare) return;
  if (!now && shNow) return; if (now) shNow = true;
  clearTimeout(shT); shT = setTimeout(() => { shNow = false; try { const g = buildShare(); const key = g.debt.length + ":" + g.cash.length + ":" + g.table.length + ":" + g.debt.slice(-200) + g.cash.slice(-200);
    if (!now && key === shLast) return; shLast = key; S.store.setShare(sh.token, g); if (now) toast("Paylaşılan sayfa güncellendi"); } catch (e) { console.error(e); } }, now ? 50 : 4000);
}
function renderShare() {
  const d = S.share, root = $("#root");
  if (!d) { root.innerHTML = '<div class="boot">Bu bağlantı geçersiz ya da paylaşım kapatılmış.</div>'; return; }
  const tabs = [["debt", "Borç takvimi"], ["cash", "Nakit akışı"], ["table", "Gider " + d.year]];
  root.innerHTML = '<div class="shareview"><header class="shtop"><span class="lgw"><img class="lgi" src="/icons/icon-192.png" alt=""><span class="lgt">Bütçe</span></span><span class="small muted">' + (d.name ? esc(d.name) + " paylaştı, " : "") + 'son güncelleme ' + new Date(d.ts).toLocaleString("tr-TR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) + '</span></header>' +
    '<div class="chips shtabs">' + tabs.map(([k, l]) => '<button class="chip" data-sh="' + k + '" aria-pressed="' + (S.shTab === k) + '">' + l + '</button>').join("") + '</div><div class="shbody">' + d[S.shTab] + '</div><p class="small muted">Bu sayfa salt okunurdur.</p></div>';
  root.querySelectorAll("[data-sh]").forEach(b => b.onclick = () => { S.shTab = b.dataset.sh; renderShare(); });
}
function vInv() {
  return '<div class="card lockcard"><span class="lockic">' + ICON.lock + '</span><h2>Yatırımlar yakında</h2><p class="muted">Döviz, altın, fon ve hisse gibi varlıklarınızı buradan takip edeceksiniz: güncel değer, maliyet, kâr/zarar ve toplam servet içindeki payı.</p><div class="locklist">' +
    [["Varlık kalemleri", "Her varlık için adet, maliyet ve güncel değer."], ["Portföy dağılımı", "Hangi varlıkta ne kadar duruyorsunuz."], ["Kâr / zarar", "Alış maliyetine göre kazanç ve kayıp."], ["Net servet", "Hesaplar artı yatırımlar eksi borçlar."]].map(([t, d]) => '<div class="lockrow"><b>' + t + '</b><span class="muted small">' + d + '</span></div>').join("") +
    '</div></div>';
}
function vAcc() {
  const Dd = derived();
  return '<div class="narrow"><div class="toolbar"><span class="small muted" style="flex:1">İşlemleri görmek için hesap adına dokunun.</span><button class="btn sm" data-act="acc-new">Hesap ekle</button></div><div class="card"><ul class="list">' + meta().accounts.slice().sort((a, b) => (a.order || 0) - (b.order || 0)).map(a => '<li class="acc-li" data-id="' + esc(a.id) + '"><div class="set-row catrow">' + (a.logo ? '<span class="cic logo" style="width:34px;height:34px"><img src="' + esc(a.logo) + '" alt=""></span>' : '<span class="cic" style="--c:' + a.color + ';width:34px;height:34px">' + svgI(a.type === "kart" ? CI.card : a.type === "nakit" ? CI.coin : CI.home) + '</span>') + '<button class="grow" style="text-align:left" data-act="acc-tx" data-id="' + esc(a.id) + '">' + esc(a.name) + (a.type === "kart" ? ' <span class="tag">kredi kartı' + (a.cut ? ", kesim " + a.cut : "") + '</span>' : '') + (a.hidden ? ' <span class="tag">gizli</span>' : '') + '</button>' + (a.type === "kart" && a.cut ? '<button class="btn sm" data-act="stmt" data-id="' + esc(a.id) + '">Ekstre</button>' : '') + '<span class="' + ((Dd.bal[a.id] || 0) < 0 ? "neg" : "") + '" style="white-space:nowrap">' + f2(Dd.bal[a.id] || 0) + '</span><button class="ib pen" data-act="acc-edit" data-id="' + esc(a.id) + '" aria-label="Düzenle">' + ICON.pen + '</button></div></li>').join("") + '</ul></div></div>';
}
function vCat() {
  const op = S.catExp || (S.catExp = {}), cats = meta().categories;
  const sec = (t, l) => { const rows = catTree().filter(({ c, depth }) => c.type === t && (!depth || op[c.parent])); return '<div class="sec-h" style="margin-top:16px"><h2>' + l + '</h2></div><div class="card"><ul class="list">' + rows.map(({ c, depth }) => { const kids = !depth && cats.some(x => x.parent === c.id); return '<li><div class="set-row catrow" style="padding-left:' + (14 + depth * 26) + 'px"><span class="cic" style="--c:' + c.color + ';width:30px;height:30px">' + catIcon(c.id) + '</span><button class="grow" style="text-align:left" data-act="cat-tx" data-id="' + esc(c.id) + '">' + esc(c.name) + '</button>' + (kids ? '<button class="ib" data-act="cat-exp" data-id="' + esc(c.id) + '" aria-label="Alt kategoriler" style="transform:rotate(' + (op[c.id] ? 90 : 0) + 'deg);transition:transform .2s">' + ICON.r + '</button>' : '') + '<button class="ib pen" data-act="cat-edit" data-id="' + esc(c.id) + '" aria-label="Düzenle">' + ICON.pen + '</button></div></li>'; }).join("") + '</ul></div>'; };
  return '<div class="narrow"><div class="toolbar"><span class="small muted" style="flex:1">İşlemleri görmek için kategori adına dokunun.</span><button class="btn sm" data-act="cat-new">Kategori ekle</button></div>' + sec("E", "Gider kategorileri") + sec("I", "Gelir kategorileri") + '</div>';
}
function vPay() {
  const q = (S.payQ || "").trim().toLocaleLowerCase("tr");
  const sort = S.paySort || "isim";
  const cmps = { isim: (a, b) => a.t.localeCompare(b.t, "tr"), n: (a, b) => b.n - a.n || a.t.localeCompare(b.t, "tr"), a: (a, b) => b.a - a.a || a.t.localeCompare(b.t, "tr") };
  const lbls = { isim: "İsme göre", n: "İşlem sayısı", a: "Hacim" };
  const cmp = cmps[sort] || cmps.isim;
  const sec = (k, l) => { const rows = allPayees(k).filter(p => !q || p.t.toLocaleLowerCase("tr").includes(q)).sort(cmp); if (!rows.length) return ''; return '<div class="sec-h" style="margin-top:16px"><h2>' + l + '</h2></div><div class="card"><ul class="list">' + rows.map(p => '<li><div class="set-row catrow"><button class="grow" style="text-align:left" data-act="pay-tx" data-t="' + esc(p.t) + '">' + esc(p.t) + '<span class="small muted" style="display:block">' + p.n + ' işlem · ' + f2(p.a) + '</span></button><button class="ib pen" data-act="pay-ren" data-t="' + esc(p.t) + '" aria-label="Adını değiştir">' + ICON.pen + '</button></div></li>').join("") + '</ul></div>'; };
  const body = sec("e", "Gider lehdarları") + sec("i", "Gelir lehdarları");
  return '<div class="narrow"><div class="toolbar"><input class="search" type="search" placeholder="Lehdar ara" value="' + esc(S.payQ || "") + '" data-in="payq"><button class="btn sm" data-act="pay-sort" title="Sırala">' + lbls[sort] + '</button></div>' + (body || '<div class="card empty">Lehdar bulunamadı.</div>') + '</div>';
}
function askText(msg, val) {
  return new Promise(res => {
    const o = document.createElement("div"); o.className = "askov";
    o.innerHTML = '<div class="askbox"><p>' + msg + '</p><input class="in" autocomplete="off" style="margin-bottom:10px" value="' + esc(val || "") + '"><button class="btn" data-i="1">Kaydet</button><button class="btn ghost" data-i="-1">Vazgeç</button></div>';
    const inp = o.querySelector("input"); const done = v => { o.remove(); res(v); };
    o.addEventListener("click", e => { e.stopPropagation(); const b = e.target.closest("button"); if (b) done(+b.dataset.i < 0 ? null : inp.value.trim()); else if (e.target === o) done(null); });
    inp.addEventListener("keydown", e => { if (e.key === "Enter") done(inp.value.trim()); });
    (typeof dlg !== "undefined" && dlg.open ? dlg : document.body).appendChild(o); setTimeout(() => inp.focus(), 30);
  });
}
function bulkTx(match, change, skipId) { let n = 0; Object.keys(S.months).forEach(m => { let ch = false; const arr = S.months[m].map(t => { if (t.id === skipId || !match(t)) return t; ch = true; n++; return change({ ...t }); }); if (ch) saveMonth(m, arr); }); return n; }
function tDebt(list) {
  const now = CUR(), nf = f2;
  if (!list.length) return '<div class="card empty">Gösterilecek borç yok.</div>';
  let mn = null, mx = null; list.forEach(([, d]) => (d.sched || []).forEach(it => { if (!mn || it.m < mn) mn = it.m; if (!mx || it.m > mx) mx = it.m; }));
  if (!mn) { mn = now; mx = now; }
  const ms = []; for (let m = mn; m <= mx; m = C.addM(m, 1)) ms.push(m);
  const past = ms.filter(m => m < now), show = S.showPast ? ms : ms.filter(m => m >= now);
  const idx = {}; list.forEach(([id, d]) => { idx[id] = {}; (d.sched || []).forEach((it, i) => idx[id][it.m] = { it, i }); });
  let h = '<div class="tw"><table class="sh"><thead><tr><th>Ay</th>' + list.map(([id, d]) => '<th class="click" data-act="' + (d.src === "acc" ? "acc-edit" : "edit-debt") + '" data-id="' + esc(id) + '" title="Düzenle">' + esc(d.name) + '<span class="hs">' + dayTxt(d.day) + '</span></th>').join("") + '<th class="st">Toplam</th></tr></thead><tbody>';
  if (past.length) h += '<tr><td class="past" colspan="' + (list.length + 2) + '" data-act="past-toggle"><span class="pst">' + (S.showPast ? "▾ Geçmiş ayları gizle" : "▸ Geçmiş " + past.length + " ay") + '</span></td></tr>';
  show.forEach(m => { let rt = 0; h += '<tr' + (m === now ? ' class="cur"' : '') + '><td>' + mLabel(m) + '</td>' + list.map(([id, d]) => { const x = idx[id][m]; if (!x) return '<td class="fut">' + f2(0) + '</td>'; rt += x.it.a; return '<td class="' + (isPaid(d, x.it) ? "paid" : "") + '" data-act="toggle-paid" data-id="' + esc(id) + '" data-src="' + d.src + '" data-i="' + x.i + '" style="cursor:pointer">' + nf(x.it.a) + '</td>'; }).join("") + '<td class="st">' + nf(rt) + '</td></tr>'; });
  const kal = list.map(([, d]) => debtKalan(d));
  h += '</tbody><tfoot><tr><td>Kalan</td>' + kal.map(v => '<td>' + nf(v) + '</td>').join("") + '<td class="st">' + nf(kal.reduce((a, b) => a + b, 0)) + '</td></tr></tfoot></table></div>';
  return h + '<p class="small muted">Ödenenler ✓ ile gösterilir, dokunarak değiştirebilirsiniz. Düzenlemek için başlığa dokunun.</p>';
}
function dayTxt(n) { n = n || 1; const o = n % 10, t = Math.floor(n / 10); const sfx = o ? { 1: "i", 2: "si", 3: "ü", 4: "ü", 5: "i", 6: "sı", 7: "si", 8: "i", 9: "u" }[o] : { 1: "u", 2: "si", 3: "u" }[t]; return "ayın " + n + "'" + sfx; }
function extendRecs() {
  const recs = meta().recs || [], hz = C.addM(CUR(), 12); if (!recs.length) return;
  const add = {}, upd = {};
  recs.forEach(r => { let m = C.addM(r.last.slice(0, 7), 1); while (m <= hz) { const d = m + "-" + C.pad(Math.min(r.day, C.daysIn(m))); (add[m] = add[m] || []).push({ ...r.tpl, id: C.rid(), d, ts: new Date(d + "T12:00").getTime(), grp: r.grp }); upd[r.grp] = d; m = C.addM(m, 1); } });
  if (!Object.keys(upd).length) return;
  Object.entries(add).forEach(([m, arr]) => saveMonth(m, monthItems(m).concat(arr)));
  saveMetaChange(mm => { mm.recs.forEach(r => { if (upd[r.grp]) r.last = upd[r.grp]; }); });
}
function perRange() {
  const cm = CUR(), y = cm.slice(0, 4), t = today();
  if (S.per && S.per.startsWith("d:")) return [S.per.slice(2), S.per.slice(2)];
  if (S.per === "30") { const d = new Date(); d.setDate(d.getDate() - 29); return [C.ymd(d), t]; }
  if (S.per === "m") return [cm + "-01", cm + "-" + C.daysIn(cm)];
  if (S.per === "pm") { const p = C.addM(cm, -1); return [p + "-01", p + "-" + C.daysIn(p)]; }
  if (S.per === "3") return [C.addM(cm, -2) + "-01", cm + "-" + C.daysIn(cm)];
  if (S.per === "6") return [C.addM(cm, -5) + "-01", cm + "-" + C.daysIn(cm)];
  if (S.per === "y") return [y + "-01-01", y + "-12-31"];
  return ["0000-01-01", "9999-12-31"];
}
const catParts = t => (t.sp && t.sp.length) ? t.sp : [{ cat: t.cat, a: t.a }];
function inCat(id, root) { let c = catOf(id), g = 0; while (c && g++ < 6) { if (c.id === root) return true; c = c.parent ? catOf(c.parent) : null; } return false; }
function vPie() {
  const now = new Date(), y = now.getFullYear(), cm = CUR();
  const pres = [["Bu ay", cm + "-01", today()], ["Geçen ay", C.addM(cm, -1) + "-01", C.addM(cm, -1) + "-" + C.daysIn(C.addM(cm, -1))], ["Son 3 ay", C.addM(cm, -2) + "-01", today()], ["Bu yıl", y + "-01-01", today()], ["Geçen yıl", (y - 1) + "-01-01", (y - 1) + "-12-31"]];
  const tops = meta().categories.filter(c => c.type === "E" && !c.parent).sort((a, b) => a.name.localeCompare(b.name, "tr"));
  let h = '<div class="chips" style="margin:6px 0 10px">' + pres.map(([l, f, t]) => '<button class="chip" data-act="pie-pre" data-f="' + f + '" data-t="' + t + '" aria-pressed="' + (S.pFrom === f && S.pTo === t) + '">' + l + '</button>').join("") + '</div>';
  h += '<div class="toolbar"><input class="sel" type="date" data-ch="pFrom" value="' + S.pFrom + '"><span class="muted">–</span><input class="sel" type="date" data-ch="pTo" value="' + S.pTo + '"><select class="sel" data-ch="pCat"><option value="">Tüm kategoriler</option>' + tops.map(c => '<option value="' + esc(c.id) + '"' + (S.pCat === c.id ? " selected" : "") + '>' + esc(c.name) + '</option>').join("") + '</select></div>';
  const by = {}; let tot = 0;
  derived().all.forEach(t => { if (t.k !== "e" || t.d < S.pFrom || t.d > S.pTo) return;
    catParts(t).forEach(pp => { let key;
      if (!S.pCat) { const tc = C.topCat(derived().catMap, pp.cat); key = tc ? tc.id : "_"; }
      else { if (!inCat(pp.cat, S.pCat)) return; let c = catOf(pp.cat); while (c && c.parent && c.parent !== S.pCat) c = catOf(c.parent); key = c ? c.id : "_"; }
      by[key] = (by[key] || 0) + pp.a; tot += pp.a; }); });
  const rows = Object.entries(by).sort((a, b) => b[1] - a[1]);
  if (!rows.length) return h + '<div class="card empty">Bu aralıkta gider yok.</div>';
  const R = 70, Cc = 2 * Math.PI * R; let off = 0;
  const col = id => id === "_" ? "#9a9fa3" : catColor(id), nm = id => id === "_" ? "Kategorisiz" : (S.pCat && id === S.pCat ? catOf(id).name + " (genel)" : catOf(id).name);
  const arcs = rows.map(([id, v]) => { const len = v / tot * Cc; const c = '<circle r="' + R + '" cx="90" cy="90" fill="none" stroke="' + col(id) + '" stroke-width="34" stroke-dasharray="' + len.toFixed(2) + ' ' + (Cc - len).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '"/>'; off += len; return c; }).join("");
  h += '<div class="card pie"><svg viewBox="0 0 180 180" width="220" height="220" style="transform:rotate(-90deg)">' + arcs + '</svg><div class="pie-c"><span class="muted small">' + (S.pCat ? esc(catOf(S.pCat).name) : "Toplam gider") + '</span><b>' + f0(tot) + '</b></div></div>';
  S.pOpen = S.pOpen || {};
  const subOf = pid => { const o = {}; let tt = 0; derived().all.forEach(t => { if (t.k !== "e" || t.d < S.pFrom || t.d > S.pTo) return;
    catParts(t).forEach(pp => { if (!inCat(pp.cat, pid)) return; let c = catOf(pp.cat); while (c && c.parent && c.parent !== pid) c = catOf(c.parent); const k = !c || c.id === pid ? pid : c.id; o[k] = (o[k] || 0) + pp.a; tt += pp.a; }); });
    return [Object.entries(o).sort((a, b) => b[1] - a[1]), tt]; };
  const hasKids = id => id !== "_" && meta().categories.some(c => c.parent === id);
  const rowH = ([id, v], base, lvl) => { const open = !!S.pOpen[id], kids = hasKids(id) && !(S.pCat && id === S.pCat);
    let out = '<li class="prow lv' + lvl + '"><div class="tx"><button class="pmain" data-act="' + (kids ? "pie-tog" : "") + '" data-id="' + esc(id) + '"><span class="cic" style="--c:' + col(id) + '">' + (id === "_" ? svgI(CI.tag) : catIcon(id)) + '</span><span class="m"><span class="t">' + esc(nm(id)) + (kids ? ' <span class="pch' + (open ? ' on' : '') + '">▾</span>' : '') + '</span><span class="s">%' + nfp.format(base ? v / base * 100 : 0) + '</span></span><span class="a">' + f2(v) + '</span></button>' + (id !== "_" ? '<button class="ib pgo" data-act="cat-tx" data-id="' + esc(id) + '" aria-label="İşlemler">' + ICON.r + '</button>' : '') + '</div></li>';
    if (kids && open) { const [sr, st] = subOf(id); out += sr.map(([sid, sv]) => sid === id ? '<li class="prow lv' + (lvl + 1) + '"><div class="tx"><span class="pmain"><span class="cic" style="--c:' + col(id) + '">' + catIcon(id) + '</span><span class="m"><span class="t">' + esc(catOf(id).name) + ' (genel)</span><span class="s">%' + nfp.format(st ? sv / st * 100 : 0) + '</span></span><span class="a">' + f2(sv) + '</span></span></div></li>' : rowH([sid, sv], st, lvl + 1)).join(""); }
    return out; };
  h += '<div class="card" style="margin-top:12px"><ul class="list">' + rows.map(r => rowH(r, tot, 0)).join("") + '</ul></div>';
  return h + '<p class="small muted">Alt kategorileri görmek için kategoriye, işlemleri görmek için sağdaki oka dokunun.</p>';
}
/* ============ sheet ============ */
const dlg = $("#sheet"), dlgIn = $("#sheet-in");
let D = null; // draft
function openSheet(html, keepScroll) { dlgIn.classList.toggle("rr", !!keepScroll && dlg.open); const bd = dlgIn.querySelector(".sh-bd"); const st = bd ? bd.scrollTop : 0; dlgIn.innerHTML = html; if (!dlg.open) dlg.showModal(); const nb = dlgIn.querySelector(".sh-bd"); if (nb) nb.scrollTop = keepScroll ? st : 0; }
function closeSheet() { if (dlg.open) dlg.close(); D = null; }
dlg.addEventListener("close", () => { D = null; });
dlg.addEventListener("click", e => { if (e.target === dlg) closeSheet(); });
const head = (title, cls, back) => '<div class="sh-hd ' + (cls || "") + '">' + (back ? '<button class="ib" data-act="' + back + '" aria-label="Geri">' + ICON.back + '</button>' : '') + '<h3>' + title + '</h3><button class="ib" data-act="close" aria-label="Kapat">' + ICON.x + '</button></div>';

/* ---- transaction sheet ---- */
function lastAccFor(k) { const D2 = derived(); const t = D2.all.filter(x => x.k === k && x.d <= today()).sort((a, b) => (b.ts || 0) - (a.ts || 0))[0]; return (visibleAccs()[0] || {}).id || (t ? t.acc : null); }
function recentCats(k) { const seen = [], all = derived().all.filter(t => t.k === k && t.cat).sort((a, b) => (b.ts || 0) - (a.ts || 0)); for (const t of all) { if (!seen.includes(t.cat) && catOf(t.cat)) seen.push(t.cat); if (seen.length >= 10) break; } return seen; }

function openTx(opt = {}) {
  if (opt.id) {
    const t = monthItems(opt.m).find(x => x.id === opt.id); if (!t) return;
    D = { ...clone(t), aStr: amtIn(t.a), sp: (t.sp || []).map(x => ({ cat: x.cat, a: amtIn(x.a) })), _m: opt.m, _origD: t.d, _new: false, rep: "one", cnt: 2, catOpen: false, accTouched: true };
    if (t.grp && !t.ins) D.gl = derived().all.filter(x => x.grp === t.grp && x.id !== t.id).sort((a, b) => a.d.localeCompare(b.d)).map(x => ({ id: x.id, m: x.d.slice(0, 7), d: x.d, a: x.a, o: x.d + "|" + x.a }));
  } else {
    const k = opt.k || "e";
    const defD = opt.d || (S.view === "tx" && S.month !== CUR() ? S.month + "-01" : today());
    D = { id: C.rid(), k, aStr: opt.a ? amtIn(opt.a) : "", acc: opt.acc || lastAccFor(k === "tr" ? "e" : k), to: null, cat: opt.cat || null, t: opt.t || "", n: "", d: defD, rep: "one", cnt: 2, _new: true, catOpen: false, accTouched: !!opt.acc };
    if (k === "tr") D.to = visibleAccs().find(a => a.id !== D.acc)?.id || null;
  }
  renderTx(); if (D._new) setTimeout(() => { const i = $("#f-amt"); i && i.focus(); }, 80);
}
function renderTx(keep) {
  const k = D.k, accs = visibleAccs();
  const title = (D._new ? "Yeni " : "") + { e: "gider", i: "gelir", tr: "transfer" }[k];
  let h = head(title.charAt(0).toUpperCase() + title.slice(1), k);
  h += '<div class="sh-bd tx-form">';
  if (D._new || true) h += '<div class="seg" style="display:flex;margin-bottom:14px">' + [["e", "Gider"], ["i", "Gelir"], ["tr", "Transfer"]].map(([v, l]) => '<button style="flex:1" data-act="tx-k" data-v="' + v + '" aria-pressed="' + (k === v) + '">' + l + '</button>').join("") + '</div>';
  const accChips = (field, label) => '<div class="fld"><span>' + label + '</span><div class="scroll-x">' + accs.map(a => '<button class="chip" data-act="tx-acc" data-f="' + field + '" data-id="' + esc(a.id) + '" aria-pressed="' + (D[field] === a.id) + '"><i style="background:' + a.color + ';border-radius:2px"></i>' + esc(a.name) + '</button>').join("") + '</div></div>';
  if (k === "tr") { h += accChips("acc", "Kimden"); h += accChips("to", "Kime"); } else h += accChips("acc", "Hesap");
  h += '<label class="fld"><span>Tutar</span><span class="amtwrap"><span class="cur">₺</span><input id="f-amt" class="in amt" inputmode="decimal" autocomplete="one-time-code" data-lpignore="true" data-1p-ignore="true" placeholder="0,00" value="' + esc(D.aStr) + '" data-d="aStr"></span></label><div id="e-amt"></div>';
  if (k !== "tr") {
    h += '<div class="fld"><span>Kategori</span><div class="tx-category">';
    if (D.catOpen) h += '<div class="catsel cat-search">' + ICON.search + '<input id="cq" role="combobox" aria-label="Kategori ara" aria-expanded="true" aria-controls="catlist" aria-autocomplete="list" autocomplete="off" placeholder="Kategori ara…" value="' + esc(D.cq || "") + '"><button class="ib" data-act="cat-open" aria-label="Kategori listesini kapat">' + ICON.x + '</button></div>' + catPanel(k);
    else h += '<button class="catsel" data-act="cat-open" aria-expanded="false" aria-haspopup="listbox"><i style="background:' + catColor(D.cat) + '"></i><span>' + esc(D.cat ? catLabel(D.cat) : "Kategori seç") + '</span><span class="cat-chevron">' + ICON.r + '</span></button>';
    h += '</div>';
    h += '<div style="margin-top:8px"><button class="btn sm ghost" data-act="sp-toggle">' + (D.sp && D.sp.length ? "Bölmeyi kaldır" : "Birden fazla kategoriye böl") + '</button></div>';
    h += '<div id="spbox">' + spBox() + '</div>';
    h += '</div>';
  }
  const dateF = '<label class="fld tx-date"><span>Tarih</span><input class="in" type="date" value="' + esc(D.d) + '" data-d="d"></label>';
  if (k !== "tr") h += '<div class="tx-pd"><div class="tx-payee"><label class="fld"><span>Lehdar</span><input id="f-t" class="in" autocomplete="one-time-code" data-lpignore="true" data-1p-ignore="true" placeholder="Boşsa kategori adı" value="' + esc(D.t) + '" data-d="t"></label><div class="sugg" id="sugg"></div></div>' + dateF + '</div>';
  else h += dateF;
  h += '<label class="fld"><span>Not</span><input class="in" maxlength="120" value="' + esc(D.n) + '" data-d="n" placeholder="İsteğe bağlı"></label>';
  if (D._new) {
    h += '<div class="fld"><span>Tekrar</span><div class="seg" style="display:flex">' + [["one", "Tek sefer"], ["inst", "Taksit"], ["mon", "Abonelik"]].map(([v, l]) => '<button style="flex:1" data-act="tx-rep" data-v="' + v + '" aria-pressed="' + (D.rep === v) + '">' + l + '</button>').join("") + '</div></div>';
    if (D.rep === "mon") h += '<label class="fld" style="display:flex;gap:10px;align-items:center"><input type="checkbox" data-open' + (D.open ? " checked" : "") + '> Ben iptal edene kadar (abonelik)</label>';
    if (D.rep !== "one" && !(D.rep === "mon" && D.open)) h += '<label class="fld"><span>' + (D.rep === "inst" ? "Taksit sayısı" : "Kaç ay") + '</span><input class="in" type="number" min="2" max="60" value="' + D.cnt + '" data-d="cnt"></label>';
    if (D.rep !== "one") h += '<div id="planlist"></div>';
  } else if (D.ins) h += '<p class="small muted">Taksit ' + esc(D.ins) + '. Bu değişiklik sadece bu taksiti etkiler.</p>';
  else if (D.grp) { h += '<p class="small muted">Abonelik. Durdurmak için Sil → "Gelecek işlemleri de sil".</p>';
    if (D.gl && D.gl.length) { const tdy = today(), all = D.gl.concat([{ me: 1, d: D.d, a: C.parseAmt(D.aStr) }]).sort((a, b) => a.d.localeCompare(b.d));
      h += '<div class="fld"><span>Tüm ödemeler</span></div><div class="schedwrap" id="glwrap" style="max-height:232px;overflow-y:auto;position:relative"><table class="sched"><tbody>' + all.map(p => p.me ? '<tr class="gl-me"><td class="muted small" style="white-space:nowrap;width:1%">Bu işlem</td><td colspan="2" class="small"><b>' + dLabel(p.d) + ' · ' + f2(p.a) + '</b></td></tr>' : (i => '<tr' + (p.d < tdy ? ' style="opacity:.7"' : '') + '><td class="muted small" style="white-space:nowrap;width:1%">' + (p.d < tdy ? "Geçmiş" : "Gelecek") + '</td><td><input type="date" data-gd="' + i + '" value="' + p.d + '" style="text-align:left"></td><td><input inputmode="decimal" data-ga="' + i + '" value="' + esc(amtIn(p.a)) + '"></td></tr>')(D.gl.indexOf(p))).join("") + '</tbody></table></div>'; } }
  h += '<div id="e-gen"></div></div><div class="sh-ft">';
  if (!D._new) h += '<button class="btn danger" data-act="tx-del">Sil</button>';
  else h += '<button class="btn ghost" data-act="tx-save" data-more="1">Kaydet ve yeni</button>';
  h += '<button class="btn" data-act="tx-save">Kaydet</button></div>';
  openSheet(h, keep);
  if (k !== "tr") renderSugg();
  renderPlanBox();
  const gw = $("#glwrap"); if (gw) { const me = gw.querySelector(".gl-me"), pv = me && me.previousElementSibling; const top = (pv || me); if (top) gw.scrollTop = top.offsetTop; }
}
function catPanel(k) { return '<div class="catpanel tx-catpanel"><div id="catlist" class="tx-catlist" role="listbox" aria-label="Kategoriler">' + catList(k, D.cq) + '</div></div>'; }
function gtList(kind, g, q) {
  q = (q || "").trim().toLocaleLowerCase("tr"); if (!q) return "";
  const have = D[g] || [];
  const items = kind === "c" ? meta().categories.filter(c => c.type === "E").map(c => ({ v: c.id, l: catLabel(c.id), col: c.color })) : allPayees("e").map(p => ({ v: "p:" + p.t, l: p.t, col: "var(--tr)" }));
  const m = items.filter(x => !have.includes(x.v) && x.l.toLocaleLowerCase("tr").includes(q)).sort((a, b) => a.l.localeCompare(b.l, "tr")).slice(0, 40);
  return m.length ? m.map(x => '<button class="tx-catoption" role="option" data-act="gt-add" data-g="' + g + '" data-v="' + esc(x.v) + '"><i style="background:' + x.col + '"></i><span>' + esc(x.l) + '</span></button>').join("") : '<p class="small muted cat-noresults">Eşleşen yok.</p>';
}
function catList(k, q) {
  const own = k === "i" ? "I" : "E", cats = k === "i" ? meta().categories.slice() : meta().categories.filter(c => c.type === own);
  const selected = D.spPick != null ? D.sp[D.spPick].cat : D.cat;
  const row = c => '<button class="tx-catoption" role="option" data-act="tx-cat" data-id="' + esc(c.id) + '" aria-selected="' + (selected === c.id) + '"><i style="background:' + c.color + '"></i><span>' + esc(catLabel(c.id)) + '</span>' + (selected === c.id ? '<span class="cat-check">✓</span>' : '') + '</button>';
  q = (q || "").trim().toLocaleLowerCase("tr");
  const matches = cats.filter(c => !q || catLabel(c.id).toLocaleLowerCase("tr").includes(q)).sort((a, b) => ((a.type !== own) - (b.type !== own)) || catLabel(a.id).localeCompare(catLabel(b.id), "tr"));
  return matches.length ? matches.map(row).join("") : '<p class="small muted cat-noresults">' + (q ? 'Eşleşen kategori yok.' : 'Henüz kategori yok.') + '</p>';
}
function buildPlan() {
  const a = C.parseAmt(D.aStr), n = D.rep === "mon" && D.open ? 12 : Math.max(2, Math.min(60, parseInt(D.cnt) || 2));
  if (!(a > 0) || !D.d) return [];
  const per = D.rep === "inst" ? Math.floor(a / n * 100) / 100 : C.r2(a), [y0, m0, d0] = D.d.split("-").map(Number);
  return [...Array(n)].map((_, i) => { const m = C.addM(y0 + "-" + C.pad(m0), i); return { d: m + "-" + C.pad(Math.min(d0, C.daysIn(m))), a: D.rep === "inst" && i === n - 1 ? C.r2(a - per * (n - 1)) : per }; });
}
function renderPlanBox() {
  const box = $("#planlist"); if (!box || !D || D.rep === "one") return;
  if (!D.planEdited) D.plan = buildPlan();
  if (!D.plan.length) { box.innerHTML = '<p class="small muted" style="margin-top:-6px">Tutarı girince taksitler burada listelenir.</p>'; return; }
  const tot = D.plan.reduce((s, p) => s + (p.a || 0), 0);
  box.innerHTML = '<div class="schedwrap" style="max-height:240px"><table class="sched"><tbody>' + D.plan.map((p, i) => '<tr><td style="white-space:nowrap;width:1%" class="muted">' + (i + 1) + '/' + D.plan.length + '</td><td><input type="date" data-pd="' + i + '" value="' + p.d + '" style="text-align:left"></td><td><input inputmode="decimal" data-pa="' + i + '" value="' + esc(amtIn(p.a)) + '"></td></tr>').join("") + '</tbody></table></div><div style="display:flex;justify-content:space-between;font-size:13px;margin:-4px 2px 12px"><span class="muted" id="plantot">Toplam ' + f2(tot) + '</span>' + (D.planEdited ? '<button class="lnk" style="color:var(--tr)" data-act="plan-reset">Eşit dağıt</button>' : '') + '</div>';
}
function spBox() {
  if (!D || !D.sp || !D.sp.length) return "";
  const a = C.parseAmt(D.aStr) || 0, sum = D.sp.reduce((s, x) => s + (C.parseAmt(x.a) || 0), 0), diff = C.r2(a - sum);
  return '<div class="spwrap">' + D.sp.map((x, i) => '<div class="sprow"><button class="spcat" data-act="sp-cat" data-i="' + i + '"><i style="background:' + catColor(x.cat) + '"></i>' + esc(x.cat ? catLabel(x.cat, true) : "Kategori seç") + '</button><input class="in" inputmode="decimal" data-sa="' + i + '" value="' + esc(x.a) + '" placeholder="0,00"><button class="ib" data-act="sp-rm" data-i="' + i + '" aria-label="Sil">' + ICON.x + '</button></div>').join("") +
    '<div class="sprow spf"><button class="btn sm ghost" data-act="sp-add">Satır ekle</button><span class="small ' + (Math.abs(diff) < 0.005 ? "muted" : "neg") + '">' + (Math.abs(diff) < 0.005 ? "Dağıtım tam" : (diff > 0 ? "Kalan " + f2(diff) : "Fazla " + f2(-diff))) + '</span></div></div>' +
    (D.spPick != null ? '<div class="tx-catlist" role="listbox" aria-label="Bölme kategorileri">' + catList(D.k, "") + '</div>' : '');
}
function renderSpBox() { const b = $("#spbox"); if (b) b.innerHTML = spBox(); }
function renderSugg() {
  const box = $("#sugg"); if (!box || !D) return;
  const qy = (D.t || "").trim().toLocaleLowerCase("tr");
  if (qy.length < 1) { box.innerHTML = ""; return; }
  const list = derived().payees.filter(p => p.k === D.k && p.t.toLocaleLowerCase("tr").includes(qy) && p.t.toLocaleLowerCase("tr") !== qy).slice(0, 5);
  box.innerHTML = list.map((p, i) => '<button data-act="sugg" data-i="' + i + '" data-t="' + esc(p.t) + '"><b style="font-weight:500">' + esc(p.t) + '</b><span>' + esc(catLabel(p.cat)) + '</span></button>').join("");
}
function genTxs() {
  const a = C.parseAmt(D.aStr);
  const base = { k: D.k, acc: D.acc, n: (D.n || "").trim() };
  if (D.k === "tr") base.to = D.to;
  else { base.t = (D.t || "").trim();
    const sp = (D.sp || []).map(x => ({ cat: x.cat, a: C.r2(C.parseAmt(x.a) || 0) })).filter(x => x.cat && x.a > 0);
    if (sp.length > 1) { base.sp = sp; base.cat = sp.slice().sort((x, y) => y.a - x.a)[0].cat; } else base.cat = D.cat || null; }
  const nowT = new Date(); const tsOf = d => { const [y, m, dd] = d.split("-").map(Number); return new Date(y, m - 1, dd, nowT.getHours(), nowT.getMinutes(), nowT.getSeconds()).getTime(); };
  if (!D._new || D.rep === "one") return [{ ...base, id: D.id, d: D.d, ts: D._new ? tsOf(D.d) : (D.d === D._origD ? D.ts : tsOf(D.d)), a: C.r2(a), ...(D.ins ? { ins: D.ins, grp: D.grp } : {}) }];
  const pl = D.plan && D.plan.length ? D.plan : buildPlan(), grp = C.rid();
  return pl.map((p, i) => ({ ...base, id: C.rid(), d: p.d, ts: tsOf(p.d), a: C.r2(p.a), ...(D.rep === "inst" ? { ins: (i + 1) + "/" + pl.length } : {}), grp }));
  const n = Math.max(2, Math.min(60, parseInt(D.cnt) || 2)), out = [];
  const per = D.rep === "inst" ? Math.floor(a / n * 100) / 100 : C.r2(a);
  const [y0, m0, d0] = D.d.split("-").map(Number);
  for (let i = 0; i < n; i++) {
    const m = C.addM(y0 + "-" + C.pad(m0), i), d = m + "-" + C.pad(Math.min(d0, C.daysIn(m)));
    const amt = D.rep === "inst" && i === n - 1 ? C.r2(a - per * (n - 1)) : per;
    out.push({ ...base, id: C.rid(), d, ts: tsOf(d), a: amt, ins: (i + 1) + "/" + n, grp });
  }
  return out;
}
const nz = v => String(v || "").toLocaleLowerCase("tr").replace(/[\s:›>\/-]+/g, "");
function applyPayee() {
  if (!D || D.k === "tr") return false;
  const q = (D.t || "").trim().toLocaleLowerCase("tr"); if (!q) return false;
  const p = derived().payees.find(x => x.k === D.k && x.t.toLocaleLowerCase("tr") === q);
  const cat = p && p.cat ? p.cat : (meta().categories.find(c => c.type === (D.k === "i" ? "I" : "E") && nz(catLabel(c.id)) === nz(q)) || {}).id;
  let ch = false;
  if (cat && cat !== D.cat && !(D.sp && D.sp.length)) { D.cat = cat; ch = true; }
  if (p && p.acc && !D.accTouched && p.acc !== D.acc) { D.acc = p.acc; ch = true; }
  return ch;
}
function saveTx(more) {
  if (D && D.k !== "tr") { applyPayee(); if (!(D.t || "").trim() && D.cat) D.t = catLabel(D.cat); }
  const a = C.parseAmt(D.aStr);
  const err = (id, msg) => { const e = $(id); if (e) e.innerHTML = '<p class="err">' + msg + '</p>'; };
  if (!(a > 0)) return err("#e-amt", "Tutar girin, örneğin 1.250,50");
  if (D.sp && D.sp.length) { const sp = D.sp.filter(x => x.cat && (C.parseAmt(x.a) || 0) > 0);
    if (sp.length < 2) return err("#e-gen", "Bölme için en az iki satıra kategori ve tutar girin.");
    const sum = sp.reduce((s, x) => s + C.parseAmt(x.a), 0);
    if (Math.abs(C.r2(sum - a)) > 0.009) return err("#e-gen", "Bölünen tutarların toplamı " + f2(sum) + ", tutar " + f2(a) + "."); }
  if (!D.acc) return err("#e-gen", "Hesap seçin.");
  if (D.k === "tr" && (!D.to || D.to === D.acc)) return err("#e-gen", "Transfer için iki farklı hesap seçin.");
  if (!D.d) return err("#e-gen", "Tarih seçin.");
  if (!D._new && !D._asked && D.k !== "tr") {
    const o = monthItems(D._m).find(x => x.id === D.id), oldP = o ? payName(o) : "", newP = (D.t || "").trim(), opk = oldP.toLocaleLowerCase("tr");
    const same = o ? derived().all.filter(x => x.id !== o.id && x.k !== "tr" && payName(x).toLocaleLowerCase("tr") === opk) : [];
    const pCh = oldP && newP && oldP !== newP, cCh = o && D.cat && o.cat !== D.cat && !(D.sp && D.sp.length);
    if (same.length && (pCh || cCh)) { const what = pCh && cCh ? "Lehdar ve kategori" : pCh ? "Lehdar" : "Kategori";
      ask(what + " değişti. \"" + esc(oldP) + "\" lehdarına ait diğer " + same.length + " işlemde de değişsin mi?", [{ l: "Tüm işlemlerde değiştir", v: "all" }, { l: "Sadece bu işlemi değiştir", v: "one" }]).then(v => { if (!v) return; D._asked = v;
        if (v === "all") { const nc = D.cat, oc = o.cat; bulkTx(x => x.k !== "tr" && payName(x).toLocaleLowerCase("tr") === opk, x => { if (pCh) x.t = newP; if (cCh && x.cat === oc) x.cat = nc; return x; }, o.id); }
        saveTx(more); }); return; }
  }
  const txs = genTxs(), touched = new Set(), touched2 = new Set();
  if (D._new && D.rep === "mon" && D.open && txs.length) { const l = txs[txs.length - 1]; saveMetaChange(m => { (m.recs = m.recs || []).push({ grp: l.grp, last: l.d, day: Number(D.d.slice(8, 10)), tpl: { k: l.k, acc: l.acc, cat: l.cat || null, t: l.t || "", n: l.n || "", a: l.a, to: l.to || null } }); }); }
  if (!D._new && D._m !== D.d.slice(0, 7)) { saveMonth(D._m, monthItems(D._m).filter(x => x.id !== D.id)); }
  txs.forEach(t => { const m = t.d.slice(0, 7); const arr = (touched.has(m) ? S.months[m] : monthItems(m)).filter(x => x.id !== t.id); arr.push(t); arr.sort((x, y) => (x.ts || 0) - (y.ts || 0)); S.months[m] = arr; touched.add(m); });
  if (!D._new && D.gl) D.gl.forEach(g => { if (g.d + "|" + g.a === g.o || !g.d || !(g.a > 0)) return; const t0 = monthItems(g.m).find(x => x.id === g.id); if (!t0) return; const nm = g.d.slice(0, 7);
    if (nm !== g.m) { S.months[g.m] = monthItems(g.m).filter(x => x.id !== g.id); touched2.add(g.m); }
    const arr = monthItems(nm).filter(x => x.id !== g.id); arr.push({ ...t0, d: g.d, a: C.r2(g.a) }); arr.sort((x, y) => (x.ts || 0) - (y.ts || 0)); S.months[nm] = arr; touched2.add(nm); });
  const msg = D._new ? (txs.length > 1 ? txs.length + " işlem eklendi" : "Kaydedildi") : "Güncellendi";
  const flush = () => { new Set([...touched, ...touched2]).forEach(m => { try { const r = saveMonth(m, S.months[m]); r && r.catch && r.catch(e => console.error(e)); } catch (e) { console.error(e); } }); };
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  if (more) { const keepK = D.k, keepAcc = D.acc; openTx({ k: keepK, acc: keepAcc }); toast(msg); setTimeout(() => { flush(); render(); }, 30); }
  else { if (dlg.open) dlg.close(); D = null; S.bub = null; toast(msg); setTimeout(() => { flush(); render(); }, 30); }
}
function deleteTx(all) {
  if (all && D.grp) {
    if ((meta().recs || []).some(r => r.grp === D.grp)) saveMetaChange(m => { m.recs = (m.recs || []).filter(r => r.grp !== D.grp); });
    const from = D.d; let n = 0;
    Object.keys(S.months).forEach(m => { const arr = S.months[m]; const keep = arr.filter(x => !(x.grp === D.grp && x.d >= from)); if (keep.length !== arr.length) { n += arr.length - keep.length; saveMonth(m, keep); } });
    closeSheet(); render(); toast(n + " taksit silindi"); return;
  }
  saveMonth(D._m, monthItems(D._m).filter(x => x.id !== D.id)); closeSheet(); render(); toast("Silindi");
}

/* ---- debt sheet ---- */
function openDebt(id) {
  const d = id ? S.debts[id] : null;
  const maxO = Object.values(S.debts).reduce((a, x) => Math.max(a, x.order || 0), 0);
  D = d ? { ...clone(d), _id: id } : { name: "", kind: "kredi", day: 15, payer: "ben", principal: null, total: null, rate: null, term: null, payoff: null, order: maxO + 1, sched: [], _id: null };
  renderDebt();
}
function renderDebt(keep) {
  const d = D, kart = d.kind === "kart", m = CUR();
  let h = head(d._id ? esc(debtTitle(d)) : "Kredi ekle") + '<div class="sh-bd">';
  h += '<label class="fld"><span>Banka / ad</span><input class="in" data-f="name" maxlength="30" value="' + esc(d.name) + '" placeholder="Örn. Garanti"></label>';
  h += '<label class="fld"><span>Ödeme günü</span><input class="in" type="number" min="1" max="31" data-f="day" data-num="int" value="' + (d.day || "") + '"></label>';
  h += '<div class="row2"><label class="fld"><span>' + (kart ? "Limit" : "Çekilen tutar") + '</span><input class="in" inputmode="decimal" data-f="principal" data-num="amt" value="' + esc(amtIn(d.principal)) + '"></label></div>';
  if (!kart) h += '<div class="row2"><label class="fld"><span>Aylık faiz (%)</span><input class="in" inputmode="decimal" data-f="rate" data-num="amt" value="' + esc(d.rate != null ? nfp.format(d.rate) : "") + '"></label><label class="fld"><span>Geri ödeme toplamı</span><input class="in" inputmode="decimal" data-f="total" data-num="amt" value="' + esc(amtIn(d.total)) + '" placeholder="Boşsa taksitlerden"></label></div>';
  const kal = debtKalan(d);
  h += '<div id="planbox">' + (!kart && !d.sched.length ? planHtml() : '') + '</div>';
  h += '<div class="sec-h" style="margin-top:6px"><h2>' + (kart ? "Ekstreler" : "Taksitler") + '</h2></div><div class="schedwrap" id="schedwrap">' + schedRows() + '</div>';
  h += '<div class="chips" style="margin-bottom:12px"><button class="btn sm ghost" data-act="d-addrow">Ay ekle</button>' + (kart || !d.sched.length ? '' : '<button class="btn sm ghost" data-act="d-plan">Taksit planı oluştur</button>') + '</div><div id="d-err"></div></div>';
  h += '<div class="sh-ft">' + (d._id ? '<button class="btn danger" data-act="d-del">Sil</button><button class="btn ghost" data-act="d-close">' + (d.closed ? "Geri aç" : "Borcu kapat") + '</button>' : '') + '<button class="btn" data-act="d-save">Kaydet</button></div>';
  openSheet(h, keep);
  const w = $("#schedwrap"), r = w && w.querySelector("tr.cur"); if (r && !keep) w.scrollTop = Math.max(0, r.offsetTop - 60);
}
function schedRows() {
  const d = D; if (!d.sched.length) return '<div class="empty">Henüz satır yok.</div>';
  return '<table class="sched"><tbody>' + d.sched.map((it, i) => { const p = isPaid(d, it); return '<tr' + (it.m === CUR() ? ' class="cur"' : '') + '><td style="white-space:nowrap">' + mShort(it.m) + '</td><td><input inputmode="decimal" data-si="' + i + '" value="' + esc(amtIn(it.a)) + '"></td><td style="width:1%"><button class="status ' + (p ? "paid" : "due") + '" data-act="d-paid" data-i="' + i + '">' + (p ? "Ödendi" : "Bekliyor") + '</button></td><td style="width:1%"><button class="ib" style="width:32px;height:32px" data-act="d-delrow" data-i="' + i + '" aria-label="Satırı sil">' + ICON.x + '</button></td></tr>'; }).join("") + '</tbody></table>';
}
const refreshSched = () => { const w = $("#schedwrap"), st = w.scrollTop; w.innerHTML = schedRows(); w.scrollTop = st; };
function planHtml() {
  const nd = new Date(); nd.setMonth(nd.getMonth() + 1);
  return '<div class="plan"><div class="row2"><label class="fld"><span>Kaç ay (taksit sayısı)</span><input class="in" type="number" id="p-n" min="1" max="120" value="' + (D.term || 12) + '"></label><label class="fld"><span>İlk ödeme tarihi</span><input class="in" id="p-date" inputmode="numeric" maxlength="10" placeholder="GG.AA.YYYY" value="' + C.ymd(nd).split("-").reverse().join(".") + '"></label></div><label class="fld"><span>Aylık taksit</span><input class="in" inputmode="decimal" id="p-a" placeholder="0,00"></label><div id="p-err"></div><button class="btn sm" data-act="d-plan-go">Taksitleri oluştur</button><p class="small muted" style="margin:8px 0 0">Oluşan taksitleri listeden tek tek düzenleyebilirsiniz.</p></div>';
}
function applyPlan(quiet) {
  const el = $("#p-n"); if (!el) return false;
  const n = parseInt(el.value), am = C.parseAmt($("#p-a").value), l = NaN, dm = $("#p-date").value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/), dt = dm && +dm[2] >= 1 && +dm[2] <= 12 && +dm[1] >= 1 && +dm[1] <= 31 ? dm[3] + "-" + dm[2].padStart(2, "0") + "-" + dm[1].padStart(2, "0") : "";
  if (!(n > 0) || !(am > 0) || !dt) { if (!quiet) $("#p-err").innerHTML = '<p class="err">Taksit sayısı, ilk ödeme tarihi ve aylık tutarı girin.</p>'; return false; }
  const st = dt.slice(0, 7); D.day = Number(dt.slice(8, 10));
  D.sched = [...Array(n)].map((_, i) => ({ m: C.addM(st, i), a: i === n - 1 && l > 0 ? C.r2(l) : C.r2(am) }));
  D.term = n; D.total = C.r2(D.sched.reduce((s, x) => s + x.a, 0));
  return true;
}
function saveDebt() {
  const d = D;
  if (!d.sched.length && d.kind !== "kart") applyPlan(true);
  if (!d.name || !d.name.trim()) { $("#d-err").innerHTML = '<p class="err">Banka veya borç adını girin.</p>'; return; }
  const seen = {}; const sched = d.sched.filter(it => it.m && isFinite(it.a)).sort((a, b) => a.m.localeCompare(b.m)).filter(it => seen[it.m] ? false : (seen[it.m] = 1));
  const out = { name: d.name.trim(), kind: d.kind, day: Math.min(31, Math.max(1, d.day || 1)), payer: d.payer, principal: d.principal ?? null, total: d.total ?? null, rate: d.rate ?? null, term: d.term ?? null, payoff: d.payoff ?? null, order: d.order || 0,
    sched: sched.map(it => { const o = { m: it.m, a: C.r2(it.a) }; if (it.p === true || it.p === false) o.p = it.p; return o; }) };
  if (out.kind === "kredi" && out.total == null && sched.length) out.total = debtTotal(out);
  if (out.kind === "kredi" && out.term == null && sched.length) out.term = sched.length;
  const id = d._id || (out.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 16) + "-" + C.rid().slice(0, 5));
  S.debts[id] = out; S.store.setDebt(id, out); closeSheet(); render(); toast("Kaydedildi");
}

/* ---- settings ---- */
function openSettings(tab) {
  D = { view: tab || "main" };
  renderSettings();
}
function payList() {
  const exd = (meta().cash || {}).exDebts || [], cols = debtCols(), cm = CUR();
  if (!cols.length) return "";
  const nextAmt = d => { const x = (d.sched || []).filter(z => z.m >= cm && z.a > 0).sort((a, b) => a.m.localeCompare(b.m))[0]; return x ? x.a : 0; };
  return '<div class="sec-h" style="margin:18px 2px 6px"><h2>Ödemeler</h2></div><p class="small muted" style="margin:0 2px 8px">Ödemeler sayfasındaki kart ve krediler. İşareti kaldırırsanız o ödeme bu ve sonraki aylardan çıkar; tekrar işaretleyince geri gelir.</p>' +
    '<div class="card paylist">' + cols.map(([id, d]) => { const on = !exd.includes(id);
      return '<div class="payrow' + (on ? '' : ' off') + '"><button class="ck' + (on ? ' on' : '') + '" data-act="ci-debt" data-id="' + esc(id) + '" role="checkbox" aria-checked="' + on + '" aria-label="' + esc(d.name) + '"></button><span class="grow">' + esc(d.name) + '<span class="small muted" style="display:block">' + (d.kind === "kart" ? "Kredi kartı" : "Kredi") + ', ayın ' + (d.day || 1) + '’i</span></span><span class="small muted">' + (nextAmt(d) ? f2(nextAmt(d)) : "") + '</span></div>'; }).join("") + '</div>';
}
function prevM(m) { const d = new Date(+m.slice(0, 4), +m.slice(5, 7) - 2, 1); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); }
function repHtml(m) {
  const pm = prevM(m), all = derived().all.filter(t => t.k !== "tr");
  const agg = mm => { const r = { e: 0, i: 0, c: {}, n: 0, big: null }; all.filter(t => t.d.startsWith(mm)).forEach(t => { if (t.k === "e") { r.e += t.a; r.n++; const k = t.cat || "_"; r.c[k] = (r.c[k] || 0) + t.a; if (!r.big || t.a > r.big.a) r.big = t; } else if (t.k === "i") r.i += t.a; }); return r; };
  const A = agg(m), B = agg(pm), pct = (x, y) => y ? ((x - y) / y * 100).toLocaleString("tr-TR", { maximumFractionDigits: 0 }) + "%" : "–";
  const cl = (x, y, inv) => (x > y) !== !!inv ? "neg" : "pos";
  const ch = [...new Set([...Object.keys(A.c), ...Object.keys(B.c)])].map(k => [k, (A.c[k] || 0) - (B.c[k] || 0), A.c[k] || 0]).filter(x => Math.abs(x[1]) >= 1).sort((x, y) => y[1] - x[1]);
  const nm = k => k === "_" ? "Kategorisiz" : catLabel(k, true);
  const li = x => '<li><div class="set-row"><span class="grow"><b>' + esc(nm(x[0])) + '</b><br><span class="muted small">Bu ay ' + f2(x[2]) + '</span></span><b class="' + (x[1] > 0 ? "neg" : "pos") + '" style="white-space:nowrap">' + (x[1] > 0 ? "+" : "") + f2(x[1]) + '</b></div></li>';
  const up = ch.filter(x => x[1] > 0).slice(0, 5), dn = ch.filter(x => x[1] < 0).reverse().slice(0, 5);
  return '<div class="card"><div class="sum"><div>Gider<b class="neg">' + f2(A.e) + '</b><span class="small muted">' + mLabel(pm) + ': ' + f2(B.e) + ' (' + pct(A.e, B.e) + ')</span></div><div>Gelir<b class="pos">' + f2(A.i) + '</b><span class="small muted">' + f2(B.i) + ' (' + pct(A.i, B.i) + ')</span></div><div>Net<b class="' + (A.i - A.e < 0 ? "neg" : "pos") + '">' + f2(A.i - A.e) + '</b><span class="small muted">' + f2(B.i - B.e) + '</span></div></div></div>' +
    '<p class="small muted" style="margin:10px 2px">' + A.n + ' harcama' + (A.big ? ' · en büyük: ' + esc(A.big.t || nm(A.big.cat || "_")) + ' ' + f2(A.big.a) : '') + '</p>' +
    (up.length ? '<div class="day"><span>Artan harcamalar</span></div><div class="card"><ul class="list">' + up.map(li).join("") + '</ul></div>' : '') +
    (dn.length ? '<div class="day"><span>Azalan harcamalar</span></div><div class="card"><ul class="list">' + dn.map(li).join("") + '</ul></div>' : '') +
    (!up.length && !dn.length ? '<div class="empty">Geçen aya göre değişim yok.</div>' : '');
}
function renderSettings() {
  const v = D.view, Dd = derived();
  let h;
  if (v === "main") {
    h = head("Ayarlar") + '<div class="sh-bd">';
    const shr = meta().share, shUrl = shr && shr.token ? SITE + "/?s=" + shr.token : "";
    h += '<div class="sec-h"><h2>Paylaşım</h2></div><div class="card" style="padding:14px;margin-bottom:16px"><p class="small muted" style="margin:0 0 10px">Ödemeler, Nakit akışı ve Gider sayfalarınızı bağlantıya sahip kişilerle salt okunur paylaşın. Verileriniz değiştikçe paylaşılan sayfa kendiliğinden güncellenir.</p>' +
      (shUrl ? '<input class="in" readonly id="shurl" value="' + esc(shUrl) + '" style="margin-bottom:10px"><div class="chips"><button class="btn sm" data-act="sh-copy">Bağlantıyı kopyala</button><button class="btn sm ghost" data-act="sh-now">Şimdi güncelle</button><button class="btn sm ghost danger" data-act="sh-off">Paylaşımı kapat</button></div>'
        : '<button class="btn sm" data-act="sh-on">Paylaşım bağlantısı oluştur</button>') + '</div>';
    h += '<div class="sec-h"><h2>Görünüm</h2></div><div class="card" style="padding:14px;margin-bottom:16px"><label class="fld" style="margin:0"><span>Tema</span><select class="in" onchange="setTheme(this.value)"><option value="light"' + (document.documentElement.dataset.theme !== "dark" ? " selected" : "") + '>Açık</option><option value="dark"' + (document.documentElement.dataset.theme === "dark" ? " selected" : "") + '>Koyu</option></select></label></div>';
    h += '<div class="sec-h"><h2>Nakit akışı</h2></div><div class="card" style="padding:14px;margin-bottom:16px"><label class="fld" style="margin:0"><span>Maaş / dönem başlangıcı</span><select class="in" onchange="setSalDay(this.value)">' + [...Array(31)].map((_, i) => '<option value="' + (i + 1) + '"' + (salDay() === i + 1 ? " selected" : "") + '>' + (i ? "Ayın " + (i + 1) + "’i" : "Ayın 1’i (takvim ayı)") + '</option>').join("") + '</select></label><p class="small muted" style="margin:8px 0 0">Nakit akışındaki kalan para, bir sonraki maaş gününden önceki güne kadar hesaplanır.</p></div>';
    h += '<div class="sec-h"><h2>Veri</h2></div><div class="card" style="padding:14px">' +
      '<label class="btn sm ghost" style="display:inline-flex;align-items:center;margin:0 8px 8px 0">İçe aktar<input type="file" id="f-imp" accept=".csv,.tsv,.txt,.xlsx,.xls,.qif,.ofx,.qfx,.bak,.json" hidden></label>' +
      '<button class="btn sm ghost" style="margin:0 8px 8px 0" data-act="exp-json">Yedek indir</button><button class="btn sm ghost" style="margin:0 8px 8px 0" data-act="exp-csv">CSV indir</button>' +
      '<p class="small muted" style="margin:6px 0 0">İçe aktarma: Başka bütçe uygulamalarının (Money Manager, Spendee, Wallet, YNAB, Monefy, Toshl, Bluecoins, Mint, 1Money, Cashew, Money Lover vb.) ve bankaların CSV, Excel (.xlsx), QIF ve OFX dosyaları mevcut verilere eklenir; aynı işlemler tekrar eklenmez. Expense IQ .bak dosyası hesapları, kategorileri ve işlemleri değiştirir; bu uygulamanın .json yedeği ise içinde ne varsa onu yükler.</p></div>';
    { const ms = [...new Set(Dd.all.map(t => t.d.slice(0, 7)))].filter(m => m < CUR()).sort().reverse().slice(0, 24); if (ms.length) h += '<div class="sec-h" style="margin-top:20px"><h2>Aylık raporlar</h2></div><div class="card"><ul class="list">' + ms.map(m => '<li><button class="set-row" data-act="rep" data-m="' + m + '" data-back="1"><span class="grow">' + mLabel(m) + '</span>' + ICON.r + '</button></li>').join("") + '</ul></div>'; }
    if (NATIVE) h += '<div class="sec-h" style="margin-top:20px"><h2>Uygulama</h2></div><div class="card" style="padding:14px;display:flex;align-items:center;gap:10px"><span class="grow small" style="flex:1">Sürüm: ' + esc(OTA.cur || "…") + '<br><span id="ota-msg" class="muted">' + esc(OTA.msg || "") + '</span></span><button class="btn sm ghost" data-act="ota-check">Güncellemeleri kontrol et</button></div>';
    h += '<div class="sec-h" style="margin-top:20px"><h2>Oturum</h2></div><div class="card" style="padding:14px;display:flex;align-items:center;gap:10px"><span class="grow small" style="flex:1">' + esc(S.user && S.user.email || "") + '</span><button class="btn sm ghost" data-act="signout">Çıkış yap</button></div>';
    h += '<p class="small muted" style="text-align:center;margin:20px 0 4px">Bütçe v' + APP_VERSION + '</p></div>';
  } else if (v === "rep") {
    h = head(mLabel(D.m) + " raporu", "", D.back ? "set-back" : null) + '<div class="sh-bd">' + repHtml(D.m) + '</div>';
  } else if (v === "acc") {
    const a = D.acc;
    h = head(a._new ? "Hesap ekle" : "Hesabı düzenle") + '<div class="sh-bd">' +
      '<label class="fld"><span>Ad</span><input class="in" data-a="name" value="' + esc(a.name) + '"></label>' +
      '<div class="row2"><label class="fld"><span>Açılış bakiyesi</span><input class="in" inputmode="decimal" data-a="start" value="' + esc(amtIn(a.start)) + '"></label><label class="fld"><span>Renk</span><input class="in" type="color" data-a="color" value="' + esc(a.color) + '" style="height:46px;padding:4px"></label></div>' +
      '<div class="fld"><span>Logo</span><div class="logorow">' + (a.logo ? '<img class="alogo md" src="' + esc(a.logo) + '" alt="">' : '<span class="alogo md ph">' + svgI(CI.card) + '</span>') + '<input class="in" id="lgq" autocomplete="off" placeholder="Logo ara, örn. ziraat" value="' + esc(D.lgq || "") + '">' + (a.logo ? '<button class="btn sm ghost" data-act="acc-logo-rm">Kaldır</button>' : '') + '</div><div id="lgres" class="lgres"></div></div>' +
      '<label class="fld" style="display:flex;gap:10px;align-items:center"><input type="checkbox" data-kart' + (a.type === "kart" ? " checked" : "") + '> Bu hesap bir kredi kartı (Borçlar’a otomatik düşer)</label>' +
      (a.type === "kart" ? '<div class="plan"><div class="row2"><label class="fld"><span>Hesap kesim günü</span><input class="in" type="number" min="1" max="31" data-a="cut" value="' + (a.cut || "") + '"></label><label class="fld"><span>Son ödeme günü</span><input class="in" type="number" min="1" max="31" data-a="due" value="' + (a.due || "") + '"></label></div><label class="fld" style="margin:0"><span>Limit</span><input class="in" inputmode="decimal" data-a="limit" value="' + esc(amtIn(a.limit)) + '"></label></div>' : '') +
      '<label class="fld" style="display:flex;gap:10px;align-items:center"><input type="checkbox" data-a="exclude"' + (a.exclude ? " checked" : "") + '> Net bakiyeye dahil etme (kredi kartları için)</label>' +
      '<label class="fld" style="display:flex;gap:10px;align-items:center"><input type="checkbox" data-a="hidden"' + (a.hidden ? " checked" : "") + '> Gizle</label><div id="s-err"></div></div>' +
      '<div class="sh-ft">' + (a._new ? '' : '<button class="btn danger" data-act="acc-del">Sil</button>') + '<button class="btn" data-act="acc-save">Kaydet</button></div>';
  } else if (v === "cat") {
    const c = D.cat; const parents = meta().categories.filter(x => !x.parent && x.id !== c.id && x.type === c.type).sort((a, b) => a.name.localeCompare(b.name, "tr"));
    h = head(c._new ? "Kategori ekle" : "Kategoriyi düzenle") + '<div class="sh-bd">' +
      '<label class="fld"><span>Ad</span><input class="in" data-c="name" value="' + esc(c.name) + '"></label>' +
      '<div class="row2"><label class="fld"><span>Tür</span><select class="in" data-c="type"><option value="E"' + (c.type === "E" ? " selected" : "") + '>Gider</option><option value="I"' + (c.type === "I" ? " selected" : "") + '>Gelir</option></select></label><label class="fld"><span>Renk</span><input class="in" type="color" data-c="color" value="' + esc(c.color) + '" style="height:46px;padding:4px"></label></div>' +
      '<div class="fld"><span>İkon</span><div class="icgrid">' + ["", ...Object.keys(CI).filter(k => k !== "swap")].map(k => '<button class="icb" data-act="cat-icon" data-v="' + k + '" style="--c:' + c.color + '" aria-pressed="' + (!c.img && (c.icon || "") === k) + '">' + (k ? svgI(CI[k]) : "Oto") + '</button>').join("") + '</div><div style="display:flex;gap:8px;align-items:center;margin-top:10px">' + (c.img ? '<span class="cic" style="--c:' + c.color + '"><img src="' + c.img + '" alt=""></span><button class="btn sm ghost" data-act="cat-img-rm">Görseli kaldır</button>' : '') + '<label class="btn sm ghost" style="display:inline-flex;align-items:center">Kendi görselini yükle<input type="file" accept="image/*" id="cat-img" hidden></label></div></div>' +
      '<label class="fld"><span>Üst kategori</span><select class="in" data-c="parent"><option value="">Yok (ana kategori)</option>' + parents.map(p => '<option value="' + esc(p.id) + '"' + (c.parent === p.id ? " selected" : "") + '>' + esc(p.name) + '</option>').join("") + '</select></label><div id="s-err"></div></div>' +
      '<div class="sh-ft">' + (c._new ? '' : '<button class="btn danger" data-act="cat-del">Sil</button>') + '<button class="btn" data-act="cat-save">Kaydet</button></div>';
  } else if (v === "gt") {
    const ex = catTree().filter(({ c }) => c.type === "E");
    const grpH = (g, l) => '<label class="fld"><span>Grup adı</span><input class="in" data-gn="' + g.replace("g", "n") + '" value="' + esc(D[g.replace("g", "n")] || l) + '"></label><div class="chips" style="margin-bottom:8px">' + (D[g].length ? D[g].map((id, i) => '<span class="chip" style="padding:4px 6px 4px 10px"><i style="background:' + (id.startsWith("p:") ? "var(--tr)" : catColor(id)) + '"></i><span' + ((D.hid || []).includes(id) ? ' style="opacity:.45;text-decoration:line-through"' : '') + '>' + esc(id.startsWith("p:") ? id.slice(2) : catLabel(id, true)) + '</span> <button class="ib" style="width:26px;height:26px" data-act="gt-hide" data-id="' + esc(id) + '" aria-label="Gizle">' + ((D.hid || []).includes(id) ? ICON.eyeoff : ICON.eye) + '</button><button class="ib" style="width:26px;height:26px" data-act="gt-mv" data-g="' + g + '" data-i="' + i + '" data-d="-1" aria-label="Sola taşı"' + (i === 0 ? ' disabled' : '') + '>' + ICON.l + '</button><button class="ib" style="width:26px;height:26px" data-act="gt-mv" data-g="' + g + '" data-i="' + i + '" data-d="1" aria-label="Sağa taşı"' + (i === D[g].length - 1 ? ' disabled' : '') + '>' + ICON.r + '</button><button class="ib" style="width:26px;height:26px" data-act="gt-rm" data-g="' + g + '" data-i="' + i + '" aria-label="Kaldır">' + ICON.x + '</button></span>').join("") : '<span class="small muted">Henüz sütun yok.</span>') + '</div><div class="row2" style="margin-bottom:18px"><div><div class="catsel cat-search">' + ICON.search + '<input data-gtq="' + g + '" autocomplete="off" placeholder="Kategori ara…"></div><div class="tx-catlist" id="gtl-c-' + g + '"></div></div><div><div class="catsel cat-search">' + ICON.search + '<input data-gtpq="' + g + '" autocomplete="off" placeholder="Lehdar ara…"></div><div class="tx-catlist" id="gtl-p-' + g + '"></div></div></div>';
    h = head("Gider tablosu sütunları") + '<div class="sh-bd"><p class="small muted" style="margin-top:0">Her grubun sonunda bir ara toplam sütunu olur. Ana kategori seçerseniz alt kategorileri de dahil edilir. Çıkarmak için sütuna dokunun.</p>' + grpH("g1", "1. grup") + grpH("g2", "2. grup") + '</div><div class="sh-ft"><button class="btn" data-act="gt-save">Kaydet</button></div>';
  } else if (v === "ci") {
    const c = D.ci, mon = c.rep !== "once";
    h = head(c._new ? (c.k === "inc" ? "Gelir ekle" : "Gider ekle") : "Düzenle") + '<div class="sh-bd">' +
      '<div class="seg" style="display:flex;margin-bottom:14px"><button style="flex:1" data-act="ci-k" data-v="inc" aria-pressed="' + (c.k === "inc") + '">Gelir</button><button style="flex:1" data-act="ci-k" data-v="exp" aria-pressed="' + (c.k !== "inc") + '">Gider</button></div>' +
      '<label class="fld"><span>Ad</span><input class="in" data-ci="name" value="' + esc(c.name) + '" placeholder="Örn. Maaş, Faturalar"></label>' +
      '<label class="fld"><span>Tutar</span><input class="in amt" inputmode="decimal" data-ci="a" value="' + esc(c.a) + '" placeholder="0,00"></label>' +
      '<div class="seg" style="display:flex;margin-bottom:14px"><button style="flex:1" data-act="ci-rep" data-v="m" aria-pressed="' + mon + '">Her ay</button><button style="flex:1" data-act="ci-rep" data-v="once" aria-pressed="' + !mon + '">Tek seferlik</button></div>' +
      (mon ? '<div class="row2"><label class="fld"><span>Ayın kaçında</span><input class="in" type="number" min="1" max="31" data-ci="day" value="' + (c.day || "") + '"></label><label class="fld"><span>Başlangıç ayı</span><input class="in" type="month" data-ci="start" value="' + (c.start || CUR()) + '"></label></div><label class="fld"><span>Bitiş ayı (isteğe bağlı)</span><input class="in" type="month" data-ci="end" value="' + (c.end || "") + '"></label>' + (c._new ? '' : '<label class="fld"><span>Tutar değiştiyse, yeni tutarın başladığı ay</span><input class="in" type="month" data-ci="eff" value="' + (c.eff || CUR()) + '"></label>')
        : '<label class="fld"><span>Tarih</span><input class="in" type="date" data-ci="date" value="' + (c.date || today()) + '"></label>') +
      (c.k !== "inc" ? payList() : '') +
      '<div id="s-err"></div></div><div class="sh-ft">' + (c._new ? '' : '<button class="btn danger" data-act="ci-del">Sil</button>') + '<button class="btn" data-act="ci-save">Kaydet</button></div>';
  } else if (v === "imp") {
    const p = D.imp, body = p.kind === "tab" ? impTabHtml(p) : p.summary, n = p.kind === "tab" ? p.res.add.length : 1;
    h = head("İçe aktarma", "", "set-back") + '<div class="sh-bd">' + body + '</div><div class="sh-ft"><button class="btn ghost" data-act="set-back">Vazgeç</button><button class="btn" data-act="imp-go"' + (n ? '' : ' disabled') + '>İçe aktar' + (p.kind === "tab" && n ? ' (' + n + ')' : '') + '</button></div>';
  }
  const same = dlg.open && renderSettings._v === v; renderSettings._v = v;
  openSheet(h, same);
}
function catTree() {
  const cats = meta().categories, out = [];
  const byName = (a, b) => (a.type === b.type ? 0 : a.type === "E" ? -1 : 1) || a.name.localeCompare(b.name, "tr");
  cats.filter(c => !c.parent).sort(byName).forEach(p => { out.push({ c: p, depth: 0 }); cats.filter(c => c.parent === p.id).sort(byName).forEach(c => out.push({ c, depth: 1 })); });
  return out;
}
window.setTheme = v => { applyTheme(v); saveMetaChange(m => { m.theme = v; }); render(); };
window.setSalDay = v => { saveMetaChange(m => { m.salaryDay = Number(v) || 1; }); render(); toast("Kaydedildi"); };
function saveMetaChange(fn) {
  if (!S.loaded.meta) { toast("Veriler henüz yüklenmedi, biraz sonra tekrar deneyin."); return; }
  const m = clone(meta()); fn(m); S.meta = m; bump(); S.store.setMeta(m);
}

function impRun(p) {
  const r = C.convertTable(p.tab, p.map, { ...p.opt, fmt: p.fmt });
  p.bad = r.bad.length; p.order = r.order;
  p.res = C.mergeImport(meta(), S.months, r.recs, { defAcc: p.opt.defAcc });
  return p;
}
function impTabHtml(p) {
  const col = i => p.tab.body.map(r => r[i]).find(v => v) || "";
  const sel = (f, l) => '<label class="fld"><span>' + l + '</span><select class="in" data-im="' + f + '"><option value="">—</option>' + p.tab.head.map((hd, i) => '<option value="' + i + '"' + (p.map[f] === i ? " selected" : "") + '>' + esc(hd) + (col(i) ? ' (' + esc(String(col(i)).slice(0, 24)) + ')' : '') + '</option>').join("") + '</select></label>';
  const opt = (k, l, list) => '<label class="fld"><span>' + l + '</span><select class="in" data-io="' + k + '">' + list.map(([v, t]) => '<option value="' + esc(v) + '"' + (String(p.opt[k]) === String(v) ? " selected" : "") + '>' + esc(t) + '</option>').join("") + '</select></label>';
  const r = p.res, add = r.add, ds = add.map(t => t.d).sort(), cnt = k => add.filter(t => t.k === k).length;
  const missing = p.map.date == null || (p.map.amount == null && p.map.out == null && p.map.in == null);
  let h = '<p>' + esc(p.fmt || p.kind) + ' dosyası okundu: ' + p.tab.body.length + ' satır.</p>';
  if (missing) h += '<p class="err">Tarih ve tutar sütunlarını aşağıdan seçin.</p>';
  h += '<details class="card" style="padding:10px 14px;margin-bottom:12px"' + (missing ? " open" : "") + '><summary class="small" style="cursor:pointer">Sütun eşleştirme</summary><div style="margin-top:8px">' + C.IMP_FIELDS.map(([f, l]) => sel(f, l)).join("") + '</div></details>';
  h += opt("order", "Tarih biçimi", [["auto", "Otomatik (" + (p.order === "mdy" ? "ay/gün/yıl" : "gün/ay/yıl") + ")"], ["dmy", "Gün/ay/yıl"], ["mdy", "Ay/gün/yıl"]]);
  if (p.map.type == null && p.map.out == null && p.map.in == null) h += opt("sign", "Tutarlar", [["auto", "Eksi gider, artı gelir"], ["e", "Hepsi gider"], ["i", "Hepsi gelir"]]);
  if (p.map.account == null) h += opt("defAcc", "Hangi hesaba eklensin", visibleAccs().map(a => [a.id, a.name]));
  if (add.length) {
    h += '<div class="card" style="padding:12px 14px;margin:12px 0"><div>' + add.length + ' işlem eklenecek' + ' (' + [[cnt("e"), "gider"], [cnt("i"), "gelir"], [cnt("tr"), "transfer"]].filter(x => x[0]).map(x => x[0] + " " + x[1]).join(", ") + ')</div><div class="small muted">' + ds[0] + ' ile ' + ds[ds.length - 1] + ' arası</div>' +
      (r.dup ? '<div class="small muted">' + r.dup + ' işlem zaten var, atlanacak.</div>' : '') + (p.bad ? '<div class="small muted">' + p.bad + ' satır okunamadı (tarih ya da tutar yok), atlanacak.</div>' : '') +
      (r.newAccs.length ? '<div class="small" style="margin-top:6px">Yeni hesaplar: ' + esc(r.newAccs.join(", ")) + '</div>' : '') +
      (r.newCats.length ? '<div class="small" style="margin-top:4px">Yeni kategoriler: ' + esc(r.newCats.slice(0, 12).join(", ")) + (r.newCats.length > 12 ? " ve " + (r.newCats.length - 12) + " tane daha" : "") + '</div>' : '') + '</div>';
    const am = Object.fromEntries(r.meta.accounts.map(a => [a.id, a.name])), cm = Object.fromEntries(r.meta.categories.map(c => [c.id, c.name]));
    h += '<div class="card"><ul class="list">' + add.slice(0, 8).map(t => '<li><div class="set-row"><span class="grow"><b>' + esc(t.t || (t.k === "tr" ? am[t.acc] + " → " + am[t.to] : cm[t.cat] || "Kategorisiz")) + '</b><span class="small muted" style="display:block">' + t.d + ' · ' + esc(am[t.acc] || "") + (t.t && t.cat ? ' · ' + esc(cm[t.cat] || "") : '') + '</span></span><span class="' + (t.k === "e" ? "neg" : t.k === "i" ? "pos" : "") + '" style="white-space:nowrap">' + (t.k === "e" ? "-" : t.k === "i" ? "+" : "") + f2(t.a) + '</span></div></li>').join("") + '</ul></div>' + (add.length > 8 ? '<p class="small muted">… ve ' + (add.length - 8) + ' işlem daha.</p>' : '');
  } else if (!missing) h += '<p class="small muted" style="margin-top:12px">' + (r.dup ? 'Dosyadaki ' + r.dup + ' işlemin hepsi zaten var.' : 'Eklenecek işlem bulunamadı. Sütun eşleştirmesini kontrol edin.') + '</p>';
  return h;
}
async function handleImport(file) {
  const buf = await file.arrayBuffer(), text = C.decodeText(buf);
  try {
    if (!/^\[EASYMONEY_BACKUP/.test(text) && !/^\s*\{/.test(text)) {
      const tab = await C.readImportFile(file.name, buf);
      if (!tab.body.length) throw new Error("Dosyada işlem bulunamadı.");
      const fmt = C.detectFormat(tab.head);
      D.imp = impRun({ kind: "tab", tab, fmt: fmt || (tab.kind === "CSV" || tab.kind === "TXT" ? null : tab.kind), map: C.autoMap(tab), opt: { order: "auto", sign: "auto", defAcc: (visibleAccs()[0] || {}).id } });
      if (!D.imp.fmt) D.imp.fmt = tab.kind;
    } else if (/^\[EASYMONEY_BACKUP/.test(text)) {
      const conv = C.convertExpenseIQ(C.parseExpenseIQBackup(text));
      const bal = C.accountBalances(conv.accounts, conv.txs);
      const ds = conv.txs.map(t => t.d).sort();
      D.imp = { kind: "eiq", conv };
      D.imp.summary = '<p>Expense IQ yedeği okundu.</p><div class="card" style="padding:12px 14px;margin-bottom:12px"><div>' + conv.accounts.length + ' hesap, ' + conv.categories.length + ' kategori, ' + conv.txs.length + ' işlem</div><div class="small muted">' + ds[0] + ' ile ' + ds[ds.length - 1] + ' arası</div></div><div class="card"><ul class="list">' + conv.accounts.map(a => '<li><div class="set-row"><i style="background:' + a.color + '"></i><span class="grow">' + esc(a.name) + '</span><span class="' + (bal[a.id] < 0 ? "neg" : "") + '">' + f2(bal[a.id]) + '</span></div></li>').join("") + '</ul></div><p class="small muted">Mevcut hesaplar, kategoriler ve işlemler bu yedekle değiştirilecek. Borçlar etkilenmez.</p>';
    } else {
      const j = JSON.parse(text);
      D.imp = { kind: "json", j };
      const parts = []; if (j.meta) parts.push(j.meta.accounts.length + " hesap, " + j.meta.categories.length + " kategori"); if (j.months) parts.push(Object.values(j.months).flat().length + " işlem"); if (j.debts) parts.push(Object.keys(j.debts).length + " borç");
      if (!parts.length) throw new Error("Dosyada tanınan veri yok.");
      D.imp.summary = '<p>Yedek okundu: ' + parts.join(", ") + '.</p><p class="small muted">' + (j.months ? "Dosyadaki işlemler mevcut işlemlerin yerini alacak. " : "") + (j.debts ? "Aynı isimli borçlar güncellenir, diğerleri eklenir." : "") + '</p>';
    }
    D.view = "imp"; renderSettings();
  } catch (e) { console.error(e); toast(e.message || "Dosya okunamadı."); }
}
async function applyImport() {
  const p = D.imp, ops = [];
  const btn = dlgIn.querySelector('[data-act="imp-go"]'); if (btn) { btn.disabled = true; btn.textContent = "Aktarılıyor…"; }
  try {
    if (p.kind === "tab") {
      impRun(p); const touched = {};
      p.res.add.forEach(t => { const m = t.d.slice(0, 7); (touched[m] = touched[m] || (S.months[m] || []).slice()).push(t); });
      ops.push({ op: "set", path: ["meta", "main"], data: p.res.meta });
      Object.entries(touched).forEach(([m, items]) => ops.push({ op: "set", path: ["tx", m], data: { items: items.sort((a, b) => (a.ts || 0) - (b.ts || 0)) } }));
    } else if (p.kind === "eiq") {
      const months = C.groupByMonth(p.conv.txs);
      // Akıllı birleştirme: mevcut ayarları (kesim/ödeme günü, limit, düzenli ödemeler, düzen) koru
      const old = meta(), nm = s => String(s || "").toLocaleLowerCase("tr-TR").trim(), idMap = {};
      const accounts = p.conv.accounts.map(a => { const o = (old.accounts || []).find(x => nm(x.name) === nm(a.name)); if (!o) return a; idMap[o.id] = a.id; return { ...o, ...a, cut: o.cut, due: o.due, limit: o.limit, order: o.order, hidden: o.hidden, exclude: o.exclude, color: o.color || a.color }; });
      (old.categories || []).forEach(o => { const c = p.conv.categories.find(x => x.type === o.type && nm(x.name) === nm(o.name)); if (c) idMap[o.id] = c.id; });
      let rest = { ...old }; delete rest.accounts; delete rest.categories;
      let js = JSON.stringify(rest); Object.entries(idMap).forEach(([o, n]) => { if (o !== n) js = js.split('"' + o + '"').join('"' + n + '"'); });
      ops.push({ op: "set", path: ["meta", "main"], data: { ...JSON.parse(js), accounts, categories: p.conv.categories, ver: old.ver || 1 } });
      Object.keys(S.months).forEach(m => { if (!months[m]) ops.push({ op: "del", path: ["tx", m] }); });
      Object.entries(months).forEach(([m, items]) => ops.push({ op: "set", path: ["tx", m], data: { items } }));
    } else {
      const j = p.j;
      if (j.meta) ops.push({ op: "set", path: ["meta", "main"], data: j.meta });
      if (j.months) { Object.keys(S.months).forEach(m => { if (!j.months[m]) ops.push({ op: "del", path: ["tx", m] }); }); Object.entries(j.months).forEach(([m, items]) => ops.push({ op: "set", path: ["tx", m], data: { items } })); }
      if (j.debts) Object.entries(j.debts).forEach(([id, d]) => ops.push({ op: "set", path: ["debts", id], data: d }));
    }
    await S.store.bulk(ops);
    closeSheet(); toast("İçe aktarıldı");
  } catch (e) { console.error(e); toast("İçe aktarma başarısız: " + (e.code || e.message)); if (btn) { btn.disabled = false; btn.textContent = "İçe aktar"; } }
}
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type })); const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ============ events ============ */
document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]"); if (!el) return;
  const a = el.dataset.act, ds = el.dataset;
  switch (a) {
    case "signin": S.authErr = ""; S.store.signIn().catch(err => { S.authErr = authMsg(err); render(); }); break;
    case "signout": closeSheet(); S.store.signOut(); break;
    case "bub": S.bub = S.bub === ds.v || !ds.v ? null : ds.v; render(); break;
    case "nav": S.stmt = null; S.sel = null; S.bub = null; S.dashEdit = false; S.dashDraft = null; S.dashTray = false; S.view = ds.v; S.catF = null; S.payF = null; S.fYear = null; if (ds.v === "tx") { S.month = S.month || CUR(); S.accFs = []; S.q = ""; S.showFutTx = false; } if (location.hash.slice(1) !== ds.v) location.hash = ds.v; render(); window.scrollTo(0, 0); break;
    case "mprev": S.month = C.addM(S.month, -1); render(); break;
    case "hprev": S.hm = C.addM(S.hm || CUR(), -1); render(); break;
    case "hnext": S.hm = C.addM(S.hm || CUR(), 1); render(); break;
    case "mnext": S.month = C.addM(S.month, 1); render(); break;
    case "stmt": { const a = meta().accounts.find(x => x.id === ds.id); if (!a) break; S.stmt = { acc: a.id, off: 0, r: stmtRange(a.cut || 1) }; S.view = "tx"; S.sel = null; if (location.hash.slice(1) !== "tx") location.hash = "tx"; render(); window.scrollTo(0, 0); break; }
    case "stmt-per": { const a = meta().accounts.find(x => x.id === S.stmt.acc); S.stmt.off += +ds.v; S.stmt.r = stmtRange(a.cut || 1, new Date(), S.stmt.off); stmtRun(); render(); break; }
    case "stmt-close": S.stmt = null; render(); break;
    case "rep": { const m = ds.m; D = { view: "rep", m, back: !!ds.back }; renderSettings(); if (!(meta().reportSeen || {})[m] && S.loaded.meta) saveMetaChange(x => { x.reportSeen = { ...(x.reportSeen || {}), [m]: 1 }; }); break; }
    case "stmt-pick": { const R = S.stmt.res; let b; if (ds.di != null) { const x = R.diff[+ds.di]; b = x.b; S.stmt.pick = { b, ids: [x.t.id] }; } else { b = R.missing[+ds.i]; S.stmt.pick = { b, ids: [] }; } render(); window.scrollTo(0, 0); break; }
    case "stmt-pick-x": S.stmt.pick = null; stmtRun(); render(); break;
    case "stmt-ck": { const pk = S.stmt.pick; if (!pk) break; const k = pk.ids.indexOf(ds.id); k >= 0 ? pk.ids.splice(k, 1) : pk.ids.push(ds.id); render(); break; }
    case "stmt-link": { const pk = S.stmt.pick, acc = S.stmt.acc; if (!pk || !pk.ids.length) break; const L = { d: pk.b.d, a: pk.b.a, ids: pk.ids.slice() }; S.stmt.pick = null; saveMetaChange(m => { m.stmtLinks = m.stmtLinks || {}; m.stmtLinks[acc] = (m.stmtLinks[acc] || []).filter(l => !(l.d === L.d && Math.abs(l.a - L.a) < 0.01)).concat(L); }); stmtRun(); render(); toast("Eşleştirildi"); break; }
    case "stmt-unlink": { const acc = S.stmt.acc, d = ds.d, a0 = +ds.a; saveMetaChange(m => { if (m.stmtLinks && m.stmtLinks[acc]) m.stmtLinks[acc] = m.stmtLinks[acc].filter(l => !(l.d === d && Math.abs(l.a - a0) < 0.01)); }); stmtRun(); render(); break; }
    case "stmt-up": { const inp = document.createElement("input"); inp.type = "file"; inp.accept = "application/pdf,.pdf"; inp.onchange = async () => { const f = inp.files[0]; if (!f || !S.stmt) return; S.stmt.busy = true; S.stmt.err = null; render(); try { const bank = parseStatementLines(await pdfLines(f)); if (!bank.length) throw new Error("PDF'te işlem satırı bulunamadı."); S.stmt.bank = bank.filter(b => b.d >= S.stmt.r[0] && b.d <= S.stmt.r[1]).length ? bank.filter(b => b.d >= S.stmt.r[0] && b.d <= S.stmt.r[1]) : bank; stmtRun(); } catch (e) { console.error(e); S.stmt.err = e.message && e.message.includes("bulunamadı") ? e.message : "PDF okunamadı."; } S.stmt.busy = false; render(); }; inp.click(); break; }
    case "stmt-add": { const b = S.stmt.res.missing[+ds.i]; if (b) { S._stmtAdd = b; openTx({ k: "e", acc: S.stmt.acc, t: b.t, d: b.d, a: b.a }); } break; }
    case "stmt-fix": { const x = S.stmt.res.diff[+ds.i]; if (!x) break; const m = x.t.d.slice(0, 7), arr = monthItems(m).map(t => t.id === x.t.id ? { ...t, a: C.r2(x.b.a) } : t); S.months[m] = arr; saveMonth(m, arr); stmtRun(); render(); toast && toast("Tutar düzeltildi"); break; }
    case "acc-tx": S.stmt = null; S.view = "tx"; S.accFs = [ds.id]; S.catF = null; S.payF = null; S.q = ""; S.per = "all"; if (location.hash.slice(1) !== "tx") location.hash = "tx"; render(); window.scrollTo(0, 0); break;
    case "add": openTx({}); break;
    case "fav": { const f = derived().favs[+ds.i]; openTx({ k: f.k, cat: f.cat, acc: f.acc, t: f.t }); break; }
    case "edit-tx": if (S.selSkip) { S.selSkip = false; break; } if (S.sel) { if (S.sel[ds.id]) delete S.sel[ds.id]; else S.sel[ds.id] = ds.m; if (!Object.keys(S.sel).length) S.sel = null; render(); break; } openTx({ id: ds.id, m: ds.m }); break;
    case "add-sub": openTx({ k: "e" }); if (D) { D.rep = "mon"; D.open = true; renderTx(true); } break;
    case "mod-go": { if (S.dashEdit) break; const v = ds.v; S.catF = null; S.payF = null; S.fYear = null; S.bub = null;
      if (v.startsWith("g:")) { S.view = "tx"; S.per = "30"; S.accFs = []; S.q = ""; S.showPastTx = true; S.showFutTx = false; S.showE = v === "g:e"; S.showI = v === "g:i"; } else S.view = v;
      if (location.hash.slice(1) !== S.view) location.hash = S.view; render(); window.scrollTo(0, 0); break; }
    case "close": closeSheet(); break;
    case "sel-x": S.sel = null; render(); break;
    case "sel-del": { const ids = Object.keys(S.sel || {}); if (!ids.length) break; const sel = S.sel, all = derived().all, txOf = id => all.find(x => x.id === id), subs = ids.filter(id => { const t = txOf(id); return t && t.grp && !t.ins; });
      const q = subs.length ? ask("Seçilenlerin " + subs.length + " tanesi abonelik. Abonelikleri ne yapalım?", [{ l: "Sadece seçili işlemleri sil", v: "sel", red: 1 }, { l: "Abonelikleri tut, diğerlerini sil", v: "keep", red: 1 }, { l: "Seçilileri ve gelecek abonelikleri de sil", v: "fut", red: 1 }]) : ask("Seçilen " + ids.length + " işlem silinsin mi?").then(v => v ? "sel" : null);
      q.then(mode => { if (!mode) return; const del = new Set(mode === "keep" ? ids.filter(id => !subs.includes(id)) : ids), from = {};
        if (mode === "fut") { subs.forEach(id => { const t = txOf(id); if (!from[t.grp] || t.d < from[t.grp]) from[t.grp] = t.d; }); if ((meta().recs || []).some(r => from[r.grp])) saveMetaChange(m => { m.recs = (m.recs || []).filter(r => !from[r.grp]); }); }
        let n = 0; const ms = new Set(Object.values(sel)); if (mode === "fut") Object.keys(S.months).forEach(m => ms.add(m));
        ms.forEach(m => { const arr = monthItems(m), keep = arr.filter(x => !del.has(x.id) && !(x.grp && from[x.grp] && x.d >= from[x.grp])); if (keep.length !== arr.length) { n += arr.length - keep.length; S.months[m] = keep; try { saveMonth(m, keep); } catch (e) { console.error(e); } } });
        S.sel = null; render(); toast(n + " işlem silindi"); }); break; }
    case "tx-k": { const k = ds.v; if (k === D.k) break; D.k = k; D.cat = null; D.catOpen = false; if (k === "tr") { D.to = visibleAccs().find(x => x.id !== D.acc)?.id || null; } else if (!D.accTouched) D.acc = lastAccFor(k); renderTx(true); break; }
    case "tx-acc": D[ds.f] = ds.id; if (ds.f === "acc") D.accTouched = true; dlgIn.querySelectorAll('[data-act="tx-acc"][data-f="' + ds.f + '"]').forEach(b => b.setAttribute("aria-pressed", b.dataset.id === ds.id)); break;
    case "cat-open": D.catOpen = !D.catOpen; D.cq = ""; D.spPick = null; renderTx(true); if (D.catOpen) $("#cq")?.focus(); break;
    case "gt-add": if (!D[ds.g].includes(ds.v)) D[ds.g].push(ds.v); renderSettings(); break;
    case "tx-cat": if (D.spPick != null) { D.sp[D.spPick].cat = ds.id; D.spPick = null; renderTx(true); break; } D.cat = ds.id; D.catOpen = false; D.cq = ""; renderTx(true); dlgIn.querySelector('[data-act="cat-open"]')?.focus(); break;
    case "sp-toggle": if (D.sp && D.sp.length) D.sp = null; else { const a = C.parseAmt(D.aStr) || 0; D.sp = [{ cat: D.cat, a: a ? amtIn(a) : "" }, { cat: null, a: "" }]; } D.spPick = null; renderTx(true); break;
    case "sp-add": D.sp.push({ cat: null, a: "" }); renderSpBox(); break;
    case "sp-rm": D.sp.splice(+ds.i, 1); if (!D.sp.length) D.sp = null; renderTx(true); break;
    case "sp-cat": D.spPick = +ds.i; D.catOpen = false; renderTx(true); break;
    case "tx-day": D.d = C.ymd(new Date(Date.now() + Number(ds.v) * 864e5)); renderTx(true); break;
    case "tx-rep": D.rep = ds.v; D.plan = null; D.planEdited = false; if (ds.v !== "one" && D.cnt < 2) D.cnt = 2; renderTx(true); break;
    case "sugg": { const p = derived().payees.find(x => x.t === ds.t); if (p) { D.t = p.t; if (p.cat) D.cat = p.cat; if (p.acc && !D.accTouched) D.acc = p.acc; } renderTx(true); setTimeout(() => $("#f-amt") && !$("#f-amt").value && $("#f-amt").focus(), 30); break; }
    case "tx-save": saveTx(!!ds.more); break;
    case "tx-del": if (D.grp) { const rd = 'style="background:var(--exp);color:#fff;border-color:var(--exp)"'; dlgIn.querySelector(".sh-ft").innerHTML = '<button class="btn ghost" data-act="tx-del-x">Vazgeç</button><button class="btn" ' + rd + ' data-act="tx-del-one">İşlemi sil</button><button class="btn" ' + rd + ' data-act="tx-del-rest">Gelecek işlemleri de sil</button>'; } else ask("Bu işlem silinsin mi?").then(v => v && deleteTx(false)); break;
    case "tx-del-one": deleteTx(false); break;
    case "tx-del-rest": deleteTx(true); break;
    case "tx-del-x": renderTx(true); break;
    case "toggle-paid": { if (ds.src === "acc") { const col = debtCols().find(([id]) => id === ds.id); if (!col) break; const it = col[1].sched[+ds.i]; const v = !isPaid(col[1], it); saveMetaChange(m => { const a = m.accounts.find(x => x.id === ds.id); a.paid = { ...(a.paid || {}), [it.m]: v }; }); render(); break; }
      const d = S.debts[ds.id]; if (!d) break; const it = d.sched[+ds.i]; it.p = !isPaid(d, it); S.store.setDebt(ds.id, d); render(); break; }
    case "borc-mine": S.borcMine = ds.v === "1"; render(); break;
    case "new-debt": openDebt(null); break;
    case "edit-debt": openDebt(ds.id); break;
    case "d-kind": D.kind = ds.v; renderDebt(true); break;
    case "d-payer": D.payer = ds.v; el.parentNode.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === ds.v)); break;
    case "d-paid": { const it = D.sched[+ds.i]; it.p = !isPaid(D, it); refreshSched(); break; }
    case "d-delrow": D.sched.splice(+ds.i, 1); refreshSched(); break;
    case "d-addrow": { const last = D.sched[D.sched.length - 1]; D.sched.push({ m: last ? C.addM(last.m, 1) : CUR(), a: last ? last.a : 0 }); refreshSched(); const w = $("#schedwrap"); w.scrollTop = w.scrollHeight; break; }
    case "d-plan": $("#planbox").innerHTML = planHtml(); break;
    case "d-plan-go": if (applyPlan()) renderDebt(true); break;
    case "d-save": saveDebt(); break;
    case "d-close": { if (!D._id) break; const d = S.debts[D._id]; if (!d) break; const nw = !d.closed; if (nw && !confirm("Bu borç kapatıldı olarak işaretlensin mi? Listede görünmeyecek.")) break;
      d.closed = nw; S.store.setDebt(D._id, d); closeSheet(); render(); toast(nw ? "Borç kapatıldı" : "Borç geri açıldı"); break; }
    case "d-del": ask("Bu borç ve tüm taksitleri silinsin mi?").then(v => { if (!v) return; const id = D._id; delete S.debts[id]; S.store.delDebt(id); closeSheet(); render(); toast("Silindi"); }); break;
    case "ttab": S.tTab = ds.v; S._toCur = true; render(); break;
    case "year": S.year = +ds.v; S._toCur = true; render(); break;
    case "tkind": S.tKind = ds.v; render(); break;
    case "expand": S.expanded.has(ds.k) ? S.expanded.delete(ds.k) : S.expanded.add(ds.k); render(); break;
    case "onlymine": S.onlyMine = ds.v === "1"; render(); break;
    case "settings": openSettings(); break;
    case "ota-check": { const m = document.getElementById("ota-msg"); const bt = e.target.closest("button"); if (bt) { bt.disabled = true; bt.textContent = "Kontrol ediliyor…"; } if (m) m.textContent = "";
      otaCheck(true).then(r => { OTA.msg = r.s === "ok" ? "✓ Uygulama güncel" : r.s === "upd" ? "Güncelleniyor…" : "Sunucuya ulaşılamadı"; const m2 = document.getElementById("ota-msg"); if (m2) m2.textContent = OTA.msg; if (bt) { bt.disabled = false; bt.textContent = "Güncellemeleri kontrol et"; } toast(OTA.msg); }); break; }
    case "acct": openSettings(); break;
    case "set-back": D.view = "main"; renderSettings(); break;
    case "acc-new": D = { view: "acc" }; D.acc = { _new: true, id: "a-" + C.rid(), name: "", type: "banka", color: "#3166c9", start: 0, exclude: false, hidden: false, order: meta().accounts.length }; renderSettings(); break;
    case "acc-edit": D = { view: "acc" }; D.acc = clone(meta().accounts.find(x => x.id === ds.id)); renderSettings(); break;
    case "acc-save": { const a = D.acc; if (!a.name || !a.name.trim()) { $("#s-err").innerHTML = '<p class="err">Hesap adı girin.</p>'; break; } const isNew = a._new; delete a._new; a.name = a.name.trim(); a.cut = parseInt(a.cut) || null; a.due = parseInt(a.due) || null; a.limit = a.limit == null || a.limit === "" ? null : (C.parseAmt(a.limit) || null);
      saveMetaChange(m => { const i = m.accounts.findIndex(x => x.id === a.id); if (i >= 0) m.accounts[i] = a; else m.accounts.push(a); }); closeSheet(); render(); toast(isNew ? "Hesap eklendi" : "Kaydedildi"); break; }
    case "cat-new": D = { view: "cat" }; D.cat = { _new: true, id: "c-" + C.rid(), name: "", type: "E", parent: null, color: "#6b7f8c" }; renderSettings(); break;
    case "cat-edit": D = { view: "cat" }; D.cat = clone(meta().categories.find(x => x.id === ds.id)); renderSettings(); break;
    case "cat-save": { const c = D.cat; if (!c.name || !c.name.trim()) { $("#s-err").innerHTML = '<p class="err">Kategori adı girin.</p>'; break; } const isNew = c._new; delete c._new; c.name = c.name.trim(); c.parent = c.parent || null;
      saveMetaChange(m => { const i = m.categories.findIndex(x => x.id === c.id); if (i >= 0) m.categories[i] = c; else m.categories.push(c); }); closeSheet(); render(); toast(isNew ? "Kategori eklendi" : "Kaydedildi"); break; }
    case "imp-go": applyImport(); break;
    case "sh-on": { const t = Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, "0")).join(""); saveMetaChange(mm => { mm.share = { token: t }; }); scheduleShare(true); renderSettings(); break; }
    case "sh-copy": { const u = $("#shurl").value; (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(() => toast("Bağlantı kopyalandı"), () => { $("#shurl").select(); toast("Bağlantıyı seçip kopyalayın"); }); break; }
    case "sh-now": scheduleShare(true); break;
    case "sh-off": { if (!confirm("Paylaşım kapatılsın mı? Bağlantı artık açılmayacak.")) break; const t = (meta().share || {}).token; if (t) S.store.delShare(t); saveMetaChange(mm => { delete mm.share; }); renderSettings(); toast("Paylaşım kapatıldı"); break; }
    case "cash-tick": { const r = ds.ref.split("|");
      if (r[0] === "ci") { saveMetaChange(mm => { const it = ((mm.cash || {}).items || []).find(x => x.id === r[1]); if (!it) return; it.skip = it.skip || []; const k = it.skip.indexOf(r[2]); k >= 0 ? it.skip.splice(k, 1) : it.skip.push(r[2]); }); render(); break; }
      if (r[0] === "plan") { saveMetaChange(mm => { mm.cash = mm.cash || { items: [] }; mm.cash.skip = mm.cash.skip || {}; const k = r[1] + "|" + r[2]; if (mm.cash.skip[k]) delete mm.cash.skip[k]; else mm.cash.skip[k] = true; }); render(); break; }
      if (r[0] === "debt") { const id = r[1], src = r[2], xi = +r[3];
        if (src === "acc") { const col = debtCols().find(([i]) => i === id); if (!col) break; const it = col[1].sched[xi]; const v = !isPaid(col[1], it); saveMetaChange(mm => { const a = mm.accounts.find(x => x.id === id); a.paid = { ...(a.paid || {}), [it.m]: v }; }); }
        else { const d = S.debts[id]; if (!d) break; const it = d.sched[xi]; it.p = !isPaid(d, it); S.store.setDebt(id, d); }
        render(); } break; }
    case "cash-open": { S.cashOpen = ds.m; const el = document.getElementById("cm-" + ds.m); if (el) { el.open = true; el.scrollIntoView({ behavior: "smooth", block: "start" }); } break; }
    case "ci-new": D = { view: "ci", ci: { _new: true, id: "ci-" + C.rid(), k: ds.k, name: ds.n || "", a: ds.a ? amtIn(Number(ds.a)) : "", rep: "m", day: 15, start: CUR(), end: "", date: today() } }; renderSettings(); break;
    case "ci-edit": { const it = ((meta().cash || {}).items || []).find(x => x.id === ds.id); if (!it) break; const cur = it.rep === "once" ? it.date.slice(0, 7) : (CUR() < it.start ? it.start : CUR());
      D = { view: "ci", ci: { ...clone(it), a: amtIn(cashAmt(it, cur)), _orig: cashAmt(it, cur), eff: cur, end: it.end || "" } }; renderSettings(); break; }
    case "ci-k": D.ci.k = ds.v; renderSettings(); break;
    case "ci-debt": { saveMetaChange(mm => { mm.cash = mm.cash || { items: [] }; const l = mm.cash.exDebts = mm.cash.exDebts || []; const k = l.indexOf(ds.id); if (k >= 0) l.splice(k, 1); else l.push(ds.id); }); renderSettings(); render(); break; }
    case "ci-rep": D.ci.rep = ds.v; renderSettings(); break;
    case "ci-del": { if (!confirm("Silinsin mi?")) break; const id = D.ci.id; saveMetaChange(m => { m.cash = m.cash || { items: [] }; m.cash.items = m.cash.items.filter(x => x.id !== id); }); closeSheet(); render(); toast("Silindi"); break; }
    case "ci-save": { const c = D.ci, a = C.parseAmt(c.a);
      if (!c.name || !c.name.trim() || !(a > 0)) { $("#s-err").innerHTML = '<p class="err">Ad ve tutar girin.</p>'; break; }
      const it = { id: c.id, k: c.k, name: c.name.trim(), rep: c.rep };
      if (c.rep === "once") { it.date = c.date || today(); it.amts = [{ from: it.date.slice(0, 7), a: C.r2(a) }]; }
      else { it.day = Math.min(31, Math.max(1, parseInt(c.day) || 1)); it.start = c.start || CUR(); it.end = c.end || null;
        let amts = c._new || !c.amts ? [] : c.amts.slice();
        if (c._new || !amts.length) amts = [{ from: it.start, a: C.r2(a) }];
        else if (C.r2(a) !== C.r2(c._orig || 0)) { const eff = c.eff || CUR(); amts = amts.filter(x => x.from < eff).concat({ from: eff, a: C.r2(a) }); }
        amts.sort((x, y) => x.from.localeCompare(y.from)); if (amts[0].from > it.start) amts[0].from = it.start; it.amts = amts; }
      saveMetaChange(m => { m.cash = m.cash || { items: [] }; const i = m.cash.items.findIndex(x => x.id === it.id); if (i >= 0) m.cash.items[i] = it; else m.cash.items.push(it); }); closeSheet(); render(); toast("Kaydedildi"); break; }
    case "cat-icon": D.cat.icon = ds.v || null; D.cat.img = null; renderSettings(); break;
    case "cat-img-rm": D.cat.img = null; renderSettings(); break;
    case "past-toggle": S.showPast = !S.showPast; render(); break;
    case "cat-tx": closeSheet(); S.view = "tx"; S.catF = ds.id; S.q = ""; S.accF = ""; if (location.hash.slice(1) !== "tx") location.hash = "tx"; render(); window.scrollTo(0, 0); break;
    case "cat-exp": (S.catExp = S.catExp || {})[ds.id] = !S.catExp[ds.id]; render(); break;
    case "pay-tx": S.view = "tx"; S.payF = ds.t; S.catF = null; S.q = ""; S.accFs = []; S.fYear = null; if (location.hash.slice(1) !== "tx") location.hash = "tx"; render(); window.scrollTo(0, 0); break;
    case "pay-sort": S.paySort = S.paySort === "isim" ? "n" : S.paySort === "n" ? "a" : "isim"; render(); break;
    case "pay-ren": { const old = ds.t, ok = old.toLocaleLowerCase("tr"); askText("Lehdarın yeni adı", old).then(nv => { if (!nv || nv === old) return; const n = bulkTx(t => t.k !== "tr" && payName(t).toLocaleLowerCase("tr") === ok, t => { t.t = nv; return t; }); render(); toast(n + " işlem güncellendi"); }); break; }
    case "catf-clear": S.catF = null; S.payF = null; S.fYear = null; render(); break;
    case "accf-open": S.accOpen = !S.accOpen; render(); break;
    case "accf-t": { const i = S.accFs.indexOf(ds.id); i >= 0 ? S.accFs.splice(i, 1) : S.accFs.push(ds.id); render(); break; }
    case "accf-clear": S.accFs = []; render(); break;
    case "per": S.per = ds.v; render(); break;
    case "tgl-past": S.showPastTx = !S.showPastTx; render(); break;
    case "tgl-e": S.showE = !S.showE; render(); break;
    case "tgl-i": S.showI = !S.showI; render(); break;
    case "tgl-fut": S.showFutTx = !S.showFutTx; render(); break;
    case "gt-open": { S.view = "tx"; S.q = ""; S.accF = ""; S.catF = null; S.payF = null; S.fYear = S.year; if (location.hash.slice(1) !== "tx") location.hash = "tx";
      if (ds.id.startsWith("p:")) S.payF = ds.id.slice(2); else S.catF = ds.id; render(); window.scrollTo(0, 0); break; }
    case "plan-reset": D.planEdited = false; renderPlanBox(); break;
    case "pie-pre": S.pFrom = ds.f; S.pTo = ds.t; render(); break;
    case "pie-drill": S.pCat = ds.id; render(); break;
    case "pie-tog": S.pOpen = S.pOpen || {}; S.pOpen[ds.id] = !S.pOpen[ds.id]; render(); break;
    case "acc-logo": { const d = (ds.d || "").trim(); if (!d) break; D.acc.dom = d; D.acc.logo = logoUrl(d); D.lgq = ""; renderSettings(); break; }
    case "acc-logo-rm": D.acc.logo = null; renderSettings(); break;
    case "acc-del": { const id = D.acc.id; if (derived().all.some(t => t.acc === id || t.to === id)) { $("#s-err").innerHTML = '<p class="err">Bu hesapta işlem var; silmek yerine gizleyebilirsiniz.</p>'; break; } if (!confirm("Hesap silinsin mi?")) break; saveMetaChange(m => { m.accounts = m.accounts.filter(x => x.id !== id); }); closeSheet(); render(); toast("Silindi"); break; }
    case "cat-del": { const id = D.cat.id; if (derived().all.some(t => t.cat === id) || meta().categories.some(x => x.parent === id)) { $("#s-err").innerHTML = '<p class="err">Bu kategori kullanılıyor veya alt kategorisi var.</p>'; break; } if (!confirm("Kategori silinsin mi?")) break; saveMetaChange(m => { m.categories = m.categories.filter(x => x.id !== id); }); closeSheet(); render(); toast("Silindi"); break; }
    case "dash-edit-on": S.dashDraft = null; S.dashEdit = true; S.dashTray = false; render(); break;
    case "dash-edit-off": { const dr = S.dashDraft; S.dashDraft = null; S.dashEdit = false; S.dashTray = false; if (dr) saveMetaChange(m => { if (dr.reset) delete m[dashKey()]; else m[dashKey()] = dr; }); render(); if (dr) toast("Kaydedildi"); break; }
    case "dash-edit-cancel": S.dashDraft = null; S.dashEdit = false; S.dashTray = false; render(); break;
    case "dg-tray": S.dashTray = !S.dashTray; render(); break;
    case "dg-hide": dgSave(items => { const it = items.find(x => x.id === ds.id); if (it) it.on = false; }); render(); break;
    case "dg-add": dgSave(items => { const k = items.findIndex(x => x.id === ds.id); if (k < 0) return; const it = items.splice(k, 1)[0]; it.on = true; items.push(it); }); render(); break;
    case "dg-mv": dgSave(items => { const i = items.findIndex(x => x.id === ds.id), dir = Number(ds.d); if (i < 0) return; let j = i + dir; while (j >= 0 && j < items.length && !items[j].on) j += dir; if (j < 0 || j >= items.length) return; [items[i], items[j]] = [items[j], items[i]]; delete items[i].x; delete items[i].y; delete items[j].x; delete items[j].y; }); render(); break;
    case "dg-sz": dgSave(items => { const it = items.find(x => x.id === ds.id); if (!it) return; const n = szOpts(it.id).length; it.sz = ds.s != null ? clampN(+ds.s, 0, n - 1) : (it.sz + 1) % n; }); render(); break;
    case "dg-reset": ask("Modül yerleşimi varsayılana dönsün mü?", [{ l: "Varsayılana dön", v: 1 }]).then(v => { if (!v) return; S.dashDraft = { ...JSON.parse(JSON.stringify(DEF_DASH)), reset: true }; render(); }); break;
    case "gt-edit": D = { view: "gt", hid: [], ...clone(gtCfg()) }; renderSettings(); break;
    case "gt-rm": D[ds.g].splice(+ds.i, 1); renderSettings(); break;
    case "gt-mv": { const g = ds.g, i = +ds.i, j = i + Number(ds.d); if (j >= 0 && j < D[g].length) { [D[g][i], D[g][j]] = [D[g][j], D[g][i]]; } renderSettings(); break; }
    case "gt-hide": { D.hid = D.hid || []; const i = D.hid.indexOf(ds.id); i >= 0 ? D.hid.splice(i, 1) : D.hid.push(ds.id); renderSettings(); break; }
    case "gt-save": { const g = { g1: D.g1, g2: D.g2, n1: D.n1 || "1. grup", n2: D.n2 || "2. grup", hid: D.hid || [] }; saveMetaChange(m => { m.gtable = g; }); closeSheet(); render(); toast("Kaydedildi"); break; }
    case "exp-json": download("butce-yedek-" + today() + ".json", JSON.stringify({ exportedAt: new Date().toISOString(), meta: meta(), months: S.months, debts: S.debts }), "application/json"); break;
    case "exp-csv": { const rows = [["Tarih", "Tür", "Tutar", "Hesap", "Karşı hesap", "Kategori", "Açıklama", "Not"]]; derived().all.slice().sort((a, b) => a.d.localeCompare(b.d)).forEach(t => rows.push([t.d, { e: "Gider", i: "Gelir", tr: "Transfer" }[t.k], nfp.format(t.a), accName(t.acc), t.to ? accName(t.to) : "", t.cat ? catLabel(t.cat) : "", t.t || "", t.n || ""]));
      download("butce-islemler-" + today() + ".csv", "\ufeff" + rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(";")).join("\r\n"), "text/csv"); break; }
  }
});
document.addEventListener("input", e => {
  const t = e.target;
  if (t.dataset.in === "payq") { S.payQ = t.value; const pos = t.selectionStart; render(); const n = document.querySelector('[data-in="payq"]'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } return; }
  if (t.dataset.in === "q") { S.q = t.value; const pos = t.selectionStart; render(); const n = document.querySelector('[data-in="q"]'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } return; }
  if (!D) return;
  if (t.dataset.d === "aStr" || t.dataset.sa != null || t.dataset.pa != null || t.dataset.si != null || t.id === "p-a" || (t.dataset.num === "amt" && t.dataset.f !== "rate")) formatAmountField(t);
  if (t.id === "p-date") { const g = t.value.replace(/\D/g, "").slice(0, 8); t.value = g.length > 4 ? g.slice(0, 2) + "." + g.slice(2, 4) + "." + g.slice(4) : g.length > 2 ? g.slice(0, 2) + "." + g.slice(2) : g; return; }
  if (t.dataset.d) { D[t.dataset.d] = t.dataset.d === "cnt" ? parseInt(t.value) || 0 : t.value; if (t.dataset.d === "t") renderSugg(); if (["aStr", "cnt"].includes(t.dataset.d)) renderPlanBox(); if (t.dataset.d === "cnt" || (t.dataset.d === "aStr" && D.rep !== "one")) { /* preview updates on next render */ } }
  if (t.dataset.f) { const k = t.dataset.num; let v = t.value; if (k === "amt") { v = v.trim() === "" ? null : C.parseAmt(v); if (v !== null && isNaN(v)) return; } else if (k === "int") v = v === "" ? null : parseInt(v); D[t.dataset.f] = v; }
  if (D && (t.dataset.gtq || t.dataset.gtpq)) { const g = t.dataset.gtq || t.dataset.gtpq, kd = t.dataset.gtq ? "c" : "p"; $("#gtl-" + kd + "-" + g).innerHTML = gtList(kd, g, t.value); return; }
  if (t.id === "cq") { D.cq = t.value; $("#catlist").innerHTML = catList(D.k, D.cq); return; }
  if (t.id === "lgq" && D) { D.lgq = t.value; clearTimeout(lgT); lgT = setTimeout(() => logoSearch(t.value), 250); return; }
  if (t.dataset.gn) D[t.dataset.gn] = t.value;
  if (D && D.ci && t.dataset.ci) D.ci[t.dataset.ci] = t.value;
  if ("open" in t.dataset) { D.open = t.checked; D.planEdited = false; renderTx(true); return; }
  if (t.dataset.pa != null) { const v = C.parseAmt(t.value); D.plan[+t.dataset.pa].a = isNaN(v) ? 0 : v; D.planEdited = true; const e = $("#plantot"); if (e) e.textContent = "Toplam " + f2(D.plan.reduce((s, p) => s + (p.a || 0), 0)); }
  if (t.dataset.gd != null && D && D.gl) { D.gl[+t.dataset.gd].d = t.value; return; }
  if (t.dataset.ga != null && D && D.gl) { D.gl[+t.dataset.ga].a = C.parseAmt(t.value) || 0; return; }
  if (t.dataset.pd != null) { D.plan[+t.dataset.pd].d = t.value; D.planEdited = true; }
  if (t.dataset.sa != null) { D.sp[+t.dataset.sa].a = t.value; const b = $("#spbox .spf span"); if (b) { const a = C.parseAmt(D.aStr) || 0, sum = D.sp.reduce((s, x) => s + (C.parseAmt(x.a) || 0), 0), df = C.r2(a - sum); b.className = "small " + (Math.abs(df) < 0.005 ? "muted" : "neg"); b.textContent = Math.abs(df) < 0.005 ? "Dağıtım tam" : (df > 0 ? "Kalan " + f2(df) : "Fazla " + f2(-df)); } }
  if (t.dataset.si != null) { const v = C.parseAmt(t.value); D.sched[+t.dataset.si].a = isNaN(v) ? 0 : v; if (D.kind !== "kart") { D.total = C.r2(D.sched.reduce((s, x) => s + (x.a || 0), 0)); const te = document.querySelector('[data-f="total"]'); if (te) te.value = amtIn(D.total); } }
  if (t.dataset.a) { const k = t.dataset.a; D.acc[k] = t.type === "checkbox" ? t.checked : k === "start" ? (C.parseAmt(t.value) || 0) : t.value; }
  if (t.dataset.c) { D.cat[t.dataset.c] = t.value || (t.dataset.c === "parent" ? null : ""); }
});
document.addEventListener("focusin", e => { const t = e.target; if (t.tagName === "INPUT" && (t.inputMode === "decimal" || t.inputMode === "numeric" || t.type === "number")) { t.setAttribute("autocomplete", "one-time-code"); t.setAttribute("autocorrect", "off"); t.setAttribute("spellcheck", "false"); t.setAttribute("data-lpignore", "true"); t.setAttribute("data-1p-ignore", "true"); t.setAttribute("name", "n" + Math.random().toString(36).slice(2)); } });
document.addEventListener("change", e => {
  const t = e.target;
  if (t.dataset.ch === "accF") { S.accF = t.value; render(); }
  if (t.id === "f-imp" && t.files[0]) { handleImport(t.files[0]); t.value = ""; }
  if (D && D.imp && D.view === "imp" && (t.dataset.im || t.dataset.io)) { if (t.dataset.im) { if (t.value === "") delete D.imp.map[t.dataset.im]; else D.imp.map[t.dataset.im] = +t.value; } else D.imp.opt[t.dataset.io] = t.value; impRun(D.imp); renderSettings(); }
  if (t.id === "cat-img" && t.files[0] && D && D.cat) { const im = new Image(); im.onload = () => { const cv = document.createElement("canvas"); cv.width = cv.height = 72; const k = Math.min(im.width, im.height); cv.getContext("2d").drawImage(im, (im.width - k) / 2, (im.height - k) / 2, k, k, 0, 0, 72, 72); D.cat.img = cv.toDataURL("image/webp", 0.82); if (!D.cat.img.startsWith("data:image/webp")) D.cat.img = cv.toDataURL("image/png"); URL.revokeObjectURL(im.src); renderSettings(); }; im.src = URL.createObjectURL(t.files[0]); }
  if (D && t.dataset.a && t.type === "checkbox") D.acc[t.dataset.a] = t.checked;
  if (D && "kart" in t.dataset) { D.acc.type = t.checked ? "kart" : (D.acc.type === "kart" ? "banka" : D.acc.type); if (t.checked) { D.acc.exclude = true; D.acc.due = D.acc.due || 15; } renderSettings(); }
  if (D && t.dataset.c) { D.cat[t.dataset.c] = t.value || null; if (t.dataset.c === "type") { D.cat.parent = null; renderSettings(); } }
  if (D && t.dataset.d === "d") { D.d = t.value; renderPlanBox(); }
  if (D && t.id === "f-t") { D.t = t.value; setTimeout(() => { if (D && dlg.open && applyPayee()) { const a = document.activeElement, id = a && a.id; renderTx(true); id && document.getElementById(id)?.focus(); } }, 180); }
  if (["pFrom", "pTo", "pCat"].includes(t.dataset.ch)) { S[t.dataset.ch] = t.value; render(); }
});
document.addEventListener("keydown", e => {
  if (D && (e.target.id === "cq" || e.target.closest(".tx-catlist"))) {
    if (e.key === "Escape" && D.catOpen) { e.preventDefault(); D.catOpen = false; D.cq = ""; renderTx(true); dlgIn.querySelector('[data-act="cat-open"]')?.focus(); return; }
    const list = e.target.id === "cq" ? $("#catlist") : e.target.closest(".tx-catlist");
    const options = Array.from(list?.querySelectorAll('[role="option"]') || []);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); const current = options.indexOf(e.target); const next = e.key === "ArrowDown" ? Math.min(current + 1, options.length - 1) : (current < 0 ? options.length - 1 : Math.max(0, current - 1)); options[next]?.focus(); return; }
    if (e.key === "Enter") { e.preventDefault(); if (e.target.id === "cq") options[0]?.click(); else e.target.click(); return; }
  }
  if (e.key === "Enter" && dlg.open && e.target.tagName === "INPUT" && D && D.k) { e.preventDefault(); saveTx(false); }
});
let dragT = null;
let dragEnd = 0;
document.addEventListener("pointerdown", e => { if (e.pointerType !== "mouse" || e.button !== 0) return; const w = e.target.closest(".tw"); if (!w) return;
  dragT = { w, x: e.clientX, y: e.clientY, sl: w.scrollLeft, st: w.scrollTop, on: false };
});
document.addEventListener("click", e => { if (Date.now() - dragEnd < 250 && e.target.closest(".tw")) { e.stopPropagation(); e.preventDefault(); } }, true);
document.addEventListener("pointermove", e => { if (!dragT) return; const dx = e.clientX - dragT.x, dy = e.clientY - dragT.y;
  if (!dragT.on && Math.abs(dx) < 6 && Math.abs(dy) < 6) return; dragT.on = true; dragT.w.classList.add("grabbing");
  dragT.w.scrollLeft = dragT.sl - dx; dragT.w.scrollTop = dragT.st - dy; e.preventDefault(); });
document.addEventListener("pointerup", () => { if (dragT) { dragT.w.classList.remove("grabbing"); if (dragT.on) dragEnd = Date.now(); } dragT = null; });
let tipEl = null, tipT = null;
function showTip(r, x, y, sticky) { if (!tipEl) { tipEl = document.createElement("div"); tipEl.className = "ctip"; document.body.appendChild(tipEl); }
  const t = r.dataset.tip; if (!t) return; const i = t.lastIndexOf(":"); tipEl.innerHTML = '<span>' + esc(t.slice(0, i)) + '</span><b>' + esc(t.slice(i + 1).trim()) + '</b>';
  tipEl.style.display = "block"; const w = tipEl.offsetWidth, h = tipEl.offsetHeight, md = r.closest(".mod"); if (md) { const b = md.getBoundingClientRect(); x = b.left + b.width / 2; y = b.top + h + 4; } tipEl.style.left = Math.max(6, Math.min(innerWidth - w - 6, x - w / 2)) + "px"; tipEl.style.top = Math.max(6, y - h - 12) + "px";
  document.querySelectorAll(".br.hl").forEach(e => e.classList.remove("hl")); const br = r.nextElementSibling; if (br && br.classList.contains("br")) br.classList.add("hl");
  clearTimeout(tipT); if (sticky) tipT = setTimeout(hideTip, 2500); }
function hideTip() { if (tipEl) tipEl.style.display = "none"; document.querySelectorAll(".br.hl").forEach(e => e.classList.remove("hl")); }
document.addEventListener("mousemove", e => { const r = e.target.closest && e.target.closest(".bhit"); if (r) showTip(r, e.clientX, e.clientY); else if (tipEl && tipEl.style.display === "block" && !tipT) hideTip(); });
document.addEventListener("mouseout", e => { if (e.target.closest && e.target.closest(".bhit") && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest(".bhit"))) { clearTimeout(tipT); tipT = null; hideTip(); } });
document.addEventListener("click", e => { const r = e.target.closest && e.target.closest(".bhit"); if (r) { tipT = null; showTip(r, e.clientX, e.clientY, true); } });
let scrub = null;
document.addEventListener("touchstart", e => { const r = e.target.closest && e.target.closest(".bhit"); if (!r || !r.closest("svg.chart")) return; const t0 = e.touches[0]; scrub = { on: false, x: t0.clientX, y: t0.clientY, tm: setTimeout(() => { if (scrub) { scrub.on = true; tipT = null; showTip(r, scrub.x, scrub.y); if (navigator.vibrate) navigator.vibrate(8); } }, 220) }; }, { passive: true });
document.addEventListener("touchmove", e => { if (!scrub) return; const t0 = e.touches[0]; if (!scrub.on) { if (Math.abs(t0.clientX - scrub.x) > 8 || Math.abs(t0.clientY - scrub.y) > 8) { clearTimeout(scrub.tm); scrub = null; } return; } e.preventDefault(); scrub.x = t0.clientX; scrub.y = t0.clientY; const el = document.elementFromPoint(t0.clientX, Math.min(t0.clientY, innerHeight - 2)); let r = el && el.closest && el.closest(".bhit"); if (!r) { const svg = document.querySelectorAll("svg.chart"); for (const s of svg) { const b = s.getBoundingClientRect(); if (t0.clientX >= b.left && t0.clientX <= b.right && t0.clientY >= b.top - 40 && t0.clientY <= b.bottom + 40) { const hs = [...s.querySelectorAll(".bhit")]; r = hs.find(h => { const hb = h.getBoundingClientRect(); return t0.clientX >= hb.left && t0.clientX <= hb.right; }); break; } } } if (r) showTip(r, t0.clientX, t0.clientY); }, { passive: false });
document.addEventListener("touchend", () => { if (!scrub) return; clearTimeout(scrub.tm); if (scrub.on) tipT = setTimeout(hideTip, 1500); scrub = null; });
addEventListener("scroll", () => { if (tipEl && tipEl.style.display === "block") hideTip(); }, { passive: true });
function dgSave(mut) { const items = dashCfg(); mut(items); S.dashDraft = { v: 3, items: items.map(x => x.x ? { id: x.id, on: x.on, sz: x.sz, x: x.x, y: x.y } : { id: x.id, on: x.on, sz: x.sz }) }; }
let dgDrag = null;
document.addEventListener("dragstart", e => { const m = e.target.closest && e.target.closest(".mod.editing[data-id]"); if (!m || dashMobile()) return; const b = m.getBoundingClientRect(); dgDrag = { id: m.dataset.id, ox: e.clientX - b.left, oy: e.clientY - b.top }; e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", m.dataset.id); } catch (_) {} m.classList.add("dg-dragging"); });
document.addEventListener("dragend", () => { document.querySelectorAll(".dg-dragging").forEach(x => x.classList.remove("dg-dragging")); });
document.addEventListener("dragover", e => { if (dgDrag && e.target.closest && e.target.closest(".manual-grid")) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; } });
document.addEventListener("drop", e => { const g = dgDrag && e.target.closest && e.target.closest(".manual-grid"); if (!g) return; e.preventDefault(); const dd = dgDrag; dgDrag = null;
  const r = g.getBoundingClientRect(), cs = getComputedStyle(g), gap = parseFloat(cs.columnGap) || 12, rh = parseFloat(cs.gridAutoRows) || 80, C8 = dashCols(), cw = (r.width - gap * (C8 - 1)) / C8;
  const pos = {}; g.querySelectorAll(".mod[data-id]").forEach(el => { pos[el.dataset.id] = { x: +el.dataset.x, y: +el.dataset.y, w: +el.dataset.w, h: +el.dataset.h }; });
  const me = pos[dd.id]; if (!me) return;
  const x = clampN((e.clientX - dd.ox - r.left) / (cw + gap) + 1, 1, C8 + 1 - me.w), y = Math.max(1, Math.round((e.clientY - dd.oy - r.top) / (rh + gap) + 1));
  dgSave(items => { items.forEach(it => { const p = pos[it.id]; if (p) { it.x = p.x; it.y = p.y; } });
    const ov = p => x < p.x + p.w && x + me.w > p.x && y < p.y + p.h && y + me.h > p.y;
    items.forEach(it => { const p = pos[it.id]; if (it.id !== dd.id && p && ov(p)) { if (p.w <= me.w || me.x + p.w - 1 <= C8) { it.x = me.x; it.y = me.y; } else { it.x = p.x; it.y = y + me.h; } } });
    const k = items.findIndex(it => it.id === dd.id), it = items.splice(k, 1)[0]; it.x = x; it.y = y; items.unshift(it); });
  render(); });
let wasCols = dashCols();
addEventListener("resize", () => { const cols = dashCols(); if (cols !== wasCols) { wasCols = cols; if (S.store && S.view === "home") render(); } });
addEventListener("online", render); addEventListener("offline", render);

boot();

// Tanımlar > Hesaplar: basılı tut + sürükle ile sıralama
function accDrag() {
  const ul = document.querySelector(".acc-li") && document.querySelector(".acc-li").parentElement; if (!ul || ul._dr) return; ul._dr = 1;
  let tm = 0, drag = null, sy = 0, grab = 0;
  const natTop = el => { const t = el.style.transform; el.style.transform = "none"; const v = el.getBoundingClientRect().top; el.style.transform = t; return v; };
  const end = save => { clearTimeout(tm); tm = 0; if (!drag) return; const d = drag; drag = null; document.body.classList.remove("no-sel");
    d.style.transition = "transform .22s cubic-bezier(.2,.8,.2,1), box-shadow .22s"; d.style.transform = ""; d.classList.remove("dragging");
    setTimeout(() => { d.style.transition = ""; d.style.zIndex = "";
      if (save) { const ids = [...ul.querySelectorAll(".acc-li")].map(li => li.dataset.id); saveMetaChange(m => { m.accounts.forEach(a => { const i = ids.indexOf(a.id); if (i >= 0) a.order = i; }); }); S._noClick = Date.now(); render(); } }, 230); };
  ul.addEventListener("pointerdown", e => { const li = e.target.closest(".acc-li"); if (!li || e.target.closest(".pen")) return; sy = e.clientY;
    tm = setTimeout(() => { drag = li; grab = sy - natTop(li); li.style.zIndex = 5; li.classList.add("dragging"); document.body.classList.add("no-sel"); navigator.vibrate && navigator.vibrate(20); }, 380); });
  ul.addEventListener("pointermove", e => { if (!drag) { if (tm && Math.abs(e.clientY - sy) > 8) { clearTimeout(tm); tm = 0; } return; }
    const sibs = [...ul.querySelectorAll(".acc-li")].filter(x => x !== drag);
    const tgt = sibs.find(li => { const r = li.getBoundingClientRect(); return e.clientY > r.top && e.clientY < r.bottom; });
    if (tgt) { const r = tgt.getBoundingClientRect(); const ref = e.clientY > r.top + r.height / 2 ? tgt.nextSibling : tgt;
      if (ref !== drag && ref !== drag.nextSibling) {
        const first = new Map(sibs.map(x => [x, x.getBoundingClientRect().top]));
        ul.insertBefore(drag, ref);
        sibs.forEach(x => { const dy = first.get(x) - x.getBoundingClientRect().top; if (!dy) return;
          x.style.transition = "none"; x.style.transform = "translateY(" + dy + "px)"; x.offsetHeight;
          x.style.transition = "transform .2s cubic-bezier(.2,.8,.2,1)"; x.style.transform = ""; });
        navigator.vibrate && navigator.vibrate(8);
      } }
    drag.style.transform = "translateY(" + (e.clientY - grab - natTop(drag)) + "px) scale(1.03)"; });
  ul.addEventListener("touchmove", e => { if (drag) e.preventDefault(); }, { passive: false });
  ul.addEventListener("pointerup", () => end(true)); ul.addEventListener("pointercancel", () => end(!!drag));
  ul.addEventListener("click", e => { if (S._noClick && Date.now() - S._noClick < 400) { e.stopPropagation(); e.preventDefault(); } }, true);
  ul.addEventListener("contextmenu", e => e.preventDefault());
}

/* long-press multi-select in transactions */
(() => { let tm = null, sx = 0, sy = 0;
  document.addEventListener("pointerdown", e => { const b = e.target.closest("button.tx"); if (!b || S.view !== "tx") return; sx = e.clientX; sy = e.clientY; clearTimeout(tm);
    tm = setTimeout(() => { tm = null; S.sel = S.sel || {}; S.sel[b.dataset.id] = b.dataset.m; S.selSkip = true; try { navigator.vibrate && navigator.vibrate(15); } catch (_) {} render(); setTimeout(() => { S.selSkip = false; }, 600); }, 450); });
  const cancel = () => { clearTimeout(tm); tm = null; };
  document.addEventListener("pointermove", e => { if (tm && (Math.abs(e.clientX - sx) > 8 || Math.abs(e.clientY - sy) > 8)) cancel(); });
  document.addEventListener("pointerup", cancel); document.addEventListener("pointercancel", cancel);
  document.addEventListener("contextmenu", e => { if (e.target.closest("button.tx")) e.preventDefault(); });
})();

document.addEventListener("click", e => { const r = e.target.closest(".bhit"); const cb = r && r.closest(".chartbox[data-daym]"); if (!cb || S.dashEdit) return;
  const i = [...cb.querySelectorAll("rect.bhit")].indexOf(r); if (i < 0) return; e.stopPropagation(); e.preventDefault();
  S.view = "tx"; S.per = "d:" + cb.dataset.daym + "-" + String(i + 1).padStart(2, "0"); S.accFs = []; S.catF = null; S.payF = null; S.q = ""; S.showPastTx = true; S.showFutTx = true; S.showE = true; S.showI = true;
  if (location.hash.slice(1) !== "tx") location.hash = "tx"; render(); window.scrollTo(0, 0); }, true);
