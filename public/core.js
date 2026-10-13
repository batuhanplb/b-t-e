// Pure logic shared by the app and tests. No DOM, no Firebase.

export const TR_M = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
export const pad = n => String(n).padStart(2, "0");
export const ymd = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
export const addM = (m, k) => { const [y, mo] = m.split("-").map(Number); const t = y * 12 + (mo - 1) + k; return Math.floor(t / 12) + "-" + pad(t % 12 + 1); };
export const daysIn = m => { const [y, mo] = m.split("-").map(Number); return new Date(y, mo, 0).getDate(); };
export const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
export const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-5);

export function parseAmt(v) {
  if (v == null) return NaN;
  let s = String(v).replace(/[₺\s]/g, "").replace(/^\+/, "").trim();
  if (!s) return NaN;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else { const p = s.split("."); if (p.length > 2) s = p.join(""); else if (p.length === 2 && p[1].length === 3) s = p.join(""); }
  const n = Number(s);
  return isFinite(n) ? n : NaN;
}

/* ---------------- Expense IQ (.bak) ---------------- */

function hexToUtf8(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return new TextDecoder("utf-8").decode(bytes);
}

function parseValues(s) {
  const out = []; let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === " " || c === ",") { i++; continue; }
    if (c === "'") {
      let j = i + 1, v = "";
      while (j < s.length) {
        if (s[j] === "'") { if (s[j + 1] === "'") { v += "'"; j += 2; continue; } break; }
        v += s[j++];
      }
      out.push(v); i = j + 1;
    } else {
      let j = i; while (j < s.length && s[j] !== ",") j++;
      const raw = s.slice(i, j).trim();
      out.push(raw.toUpperCase() === "NULL" ? null : Number(raw));
      i = j;
    }
  }
  return out;
}

export function parseExpenseIQBackup(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  if (!/^\[EASYMONEY_BACKUP/.test(lines[0] || "")) throw new Error("Bu dosya bir Expense IQ yedeği değil.");
  const tables = {};
  for (let k = 1; k < lines.length; k++) {
    const l = lines[k].trim(); if (!l) continue;
    const sql = hexToUtf8(l.split("").reverse().join(""));
    const m = sql.match(/^INSERT INTO (\w+)\s*\(([^)]*)\)\s*VALUES\s*\((.*)\)\s*;?\s*$/s);
    if (!m) continue;
    const cols = m[2].split(",").map(c => c.trim());
    const vals = parseValues(m[3]);
    const row = {}; cols.forEach((c, i) => row[c] = vals[i]);
    (tables[m[1]] = tables[m[1]] || []).push(row);
  }
  return tables;
}

const ACC_TYPE = { bank: "banka", wallet: "nakit", credit_card: "kart", purse: "diger" };
const argb = c => (c && /^[0-9a-f]{8}$/i.test(c)) ? "#" + c.slice(2) : "#7d8a90";

export function convertExpenseIQ(tables) {
  const live = r => String(r.deleted) === "0";
  const accounts = (tables.account || []).filter(live).sort((a, b) => a.position - b.position).map((a, i) => ({
    id: a.uuid, name: a.name, type: ACC_TYPE[a.icon] || (a.icon === "credit_card" ? "kart" : "banka"),
    color: argb(a.color), start: Number(a.start_balance) || 0, exclude: a.exclude_from_total === "Yes",
    hidden: Number(a.hidden) === 1, order: i
  }));
  const cats = (tables.category || []).filter(live).map(c => ({
    id: c.uuid, name: c.name, parent: c.parent_id || null, type: c.type === "I" ? "I" : "E", color: argb(c.color)
  }));
  const catIds = new Set(cats.map(c => c.id));
  cats.forEach(c => { if (c.parent && !catIds.has(c.parent)) c.parent = null; });

  const trans = (tables.tran || []).filter(t => live(t) && t.status !== "Template" && Number(t.tran_date) > 0);
  const txs = [];
  const pairs = new Map();
  for (const t of trans) {
    const ts = Number(t.tran_date);
    const d = ymd(new Date(ts));
    if (t.transfer_account_id) {
      const key = ts + "|" + Math.abs(t.amount).toFixed(2) + "|" + [t.account_id, t.transfer_account_id].sort().join("|");
      const p = pairs.get(key);
      if (p) {
        const out = t.amount < 0 ? t : p, inn = t.amount < 0 ? p : t;
        txs.push({ id: out.uuid, k: "tr", d, ts, a: r2(Math.abs(out.amount)), acc: out.account_id, to: inn.account_id, t: "", n: out.remarks || inn.remarks || "" });
        pairs.delete(key);
      } else pairs.set(key, t);
      continue;
    }
    const a = Number(t.amount);
    txs.push({ id: t.uuid, k: a < 0 ? "e" : "i", d, ts, a: r2(Math.abs(a)), acc: t.account_id, cat: t.category_id || null, t: cleanTitle(t.title, t.category_id, cats), n: t.remarks || "" });
  }
  // unmatched transfer halves become one-sided entries so balances stay right
  for (const t of pairs.values()) {
    const a = Number(t.amount), ts = Number(t.tran_date);
    txs.push({ id: t.uuid, k: a < 0 ? "e" : "i", d: ymd(new Date(ts)), ts, a: r2(Math.abs(a)), acc: t.account_id, cat: null, t: t.title || "Transfer", n: t.remarks || "" });
  }
  return { accounts, categories: cats, txs };
}

