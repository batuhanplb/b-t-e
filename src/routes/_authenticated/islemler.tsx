import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { addM, curMonth, fmt, monthLabel, monthTotals, useAccounts, useCategories, useRefresh, useTxs, type Tx } from "@/lib/data";
import { TxRow } from "@/components/TxRow";
import { TxDialog } from "@/components/TxDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/islemler")({
  head: () => ({ meta: [{ title: "İşlemler — Bütçe" }, { name: "description", content: "Tüm gelir, gider ve transferleriniz." }] }),
  component: Islemler,
});

function Islemler() {
  const { data: txs = [] } = useTxs();
  const { data: cats = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();
  const refresh = useRefresh();
  const [m, setM] = useState(curMonth());
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [acc, setAcc] = useState("");
  const [sel, setSel] = useState<Tx | null>(null);
  const [edit, setEdit] = useState<Tx | null>(null);

  const list = useMemo(() => {
    const s = q.toLocaleLowerCase("tr");
    return txs.filter((t) => t.date.startsWith(m) && (!type || t.type === type) && (!acc || t.account_id === acc || t.to_account_id === acc) &&
      (!s || (t.note ?? "").toLocaleLowerCase("tr").includes(s) || (cats.find((c) => c.id === t.category_id)?.name ?? "").toLocaleLowerCase("tr").includes(s)))
      .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));
  }, [txs, m, q, type, acc, cats]);
  const groups = useMemo(() => {
    const g = new Map<string, Tx[]>();
    list.forEach((t) => g.set(t.date, [...(g.get(t.date) ?? []), t]));
    return [...g.entries()];
  }, [list]);
  const tot = monthTotals(txs, m);

  async function del(scope: "one" | "rest" | "all") {
    if (!sel) return;
    let r;
    if (scope === "one" || !sel.group_id) r = await supabase.from("transactions").delete().eq("id", sel.id);
    else if (scope === "rest") r = await supabase.from("transactions").delete().eq("group_id", sel.group_id).gte("date", sel.date);
    else r = await supabase.from("transactions").delete().eq("group_id", sel.group_id);
    if (r.error) return toast.error(r.error.message);
    toast.success("Silindi"); setSel(null); refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button aria-label="Önceki ay" className="grid size-10 place-items-center rounded-lg hover:bg-muted" onClick={() => setM(addM(m, -1))}><ChevronLeft /></button>
        <h1 className="text-xl font-bold">{monthLabel(m)}</h1>
        <button aria-label="Sonraki ay" className="grid size-10 place-items-center rounded-lg hover:bg-muted" onClick={() => setM(addM(m, 1))}><ChevronRight /></button>
      </div>
      <div className="grid grid-cols-3 gap-2 rounded-2xl border bg-card p-3 text-center text-sm">
        <div><div className="text-muted-foreground">Gelir</div><div className="font-bold text-income">{fmt(tot.inc)}</div></div>
        <div><div className="text-muted-foreground">Gider</div><div className="font-bold text-expense">{fmt(tot.exp)}</div></div>
        <div><div className="text-muted-foreground">Net</div><div className="font-bold">{fmt(tot.net)}</div></div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Ara (not, kategori)" value={q} onChange={(e) => setQ(e.target.value)} className="min-w-40 flex-1" />
        <select className="h-9 rounded-md border bg-card px-2 text-sm" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Tüm türler</option><option value="gider">Gider</option><option value="gelir">Gelir</option><option value="transfer">Transfer</option>
        </select>
        <select className="h-9 rounded-md border bg-card px-2 text-sm" value={acc} onChange={(e) => setAcc(e.target.value)}>
          <option value="">Tüm hesaplar</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      {groups.length === 0 ? <p className="py-10 text-center text-muted-foreground">Bu ay için işlem yok.</p> : groups.map(([d, items]) => (
        <section key={d} className="rounded-2xl border bg-card px-4 py-1">
          <div className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {new Date(d + "T00:00").toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" })}
          </div>
          <ul className="divide-y">{items.map((t) => <TxRow key={t.id} tx={t} onClick={() => setSel(t)} />)}</ul>
        </section>
      ))}

      <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>İşlem</DialogTitle></DialogHeader>
          {sel && <ul><TxRow tx={sel} /></ul>}
          <div className="grid gap-2">
            <Button variant="outline" onClick={() => { setEdit(sel); setSel(null); }}><Pencil className="size-4" /> Düzenle</Button>
            <Button variant="destructive" onClick={() => del("one")}><Trash2 className="size-4" /> {sel?.group_id ? "Sadece bu taksiti sil" : "Sil"}</Button>
            {sel?.group_id && <>
              <Button variant="destructive" onClick={() => del("rest")}>Bu ve sonraki taksitleri sil</Button>
              <Button variant="destructive" onClick={() => del("all")}>Tüm taksitleri sil</Button>
            </>}
          </div>
        </DialogContent>
      </Dialog>
      <TxDialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)} edit={edit} />
    </div>
  );
}
