// Kredi kartı ekstresi: dönem hesabı, PDF metin ayrıştırma ve işlem eşleştirme.
// Tamamen cihazda çalışır; yapay zekâ / sunucu kullanılmaz.
const pad = n => String(n).padStart(2, "0");
const ymd = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const dim = (y, m) => new Date(y, m + 1, 0).getDate();

// Kesim günü c olan kartın, `now` tarihine göre son kesilen (off=0) ekstre dönemi [başlangıç, bitiş].
// Kesim günü o ekstreye dahildir; sonraki gün yeni döneme girer.
export function stmtRange(cut, now = new Date(), off = 0) {
  const c = Math.max(1, Math.min(31, Number(cut) || 1));
  let y = now.getFullYear(), m = now.getMonth();
  if (now.getDate() < Math.min(c, dim(y, m))) m--;
  m += off;
  const e = new Date(y, m, 1), s = new Date(y, m - 1, 1);
  const end = new Date(e.getFullYear(), e.getMonth(), Math.min(c, dim(e.getFullYear(), e.getMonth())));
  const st = new Date(s.getFullYear(), s.getMonth(), Math.min(c, dim(s.getFullYear(), s.getMonth())) + 1);
  return [ymd(st), ymd(end)];
}

// "1.234,56" / "1234,56" / "-45,00" / "45,00-" → sayı
export function parseTrAmount(s) {
  s = String(s).replace(/\s|TL|₺/g, "");
  const neg = /^-|-$/.test(s) || /^\(.*\)$/.test(s);
  s = s.replace(/[()+-]/g, "").replace(/\./g, "").replace(",", ".");
  const v = Number(s);
  return isFinite(v) ? (neg ? -v : v) : NaN;
}

const DATE_RE = /(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/;
const AMT_RE = /[-(]?\d{1,3}(?:\.\d{3})*,\d{2}\)?-?|[-(]?\d+,\d{2}\)?-?/g;

// PDF'den çıkarılmış satırlardan işlem listesi: {d, a, t, credit}
export function parseStatementLines(lines) {
  const out = [];
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, " ").trim();
    const dm = line.match(DATE_RE);
    if (!dm || dm.index > 6) continue;
    let yy = Number(dm[3]); if (yy < 100) yy += 2000;
    const mo = Number(dm[2]), dd = Number(dm[1]);
    if (mo < 1 || mo > 12 || dd < 1 || dd > 31) continue;
    const rest = line.slice(dm.index + dm[0].length);
    const amts = rest.match(AMT_RE);
    if (!amts) continue;
    // Taksitli satırlarda ilk tutar genelde bu ayki taksittir; tek tutar varsa onu al.
    const first = amts[0];
    const a = parseTrAmount(first);
    if (!isFinite(a) || a === 0) continue;
    const t = rest.slice(0, rest.indexOf(first)).replace(DATE_RE, "").replace(/\s+/g, " ").trim();
    if (/önceki dönem|toplam|asgari|son ödeme|dönem borcu/i.test(t)) continue;
    const credit = a < 0 || /ödeme|iade|iptal/i.test(t);
    out.push({ d: yy + "-" + pad(mo) + "-" + pad(dd), a: Math.abs(a), t, credit });
  }
  return out;
}

const dayDiff = (a, b) => Math.abs((new Date(a) - new Date(b)) / 864e5);

// Ekstre satırlarını uygulamadaki işlemlerle karşılaştırır.
// ok: tarih±3 gün ve tutar aynı; diff: tarih±3 gün ve aynı açıklama/en yakın, tutar farklı; missing: bankada var bizde yok; extra: bizde var bankada yok
export function reconcile(bank, mine) {
  const used = new Set(), ok = [], diff = [], missing = [];
  const rows = bank.filter(b => !b.credit);
  for (const b of rows) {
    let best = null;
    mine.forEach((t, i) => { if (!used.has(i) && Math.abs(t.a - b.a) < 0.01 && dayDiff(t.d, b.d) <= 3 && (!best || dayDiff(t.d, b.d) < best.dd)) best = { i, dd: dayDiff(t.d, b.d) }; });
    if (best) { used.add(best.i); ok.push({ b, t: mine[best.i] }); continue; }
    missing.push(b);
  }
  // Tutar farkı: kalan bankadaki satırı, aynı gün (±2) kalan işlemle eşleştir
  const still = [];
  for (const b of missing) {
    let best = null;
    mine.forEach((t, i) => { if (!used.has(i) && dayDiff(t.d, b.d) <= 2) { const r = Math.abs(t.a - b.a) / Math.max(t.a, b.a); if (r < 0.5 && (!best || r < best.r)) best = { i, r }; } });
    if (best) { used.add(best.i); diff.push({ b, t: mine[best.i] }); } else still.push(b);
  }
  const extra = mine.filter((_, i) => !used.has(i));
  return { ok, diff, missing: still, extra };
}

// pdf.js ile PDF'i satırlara çevirir (yalnızca tarayıcıda).
export async function pdfLines(file) {
  const pdfjs = await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const lines = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    const rows = new Map();
    for (const it of tc.items) {
      if (!it.str || !it.str.trim()) continue;
      const y = Math.round(it.transform[5] / 3);
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y).push([it.transform[4], it.str]);
    }
    [...rows.entries()].sort((a, b) => b[0] - a[0]).forEach(([, r]) => lines.push(r.sort((a, b) => a[0] - b[0]).map(x => x[1]).join(" ")));
  }
  return lines;
}