// Expense IQ writes "Parent:Child" as the title when no payee is entered; drop it so the category shows instead.
function cleanTitle(title, catId, cats) {
  if (!title) return "";
  const c = cats.find(x => x.id === catId);
  if (c) {
    const p = c.parent ? cats.find(x => x.id === c.parent) : null;
    const path = p ? p.name + ":" + c.name : c.name;
    if (title.trim().toLocaleLowerCase("tr") === path.toLocaleLowerCase("tr")) return "";
  }
  return title.trim();
}

/* ---------------- aggregation helpers ---------------- */

export function groupByMonth(txs) {
  const out = {};
  for (const t of txs) { const m = t.d.slice(0, 7); (out[m] = out[m] || []).push(t); }
  for (const m in out) out[m].sort((a, b) => (a.ts || 0) - (b.ts || 0));
  return out;
}

export function accountBalances(accounts, txs) {
  const bal = {}; accounts.forEach(a => bal[a.id] = a.start || 0);
  for (const t of txs) {
    if (t.k === "e") bal[t.acc] = (bal[t.acc] || 0) - t.a;
    else if (t.k === "i") bal[t.acc] = (bal[t.acc] || 0) + t.a;
    else if (t.k === "tr") { bal[t.acc] = (bal[t.acc] || 0) - t.a; bal[t.to] = (bal[t.to] || 0) + t.a; }
  }
  for (const k in bal) bal[k] = r2(bal[k]);
  return bal;
}

export function topCat(catMap, id) {
  let c = catMap[id]; let guard = 0;
  while (c && c.parent && catMap[c.parent] && guard++ < 5) c = catMap[c.parent];
  return c || null;
}

// payee memory: title -> most recent {cat, acc, k}, with frequency
export function payeeMemory(txs) {
  const m = new Map();
  for (const t of txs) {
    if (!t.t || t.k === "tr") continue;
    const key = t.t.toLocaleLowerCase("tr");
    const e = m.get(key) || { t: t.t, n: 0, last: 0 };
    e.n++;
    if ((t.ts || 0) >= e.last) { e.last = t.ts || 0; e.cat = t.cat; e.acc = t.acc; e.k = t.k; e.a = t.a; }
    m.set(key, e);
  }
  return [...m.values()].sort((a, b) => b.n - a.n);
}

// quick-add favourites: most used (category, account, title) combos in the last 120 days
export function favourites(txs, now = Date.now(), limit = 6) {
  const since = now - 120 * 864e5, m = new Map();
  for (const t of txs) {
    if (t.k === "tr" || !t.cat || (t.ts || 0) < since || (t.ts || 0) > now) continue;
    const key = t.k + "|" + t.cat + "|" + t.acc + "|" + (t.t || "").toLocaleLowerCase("tr");
    const e = m.get(key) || { k: t.k, cat: t.cat, acc: t.acc, t: t.t || "", n: 0 };
    e.n++; m.set(key, e);
  }
  return [...m.values()].sort((a, b) => b.n - a.n).slice(0, limit);
}
