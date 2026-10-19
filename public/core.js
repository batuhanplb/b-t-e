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

/* ---------------- generic import: CSV / TSV / XLSX / QIF / OFX ---------------- */

// Decode a file's bytes: BOM-aware, UTF-8 first, Turkish/Western Windows code page as fallback.
export function decodeText(buf) {
  const b = new Uint8Array(buf);
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder("utf-16le").decode(b);
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder("utf-16be").decode(b);
  try { return new TextDecoder("utf-8", { fatal: true }).decode(b).replace(/^﻿/, ""); }
  catch { return new TextDecoder("windows-1254").decode(b); }
}

export function parseCSV(text) {
  text = text.replace(/^﻿/, "");
  const sample = text.split(/\r?\n/).filter(l => l.trim()).slice(0, 30);
  let delim = ",", best = -1;
  for (const d of [",", ";", "\t", "|"]) {
    const counts = sample.map(l => splitLine(l, d).length);
    const max = Math.max(...counts), common = counts.filter(c => c === max).length;
    const score = max > 1 ? common * 10 + max : 0;
    if (score > best) { best = score; delim = d; }
  }
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"' && cell.trim() === "") { q = true; cell = ""; }
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.map(r => r.map(v => v.trim())).filter(r => r.some(v => v !== ""));
}
function splitLine(l, d) { let n = 1, q = false; for (const c of l) { if (c === '"') q = !q; else if (c === d && !q) n++; } return Array(n); }

// Minimal .xlsx reader (first worksheet) using the browser's DecompressionStream.
export async function readXlsx(buf) {
  const b = new Uint8Array(buf), dv = new DataView(buf instanceof ArrayBuffer ? buf : b.buffer);
  let eocd = -1; for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("Excel dosyası okunamadı.");
  const n = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true); const files = {};
  for (let k = 0; k < n; k++) {
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nl));
    files[name] = { method, csize, lo }; p += 46 + nl + el + cl;
  }
  const read = async name => {
    const f = files[name]; if (!f) return null;
    const start = f.lo + 30 + dv.getUint16(f.lo + 26, true) + dv.getUint16(f.lo + 28, true), data = b.subarray(start, start + f.csize);
    if (f.method === 0) return new TextDecoder().decode(data);
    const s = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return await new Response(s).text();
  };
  const ent = s => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(d)).replace(/&amp;/g, "&");
  const ss = []; const sx = await read("xl/sharedStrings.xml");
  if (sx) for (const m of sx.matchAll(/<si>([\s\S]*?)<\/si>/g)) ss.push(ent([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join("")));
  const sheetName = Object.keys(files).filter(f => /^xl\/worksheets\/sheet\d+\.xml$/.test(f)).sort()[0];
  const sh = sheetName && await read(sheetName); if (!sh) throw new Error("Excel dosyasında sayfa bulunamadı.");
  const col = r => { let c = 0; for (const ch of r.replace(/\d+/g, "")) c = c * 26 + ch.charCodeAt(0) - 64; return c - 1; };
  const rows = [];
  for (const rm of sh.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const cm of rm[1].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1], body = cm[2] || "", ref = (attrs.match(/r="([A-Z]+)\d+"/) || [])[1], t = (attrs.match(/t="(\w+)"/) || [])[1];
      let v = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      if (t === "s") v = ss[+v]; else if (t === "inlineStr") v = [...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join(""); 
      v = v == null ? "" : ent(String(v));
      row[ref ? col(ref) : row.length] = v;
    }
    for (let i = 0; i < row.length; i++) if (row[i] == null) row[i] = "";
    if (row.some(v => v !== "")) rows.push(row.map(v => v.trim()));
  }
  return rows;
}

