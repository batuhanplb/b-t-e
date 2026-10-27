// Nakit akışı simülasyonu — geçmiş aylardan ağırlıklı tahmin.
//
// Amaç: "düzenli gider" tahminini elle yazmak yerine kullanıcının gerçek
// harcama geçmişinden türetmek. Basit ortalama (toplam / ay sayısı) gerçeğe
// yakın değil: son aylarda artan/azalan bir kalemde eski aylar tahmini
// aşağı/yukarı çekiyor. Bu yüzden:
//   * üstel ağırlıklı ortalama (yarı ömür SIM_HALF_LIFE ay) → yakın aylar ağır,
//   * uç değer kırpma → tek seferlik büyük harcama tahmini şişirmiyor,
//   * ay içi harcama düşümü → tahmin 20.000 ise 1.000 harcanınca nakitten
//     19.000 düşülüyor (kalan tahmin).
//
// Dosya tarayıcı-güvenli ve saf: DOM'a ya da uygulama durumuna dokunmaz,
// birim testleri src/test/cash-sim.test.js içinde.

export const SIM_LOOKBACK = 12; // kaç ay geriye bakılır
export const SIM_HALF_LIFE = 3; // 3 ay eskiyen ayın ağırlığı yarıya düşer

const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
const pad = n => String(n).padStart(2, "0");

// "YYYY-MM" üzerine ay ekler (core.js'e bağımlı olmadan).
export function addMonth(m, k) {
  const [y, mo] = String(m).split("-").map(Number);
  const t = y * 12 + (mo - 1) + k;
  return Math.floor(t / 12) + "-" + pad((t % 12) + 1);
}

// Cari aydan geriye bakılacak aylar, eski → yeni.
export function simMonths(curMonth, lookback = SIM_LOOKBACK) {
  const out = [];
  for (let k = lookback; k >= 1; k--) out.push(addMonth(curMonth, -k));
  return out;
}

export function median(values) {
  const a = values.slice().sort((x, y) => x - y), n = a.length;
  if (!n) return 0;
  return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2;
}

// Tek seferlik büyük harcamaların tahmini şişirmesini engeller: pozitif
// ayların medyanının `factor` katı üstü kırpılır. Az veri varsa dokunulmaz.
export function capOutliers(values, factor = 2.5) {
  const pos = values.filter(v => v > 0);
  if (pos.length < 4) return values.slice();
  const cap = median(pos) * factor;
  return values.map(v => (v > cap ? cap : v));
}

// Üstel ağırlıklı ortalama: yaşı `halfLife` ay olan ayın ağırlığı yarıya iner.
export function weightedMean(values, halfLife = SIM_HALF_LIFE) {
  const n = values.length;
  let sw = 0, sv = 0;
  for (let i = 0; i < n; i++) {
    const age = n - 1 - i, w = Math.pow(0.5, age / halfLife);
    sw += w; sv += w * (Number(values[i]) || 0);
  }
  return sw ? sv / sw : 0;
}

const mean = a => (a.length ? a.reduce((s, v) => s + (Number(v) || 0), 0) / a.length : 0);

// Aylık seriden tahmin üretir.
// values: eski → yeni aylık toplamlar (sıfır aylar dahil).
// Dönen: { avg, raw, trend, last, months, span, active }
//   avg    : ağırlıklı tahmin (simülasyonda kullanılan değer)
//   raw    : düz ortalama (karşılaştırma/gösterim için)
//   trend  : son 3 ayın ortalaması, ondan önceki 3 aya göre yüzde değişim
//   span   : kalemin ilk göründüğü aydan bu yana ay sayısı
//   active : harcama görülen ay sayısı
// Kalemin ilk göründüğü aydan öncesi "veri yok" sayılır: yeni başlayan bir
// kalemde boş geçmiş aylar tahmini aşağı çekmez (3 aydır 20.000 harcanan
// Mutfak 20.000 tahmin edilir, 10.667 değil). Aradaki boş aylar ise sayılır:
// iki ayda bir yapılan harcama tahmini düşürür.
export function simEstimate(values, opt = {}) {
  const halfLife = opt.halfLife || SIM_HALF_LIFE;
  const vals = (values || []).map(v => Number(v) || 0);
  const first = vals.findIndex(v => v > 0);
  const used = first < 0 ? [] : vals.slice(first);
  const capped = capOutliers(used, opt.factor);
  const avg = r2(weightedMean(capped, halfLife));
  const recent = mean(used.slice(-3)), older = mean(used.slice(-6, -3));
  const trend = older > 0 ? (recent - older) / older : (recent > 0 ? 1 : 0);
  return {
    avg,
    raw: r2(mean(used)),
    trend: r2(trend),
    last: r2(vals.length ? vals[vals.length - 1] : 0),
    months: vals.length,
    span: used.length,
    active: used.filter(v => v > 0).length,
  };
}

// Ay içinde harcanmaya başlanan tutarı tahminden düşer.
// Örn. tahmin 20.000, ay içinde 1.000 harcandı → nakitten 19.000 düşer.
export function simRemaining(est, spent) {
  const e = Math.max(0, Number(est) || 0), s = Math.max(0, Number(spent) || 0);
  return { est: r2(e), spent: r2(s), rem: r2(Math.max(0, e - s)), done: e > 0 && s >= e - 0.005 };
}

// Seçili kategori/lehdarların aylık toplamları.
//   txs   : gider işlemleri (düz dizi)
//   sel   : [{ t: "cat" | "pay", v: kategori id | lehdar adı }]
//   opt   : { catMap, payOf(t), partsOf(t) }
//           catMap → { id: { id, parent } } (kategori ağacı)
//           payOf  → lehdar adı, partsOf → [{ cat, a }] (bölünmüş işlemler)
// Dönen: { "cat:<id>": { "2026-09": 1234.5, ... }, "pay:<ad>": {...} }
// Kategori seçiminde alt kategoriler ve üst kategoriler dahil edilir.
export function simMonthlyTotals(txs, sel, opt = {}) {
  const catMap = opt.catMap || {};
  const payOf = opt.payOf || (t => (t.t || "").trim());
  const partsOf = opt.partsOf || (t => [{ cat: t.cat, a: t.a }]);
  const chain = id => {
    const out = []; let c = catMap[id], n = 0;
    while (c && n++ < 6) { out.push(c.id); c = c.parent ? catMap[c.parent] : null; }
    return out;
  };
  const norm = s => String(s || "").trim().toLocaleLowerCase("tr");
  const out = {};
  (sel || []).forEach(s => {
    const key = (s.t === "cat" ? "cat:" : "pay:") + s.v;
    const months = {};
    (txs || []).forEach(t => {
      const m = String(t.d || "").slice(0, 7), a = Number(t.a) || 0;
      if (!m || !a) return;
      let hit = 0;
      if (s.t === "cat") {
        if (s.v === "_") hit = t.cat ? 0 : a;
        else partsOf(t).forEach(p => { if (p.cat && chain(p.cat).includes(s.v)) hit += Number(p.a) || 0; });
      } else if (norm(payOf(t)) === norm(s.v)) hit = a;
      if (hit) months[m] = r2((months[m] || 0) + hit);
    });
    out[key] = months;
  });
  return out;
}
