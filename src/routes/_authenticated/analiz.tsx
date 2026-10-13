import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addM, curMonth, fmt, monthLabel, monthTotals, TR_M, useCategories, useTxs } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/analiz")({
  head: () => ({ meta: [{ title: "Analiz — Bütçe" }, { name: "description", content: "Gelir-gider grafikleri ve kategori dağılımı." }] }),
  component: Analiz,
});

function Analiz() {
  const { data: txs = [] } = useTxs();
  const { data: cats = [] } = useCategories();
  const [m, setM] = useState(curMonth());
  const months = Array.from({ length: 6 }, (_, i) => addM(m, i - 5));
  const trend = months.map((x) => { const t = monthTotals(txs, x); return { ay: TR_M[Number(x.slice(5)) - 1].slice(0, 3), Gelir: t.inc, Gider: t.exp }; });
  const byCat = new Map<string, number>();
  txs.filter((t) => t.type === "gider" && t.date.startsWith(m)).forEach((t) => byCat.set(t.category_id ?? "-", (byCat.get(t.category_id ?? "-") ?? 0) + Number(t.amount)));
  const dist = [...byCat.entries()].map(([id, v]) => { const c = cats.find((x) => x.id === id); return { name: c?.name ?? "Kategorisiz", value: v, color: c?.color ?? "#9a9fa3" }; }).sort((a, b) => b.value - a.value);
  const tot = monthTotals(txs, m);
  const prev = monthTotals(txs, addM(m, -1));
  const avg6 = trend.reduce((s, x) => s + x.Gider, 0) / 6;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button aria-label="Önceki ay" className="grid size-10 place-items-center rounded-lg hover:bg-muted" onClick={() => setM(addM(m, -1))}><ChevronLeft /></button>
        <h1 className="text-xl font-bold">{monthLabel(m)}</h1>
        <button aria-label="Sonraki ay" className="grid size-10 place-items-center rounded-lg hover:bg-muted" onClick={() => setM(addM(m, 1))}><ChevronRight /></button>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["Toplam gelir", fmt(tot.inc)], ["Toplam gider", fmt(tot.exp)], ["Geçen aya göre gider", prev.exp ? `${tot.exp >= prev.exp ? "+" : ""}${(((tot.exp - prev.exp) / prev.exp) * 100).toFixed(0)}%` : "—"], ["6 ay ort. gider", fmt(avg6)]].map(([l, v]) => (
          <div key={l} className="rounded-2xl border bg-card p-3"><div className="text-xs text-muted-foreground">{l}</div><div className="mt-1 font-bold">{v}</div></div>
        ))}
      </div>
      <section className="rounded-2xl border bg-card p-4">
        <h2 className="mb-3 font-bold">Son 6 ay</h2>
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="ay" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} width={50} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}B` : v)} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 10 }} />
              <Bar dataKey="Gelir" fill="var(--income)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Gider" fill="var(--expense)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="rounded-2xl border bg-card p-4">
        <h2 className="mb-3 font-bold">Gider dağılımı</h2>
        {dist.length === 0 ? <p className="text-sm text-muted-foreground">Bu ay gider yok.</p> : (
          <div className="grid items-center gap-4 md:grid-cols-2">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={dist} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="90%" paddingAngle={2}>
                  {dist.map((d) => <Cell key={d.name} fill={d.color} stroke="none" />)}
                </Pie><Tooltip formatter={(v: number) => fmt(v)} /></PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-2">
              {dist.map((d) => (
                <li key={d.name} className="flex items-center gap-2 text-sm">
                  <span className="size-3 rounded-full" style={{ background: d.color }} /><span className="flex-1">{d.name}</span>
                  <span className="text-muted-foreground">{((d.value / tot.exp) * 100).toFixed(0)}%</span><span className="w-28 text-right font-semibold">{fmt(d.value)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