const QH = ["Tarih", "Tutar", "Hesap", "Karşı hesap", "Kategori", "Başlık", "Not"];
export function parseQIF(text) {
  const rows = [QH]; let acc = "", type = "", rec = {}, inAcc = false;
  for (const raw of text.split(/\r?\n/)) {
    const l = raw.trim(); if (!l) continue;
    if (l[0] === "!") { const h = l.toLowerCase(); inAcc = h === "!account"; if (h.startsWith("!type:")) type = h.slice(6); continue; }
    const c = l[0], v = l.slice(1).trim();
    if (inAcc) { if (c === "N") acc = v; if (c === "^") inAcc = false; continue; }
    if (/^(cat|class|memorized|security|prices)/.test(type)) continue;
    if (c === "^") { if (rec.D) { const L = rec.L || "", tr = /^\[(.*)\]$/.exec(L); rows.push([qifDate(rec.D), rec.T || rec.U || "", acc, tr ? tr[1] : "", tr ? "" : L, rec.P || "", rec.M || ""]); } rec = {}; continue; }
    if (c === "S" || c === "E" || c === "$") continue;
    rec[c] = v;
  }
  return rows;
}
const qifDate = s => s.replace(/\s/g, "").replace(/'(\d{2})$/, "/20$1").replace("'", "/");

export function parseOFX(text) {
  const rows = [QH];
  const tag = (s, t) => { const m = new RegExp("<" + t + ">([^<\\r\\n]*)", "i").exec(s); return m ? m[1].trim() : ""; };
  const stmts = text.split(/<STMTRS>|<CCSTMTRS>/i).slice(1);
  for (const st of (stmts.length ? stmts : [text])) {
    const acc = tag(st, "ACCTID") ? "Hesap " + tag(st, "ACCTID").slice(-4) : "";
    for (const m of st.matchAll(/<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>)|(?=<\/BANKTRANLIST>))/gi)) {
      const t = m[1], d = tag(t, "DTPOSTED") || tag(t, "DTUSER");
      if (!d) continue;
      rows.push([d.slice(0, 4) + "-" + d.slice(4, 6) + "-" + d.slice(6, 8), tag(t, "TRNAMT"), acc, "", "", tag(t, "NAME") || tag(t, "PAYEE"), tag(t, "MEMO")]);
    }
  }
  return rows;
}

const norm = s => String(s || "").toLocaleLowerCase("tr").replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

export const IMP_FIELDS = [
  ["date", "Tarih"], ["amount", "Tutar"], ["out", "Gider tutarı"], ["in", "Gelir tutarı"], ["type", "Tür"], ["account", "Hesap"], ["to", "Karşı hesap"],
  ["parent", "Üst kategori"], ["category", "Kategori"], ["sub", "Alt kategori"], ["title", "Başlık / alıcı"], ["note", "Not"]
];
const SYN = {
  date: ["date", "period", "tarih", "islemtarihi", "transactiondate", "datetime", "bookingdate", "buchungsdatum", "datum", "fecha", "data", "dateandtime", "createdat", "posteddate", "valuedate", "valor"],
  amount: ["amount", "tutar", "miktar", "islemtutari", "tutartl", "tl", "value", "sum", "betrag", "importe", "montant", "importo", "valor", "transactionamount", "amountinaccountcurrency", "originalamount"],
  out: ["outflow", "debit", "debitamount", "withdrawal", "withdrawals", "expenseamount", "expense", "giden", "borc", "borctutari", "cikis", "paracikisi", "harcamatutari", "moneyout", "paidout", "ausgabe"],
  in: ["inflow", "credit", "creditamount", "deposit", "deposits", "incomeamount", "gelen", "alacak", "alacaktutari", "giris", "paragirisi", "moneyin", "paidin", "einnahme"],
  type: ["type", "tur", "islemturu", "islemtipi", "transactiontype", "incomeexpense", "kind", "categorytype", "income", "gelirgider", "typ", "tipo"],
  account: ["account", "accounts", "hesap", "hesapadi", "wallet", "cuzdan", "accountname", "sourcename", "sourceaccount", "fromaccount", "konto", "cuenta", "compte", "conto", "kaynakhesap"],
  to: ["toaccount", "transferaccount", "karsihesap", "hedefhesap", "destinationname", "destinationaccount", "toaccounttocategory", "targetaccount"],
  parent: ["parentcategory", "ustkategori", "anakategori", "categorygroup", "maincategory", "kategorigrubu"],
  category: ["category", "kategori", "categoryname", "kategoriadi", "categorygroupcategory", "envelope", "zarf", "kategorie", "categoria", "categorie"],
  sub: ["subcategory", "altkategori", "subcategoryname", "unterkategorie", "subcategoria"],
  title: ["payee", "title", "baslik", "itemorpayee", "merchant", "lehdar", "alici", "karsitaraf", "counterparty", "name", "description", "aciklama", "islemaciklamasi", "beschreibung", "concepto", "libelle", "descripcion", "details", "narrative"],
  note: ["note", "notes", "not", "notlar", "memo", "remarks", "comment", "comments", "yorum", "aciklama2", "bemerkung", "nota"]
};

