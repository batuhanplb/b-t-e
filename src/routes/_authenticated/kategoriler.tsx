import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { curMonth, fmt, parseAmt, useCategories, useRefresh, useTxs, type Category } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/kategoriler")({
  head: () => ({ meta: [{ title: "Kategoriler ve bütçe — Bütçe" }, { name: "description", content: "Kategoriler ve aylık bütçe limitleri." }] }),
  component: Kategoriler,
});

function Kategoriler() {
  const { data: cats = [] } = useCategories();
  const { data: txs = [] } = useTxs();
  const refresh = useRefresh();
  const [edit, setEdit] = useState<Partial<Category> | null>(null);
  const [budget, setBudget] = useState("");
  const m = curMonth();
  const spent = (id: string) => txs.filter((t) => t.category_id === id && t.date.startsWith(m)).reduce((s, t) => s + Number(t.amount), 0);

  function open(c?: Partial<Category>) {
    setEdit(c ?? { name: "", kind: "gider", color: "#7d8a90" });
    setBudget(c?.monthly_budget ? String(c.monthly_budget).replace(".", ",") : "");
  }
  async function save() {
    if (!edit?.name?.trim()) return toast.error("Ad girin");
    const b = budget.trim() ? parseAmt(budget) : null;
    const row = { name: edit.name.trim(), kind: edit.kind!, color: edit.color!, monthly_budget: b && b > 0 ? b : null };
    const r = edit.id ? await supabase.from("categories").update(row).eq("id", edit.id) : await supabase.from("categories").insert(row);
    if (r.error) return toast.error(r.error.message);
    toast.success("Kaydedildi"); setEdit(null); refresh();
  }
  async function remove() {
    if (!edit?.id || !confirm("Kategori silinsin mi? İşlemler kategorisiz kalır.")) return;
    const r = await supabase.from("categories").delete().eq("id", edit.id);
    if (r.error) return toast.error(r.error.message);
    toast.success("Silindi"); setEdit(null); refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Kategoriler</h1>
        <Button onClick={() => open()}><Plus className="size-4" /> Kategori</Button>
      </div>
      {(["gider", "gelir"] as const).map((k) => (
        <section key={k} className="rounded-2xl border bg-card p-2">
          <div className="px-2 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{k === "gider" ? "Gider" : "Gelir"} kategorileri</div>
          {cats.filter((c) => c.kind === k).map((c) => {
            const s = spent(c.id); const b = Number(c.monthly_budget);
            return (
              <button key={c.id} onClick={() => open(c)} className="w-full rounded-xl px-2 py-3 text-left hover:bg-muted">
                <div className="flex items-center gap-3">
                  <span className="size-3.5 rounded-full" style={{ background: c.color }} />
                  <span className="flex-1 font-medium">{c.name}</span>
                  <span className="text-sm text-muted-foreground">{fmt(s)}{b ? ` / ${fmt(b)}` : ""}</span>
                </div>
                {b > 0 && <div className="ml-6 mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full ${s >= b ? "bg-expense" : s >= b * 0.8 ? "bg-warning" : "bg-primary"}`} style={{ width: `${Math.min(100, (s / b) * 100)}%` }} />
                </div>}
              </button>
            );
          })}
        </section>
      ))}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{edit?.id ? "Kategoriyi düzenle" : "Yeni kategori"}</DialogTitle></DialogHeader>
          {edit && <div className="space-y-3">
            <div><Label>Ad</Label><Input value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div><Label>Tür</Label>
                <select className="h-9 w-full rounded-md border bg-card px-2 text-sm" value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value })}>
                  <option value="gider">Gider</option><option value="gelir">Gelir</option>
                </select></div>
              <div><Label>Renk</Label><Input type="color" className="w-14 p-1" value={edit.color} onChange={(e) => setEdit({ ...edit, color: e.target.value })} /></div>
            </div>
            {edit.kind === "gider" && <div><Label>Aylık bütçe limiti (₺, isteğe bağlı)</Label><Input inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} /></div>}
            <Button className="w-full" onClick={save}>Kaydet</Button>
            {edit.id && <Button variant="ghost" className="w-full text-destructive" onClick={remove}>Kategoriyi sil</Button>}
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