// Find the header row (bank exports often have a preamble) and return {head, body}.
export function detectTable(rows) {
  let hi = 0, best = 0;
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const hits = rows[i].filter(c => Object.values(SYN).some(l => l.includes(norm(c)))).length;
    if (hits > best) { best = hits; hi = i; }
  }
  if (best < 2) { const w = Math.max(...rows.map(r => r.length)); return { head: Array.from({ length: w }, (_, i) => "Sütun " + (i + 1)), body: rows, noHeader: true }; }
  const head = rows[hi].map((h, i) => h || "Sütun " + (i + 1));
  return { head, body: rows.slice(hi + 1).filter(r => r.length > 1 || (r[0] || "") !== "") };
}

const TYPE_E = ["expense", "expenses", "exp", "gider", "harcama", "masraf", "cikis", "out", "outflow", "withdrawal", "debit", "payment", "spending", "odeme", "borc", "ausgabe", "gasto", "gastos", "depense", "false", "e", "dr"];
const TYPE_I = ["income", "inc", "gelir", "giris", "in", "inflow", "deposit", "credit", "revenue", "alacak", "einnahme", "ingreso", "ingresos", "revenu", "true", "i", "cr", "refund", "iade"];
const TYPE_T = ["transfer", "transfers", "transferout", "transferin", "virman", "aktarim", "hesaplararasi", "umbuchung", "transferencia", "virement"];
export function typeOf(v) {
  const n = norm(v); if (!n) return null;
  if (TYPE_T.includes(n)) return n === "transferin" ? "tin" : "tr";
  if (TYPE_E.includes(n)) return "e";
  if (TYPE_I.includes(n)) return "i";
  return null;
}

export function autoMap(tab) {
  const map = {}, used = new Set(), H = tab.head.map(norm), col = i => tab.body.map(r => r[i] || "");
  const pick = (f, test) => { for (const s of SYN[f]) { const i = H.findIndex((h, j) => h === s && !used.has(j) && (!test || test(j))); if (i >= 0) { map[f] = i; used.add(i); return; } } };
  const typeLike = j => { const v = col(j).filter(Boolean); return v.length > 0 && v.filter(x => typeOf(x)).length >= v.length * 0.6; };
  const dateLike = j => { const v = col(j).filter(Boolean).slice(0, 50); return v.length > 0 && v.filter(x => parseDateParts(x)).length >= v.length * 0.5; };
  const numLike = j => { const v = col(j).filter(Boolean).slice(0, 50); return v.length > 0 && v.filter(x => !isNaN(parseAmount(x))).length >= v.length * 0.5; };
  pick("date", dateLike); pick("type", typeLike); pick("out", numLike); pick("in", numLike); pick("amount", numLike);
  ["account", "to", "parent", "category", "sub", "title", "note"].forEach(f => pick(f));
  if (map.amount == null && map.out == null) { const i = H.findIndex((h, j) => !used.has(j) && numLike(j) && !/bakiye|balance|saldo|kalan/.test(h)); if (i >= 0) { map.amount = i; used.add(i); } }
  if (map.date == null) { const i = H.findIndex((h, j) => !used.has(j) && dateLike(j)); if (i >= 0) { map.date = i; used.add(i); } }
  if (map.type == null) { const i = H.findIndex((h, j) => !used.has(j) && typeLike(j)); if (i >= 0) { map.type = i; used.add(i); } }
  if (map.title == null && tab.noHeader) { const i = tab.head.findIndex((h, j) => !used.has(j) && col(j).some(v => v && isNaN(parseAmount(v)) && !parseDateParts(v))); if (i >= 0) map.title = i; }
  return map;
}

export function detectFormat(head) {
  const H = head.map(norm), has = (...k) => k.every(x => H.includes(x));
  if (has("tarih", "tur", "tutar", "hesap", "karsihesap")) return "Bütçe CSV";
  if (has("outflow", "inflow", "payee")) return "YNAB";
  if (has("incomeexpense")) return "Money Manager";
  if (has("itemorpayee")) return "Bluecoins";
  if (has("expenseamount", "incomeamount")) return "Toshl";
  if (has("fromaccount", "toaccounttocategory")) return "1Money";
  if (has("wallet", "categoryname", "type")) return "Spendee";
  if (has("refcurrency") || has("account", "category", "currency", "amount", "type", "paymenttype")) return "Wallet (BudgetBakers)";
  if (has("originaldescription", "transactiontype")) return "Mint";
  if (has("sourcename", "destinationname")) return "Firefly III";
  if (has("subcategoryname", "income")) return "Cashew";
  if (has("wallet", "category", "amount")) return "Money Lover";
  if (has("date", "account", "category", "amount", "currency", "convertedamount")) return "Monefy";
  if (has("envelope")) return "Goodbudget";
  return null;
}

// Number parser that accepts 1.234,56 / 1,234.56 / (12.50) / 12.50- / "₺ 12" / 1'234.50; dec is "," or "." when known.
export function parseAmount(v, dec) {
  if (v == null) return NaN; if (typeof v === "number") return v;
  let s = String(v).trim(); if (!s) return NaN;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  s = s.replace(/[\s '’]/g, "").replace(/[^\d.,+\-]/g, "");
  if (/-$/.test(s)) { neg = !neg; s = s.slice(0, -1); }
  if (/^-/.test(s)) { neg = !neg; s = s.slice(1); } else s = s.replace(/^\+/, "");
  if (!/\d/.test(s) || /[+\-]/.test(s)) return NaN;
  const lc = s.lastIndexOf(","), lp = s.lastIndexOf(".");
  let d = dec;
  if (lc >= 0 && lp >= 0) d = lc > lp ? "," : ".";
  else if (!d) { const sep = lc >= 0 ? "," : lp >= 0 ? "." : null; if (sep) { const parts = s.split(sep); d = parts.length === 2 && parts[1].length !== 3 ? sep : (parts.length > 2 ? (sep === "," ? "." : ",") : null); } }
  if (d === ",") s = s.replace(/\./g, "").replace(",", ".");
  else if (d === ".") s = s.replace(/,/g, "");
  else s = s.replace(/[.,]/g, "");
  const n = Number(s); return isFinite(n) ? (neg ? -n : n) : NaN;
}
// Decide the decimal separator for a whole column from its unambiguous values.
export function decimalOf(values) {
  let c = 0, p = 0;
  for (const v of values) { const s = String(v || "").replace(/[^\d.,]/g, ""); if (/,\d{1,2}$/.test(s) || /\.\d{3},/.test(s)) c++; if (/\.\d{1,2}$/.test(s) || /,\d{3}\./.test(s)) p++; }
  return c > p ? "," : p > c ? "." : null;
}

const MON = { jan: 1, oca: 1, feb: 2, sub: 2, mar: 3, apr: 4, nis: 4, may: 5, jun: 6, haz: 6, jul: 7, tem: 7, aug: 8, agu: 8, sep: 9, eyl: 9, oct: 10, eki: 10, nov: 11, kas: 11, dec: 12, ara: 12 };
// Returns {a,b,y} (ambiguous day/month order) or {y,m,d} when certain.
function parseDateParts(v) {
  let s = String(v || "").trim(); if (!s) return null;
  if (/^\d{4,5}(\.\d+)?$/.test(s) && +s > 20000 && +s < 80000) { const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(+s) * 864e5); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }; }
  if (/^\d{12,13}$/.test(s)) { const d = new Date(+s); return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() }; }
  if (/^\d{8}$/.test(s)) return { y: +s.slice(0, 4), m: +s.slice(4, 6), d: +s.slice(6, 8) };
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s); if (m) return { y: +m[1], m: +m[2], d: +m[3] };
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/.exec(s); if (m) { let y = +m[3]; if (y < 100) y += 2000; return { a: +m[1], b: +m[2], y }; }
  const t = norm(s.replace(/[,]/g, " ")).replace(/(\d)([a-z])/g, "$1 $2").replace(/([a-z])(\d)/g, "$1 $2");
  m = /^(\d{1,2}) ?([a-z]{3})[a-z]* ?(\d{4})/.exec(t) || /^[a-z]* ?(\d{1,2}) ?([a-z]{3})[a-z]* ?(\d{4})/.exec(t); if (m && MON[m[2]]) return { y: +m[3], m: MON[m[2]], d: +m[1] };
  m = /^(?:[a-z]+ )?([a-z]{3})[a-z]* ?(\d{1,2}) ?(\d{4})/.exec(t); if (m && MON[m[1]]) return { y: +m[3], m: MON[m[1]], d: +m[2] };
  return null;
}
// "dmy" | "mdy" for a column of dates; dmy unless the data proves otherwise.
export function dateOrderOf(values) {
  let dmy = 0, mdy = 0;
  for (const v of values) { const p = parseDateParts(v); if (p && p.a != null) { if (p.a > 12) dmy++; if (p.b > 12) mdy++; } }
  return mdy > dmy ? "mdy" : "dmy";
}
export function parseDate(v, order) {
  const p = parseDateParts(v); if (!p) return null;
  let y = p.y, m = p.m, d = p.d;
  if (p.a != null) { [d, m] = order === "mdy" ? [p.b, p.a] : [p.a, p.b]; if (m > 12 && d <= 12) [d, m] = [m, d]; }
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31 && y > 1970 && y < 2200)) return null;
  return y + "-" + pad(m) + "-" + pad(d);
}

const isTransferCat = s => TYPE_T.includes(norm(s));
const splitPath = s => String(s || "").split(/\s*(?::|›|»|>|\s\/\s)\s*/).map(x => x.trim()).filter(Boolean);

// Turn a mapped table into neutral records. opt: { order, sign: "auto"|"e"|"i", fmt }
export function convertTable(tab, map, opt = {}) {
  const get = (r, f) => map[f] != null ? (r[map[f]] || "").trim() : "";
  const colVals = f => map[f] != null ? tab.body.map(r => r[map[f]]) : [];
  const order = opt.order && opt.order !== "auto" ? opt.order : dateOrderOf(colVals("date"));
  const dec = { amount: decimalOf(colVals("amount")), out: decimalOf(colVals("out")), in: decimalOf(colVals("in")) };
  const one = opt.fmt === "1Money";
  const recs = [], bad = [];
  tab.body.forEach((r, idx) => {
    const d = parseDate(get(r, "date"), order);
    let amt = NaN;
    if (map.amount != null) amt = parseAmount(get(r, "amount"), dec.amount);
    if (map.out != null || map.in != null) { const o = parseAmount(get(r, "out"), dec.out), i = parseAmount(get(r, "in"), dec.in); if (!isNaN(o) && o !== 0) amt = -Math.abs(o); else if (!isNaN(i) && i !== 0) amt = Math.abs(i); else if (isNaN(amt)) amt = !isNaN(o) || !isNaN(i) ? 0 : NaN; }
    if (!d || isNaN(amt)) { if (r.some(v => v)) bad.push(idx); return; }
    if (amt === 0) return;
    const tRaw = map.type != null ? norm(get(r, "type")) : "";
    let k = map.type != null ? typeOf(get(r, "type")) : null;
    let acc = get(r, "account"), to = get(r, "to"), title = get(r, "title"), cat = [get(r, "parent"), ...splitPath(get(r, "category")), get(r, "sub")].filter(Boolean);
    if (one) { if (k === "i") { cat = splitPath(acc); acc = to; to = ""; } else if (k === "e") { cat = splitPath(to); to = ""; } }
    if (opt.fmt === "Firefly III" && k === "i") { acc = to; to = ""; }
    const yt = /^(?:transfer|aktarim|virman)\s*:\s*(.+)$/i.exec(title);
    if (yt && !to) { to = yt[1].trim(); k = "tr"; title = ""; }
    if (!k && cat.length && isTransferCat(cat[cat.length - 1])) k = "tr";
    if (!k && to) k = "tr";
    if (!k) k = opt.sign === "e" ? "e" : opt.sign === "i" ? "i" : amt < 0 ? "e" : "i";
    if ((k === "tr" || k === "tin") && !to && map.to == null && cat.length && !isTransferCat(cat[cat.length - 1])) to = cat.join(":");
    if (k !== "tr" && k !== "tin" && map.to != null && opt.fmt !== "Firefly III") to = "";
    const rec = { d, k, a: r2(Math.abs(amt)), acc, to, cat, t: title, n: get(r, "note"), row: idx, neg: amt < 0, gen: k === "tr" && tRaw !== "transferout" };
    if (map.note != null && map.note === map.title) rec.n = "";
    if (k === "tr" || k === "tin") rec.cat = [];
    recs.push(rec);
  });
  // signed files: a positive "transfer" row is money coming in
  const signed = recs.some(x => x.neg);
  recs.forEach(x => { if (x.k === "tr" && x.gen && !x.neg && signed) x.k = "tin"; delete x.neg; delete x.gen; });
  // pair transfer halves / normalise direction
  const out = [], open = [];
  for (const r of recs) {
    if (r.k !== "tr" && r.k !== "tin") { out.push(r); continue; }
    if (r.to) { if (r.k === "tin") [r.acc, r.to] = [r.to, r.acc]; r.k = "tr"; out.push(r); continue; }
    const j = open.findIndex(o => o.d === r.d && o.a === r.a && o.k !== r.k && norm(o.acc) !== norm(r.acc));
    if (j >= 0) { const o = open.splice(j, 1)[0], src = r.k === "tr" ? r : o, dst = r.k === "tr" ? o : r; out.push({ ...src, k: "tr", to: dst.acc, n: src.n || dst.n }); }
    else open.push(r);
  }
  open.forEach(r => out.push({ ...r, k: r.k === "tr" ? "e" : "i", t: r.t || "Transfer" }));
  // same transfer listed under both accounts (QIF) -> keep one
  const seen = new Set();
  return { recs: out.filter(r => { if (r.k !== "tr") return true; const key = r.d + "|" + r.a + "|" + norm(r.acc) + "|" + norm(r.to); if (seen.has(key)) return false; seen.add(key); return true; }), bad, order };
}

const PAL = ["#5b8def", "#e5734b", "#3fa66b", "#b25fd0", "#d4a72c", "#4bb3c4", "#d0576f", "#7d8a90", "#8a6fdf", "#6aa84f"];
// Merge records into the current meta + month lists. Adds missing accounts/categories, skips duplicates.
export function mergeImport(meta, months, recs, opt = {}) {
  const m = JSON.parse(JSON.stringify(meta)); m.accounts = m.accounts || []; m.categories = m.categories || [];
  const newAccs = [], newCats = [];
  const findAcc = name => m.accounts.find(a => norm(a.name) === norm(name));
  const accId = name => {
    if (!name) return opt.defAcc || (m.accounts[0] || {}).id || accId("Nakit");
    let a = findAcc(name);
    if (!a) { const n = norm(name); a = { id: rid(), name: name.trim(), type: /kart|card|kredi|credit|visa|master|amex/.test(n) ? "kart" : /nakit|cash|cuzdan|wallet|purse/.test(n) ? "nakit" : "banka", color: PAL[m.accounts.length % PAL.length], order: m.accounts.length, start: 0, hidden: false, exclude: /kart|card|credit/.test(n) }; m.accounts.push(a); newAccs.push(a.name); }
    return a.id;
  };
  const catId = (path, k) => {
    if (!path.length || k === "tr") return null;
    const type = k === "i" ? "I" : "E"; let parent = null;
    for (const name of path.slice(0, 2)) {
      let c = m.categories.find(x => x.type === type && (x.parent || null) === parent && norm(x.name) === norm(name));
      if (!c && parent === null && path.length === 1) c = m.categories.find(x => x.type === type && norm(x.name) === norm(name));
      if (!c) { c = { id: rid(), name: name, type, color: PAL[m.categories.length % PAL.length], parent }; m.categories.push(c); newCats.push((parent ? m.categories.find(x => x.id === parent).name + ":" : "") + name); }
      parent = c.id;
    }
    return parent;
  };
  const key = t => t.d + "|" + t.k + "|" + r2(t.a) + "|" + t.acc + "|" + norm(t.t);
  const have = new Set(Object.values(months).flat().map(key));
  const add = []; let dup = 0, seq = 0;
  for (const r of recs) {
    const t = { id: rid(), k: r.k, d: r.d, ts: new Date(r.d + "T12:00:00").getTime() + (seq++ % 1000), a: r.a, acc: accId(r.acc), t: r.t || "", n: r.n || "" };
    if (r.k === "tr") { t.to = accId(r.to); if (t.to === t.acc) continue; } else t.cat = catId(r.cat, r.k);
    const kk = key(t); if (have.has(kk)) { dup++; continue; } have.add(kk);
    add.push(t);
  }
  return { meta: m, add, dup, newAccs, newCats };
}

// Read any supported file into a table. Returns {head, body, noHeader?, kind}.
export async function readImportFile(name, buf) {
  const ext = (name.split(".").pop() || "").toLowerCase(), b = new Uint8Array(buf);
  if (b[0] === 0x50 && b[1] === 0x4b) return { ...detectTable(await readXlsx(buf)), kind: "Excel" };
  if (b[0] === 0xd0 && b[1] === 0xcf) throw new Error("Eski Excel (.xls) okunamıyor. Dosyayı .xlsx ya da CSV olarak kaydedip tekrar deneyin.");
  const text = decodeText(buf);
  if (ext === "qif" || /^\s*!(type|account|option)/i.test(text)) return { head: QH, body: parseQIF(text).slice(1), kind: "QIF" };
  if (/<OFX>|OFXHEADER/i.test(text)) return { head: QH, body: parseOFX(text).slice(1), kind: "OFX" };
  return { ...detectTable(parseCSV(text)), kind: ext === "tsv" || ext === "txt" ? "TXT" : "CSV" };
}
