import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { addMonthsToDate, fmt, parseAmt, ymd, useAccounts, useDebts, usePayments, useRefresh, type Debt } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/borclar")({
  head: () => ({ meta: [{ title: "Borçlar ve krediler — Bütçe" }, { name: "description", content: "Kredi ve borç ödemelerinizi takip edin." }] }),
  component: Borclar,
});

const KINDS: Record<string, string> = { kredi: "Kredi", borc: "Borç", alacak: "Alacak" };

function Borclar() {
  const { data: debts = [] } = useDebts();
  const { data: pays = [] } = usePayments();
  const { data: accounts = [] } = useAccounts();
  const refresh = useRefresh();
  const [edit, setEdit] = useState<{ d: Partial<Debt>; total: string; monthly: string; months: string } | null>(null);
  const [pay, setPay] = useState<{ d: Debt; amount: string; date: string; acc: string } | null>(null);

  const paid = (id: string) => pays.filter((p) => p.debt_id === id).reduce((s, p) => s + Number(p.amount), 0);

  async function save() {
    if (!edit) return;
    const total = parseAmt(edit.total);
    if (!edit.d.name?.trim() || !(total > 0)) return toast.error("Ad ve toplam tutar gerekli");
    const mp = edit.monthly.trim() ? parseAmt(edit.monthly) : null;
    const row = { name: edit.d.name.trim(), kind: edit.d.kind!, total, monthly_payment: mp && mp > 0 ? mp : null,
      months: parseInt(edit.months) || null, start_date: edit.d.start_date!, note: edit.d.note || null };
    const r = edit.d.id ? await supabase.from("debts").update(row).eq("id", edit.d.id) : await supabase.from("debts").insert(row);
    if (r.error) return toast.error(r.error.message);
    toast.success("Kaydedildi"); setEdit(null); refresh();
  }
  async function remove() {
    if (!edit?.d.id || !confirm("Kayıt ve ödemeleri silinsin mi?")) return;
    const r = await supabase.from("debts").delete().eq("id", edit.d.id);
    if (r.error) return toast.error(r.error.message);
    toast.success("Silindi"); setEdit(null); refresh();
  }
  async function savePay() {
    if (!pay) return;
    const amt = parseAmt(pay.amount);
    if (!(amt > 0)) return toast.error("Geçerli tutar girin");
    const r = await supabase.from("debt_payments").insert({ debt_id: pay.d.id, amount: amt, date: pay.date });
    if (r.error) return toast.error(r.error.message);
    if (pay.acc) {
      const t = await supabase.from("transactions").insert({
        type: pay.d.kind === "alacak" ? "gelir" : "gider", amount: amt, date: pay.date, account_id: pay.acc, note: `${pay.d.name} ödemesi`,
      });
      if (t.error) toast.error(t.error.message);
    }
    toast.success("Ödeme kaydedildi"); setPay(null); refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Borçlar ve krediler</h1>
        <Button onClick={() => setEdit({ d: { kind: "kredi", start_date: ymd(new Date()) }, total: "", monthly: "", months: "" })}><Plus className="size-4" /> Ekle</Button>
      </div>
      {debts.length === 0 && <p className="py-10 text-center text-muted-foreground">Henüz borç veya kredi kaydı yok.</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {debts.map((d) => {
          const p = paid(d.id); const left = Math.max(0, Number(d.total) - p); const pct = Math.min(100, (p / Number(d.total)) * 100);
          const nPaid = pays.filter((x) => x.debt_id === d.id).length;
          const next = d.months && nPaid < d.months ? addMonthsToDate(d.start_date, nPaid) : null;
          return (
            <section key={d.id} className="rounded-2xl border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <button className="text-left" onClick={() => setEdit({ d, total: String(d.total).replace(".", ","), monthly: d.monthly_payment ? String(d.monthly_payment).replace(".", ",") : "", months: d.months ? String(d.months) : "" })}>
                  <div className="font-bold">{d.name}</div>
                  <div className="text-xs text-muted-foreground">{KINDS[d.kind] ?? d.kind}{d.monthly_payment ? ` · Aylık ${fmt(Number(d.monthly_payment))}` : ""}{d.months ? ` · ${nPaid}/${d.months} taksit` : ""}</div>
                </button>
                {left > 0 ? <Button size="sm" onClick={() => setPay({ d, amount: d.monthly_payment ? String(d.monthly_payment).replace(".", ",") : "", date: ymd(new Date()), acc: "" })}>Ödeme</Button>
                  : <span className="rounded-full bg-accent px-2 py-1 text-xs font-semibold text-accent-foreground">Kapandı</span>}
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-income" style={{ width: `${pct}%` }} /></div>
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-muted-foreground">Ödenen {fmt(p)}</span><span className="font-semibold">Kalan {fmt(left)}</span>
              </div>
              {next && left > 0 && <div className="mt-2 rounded-lg bg-warning-bg px-2 py-1 text-xs text-warning">Sonraki ödeme: {next.split("-").reverse().join(".")}</div>}
            </section>
          );
        })}
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{edit?.d.id ? "Düzenle" : "Yeni borç / kredi"}</DialogTitle></DialogHeader>
          {edit && <div className="space-y-3">
            <div><Label>Ad</Label><Input value={edit.d.name ?? ""} onChange={(e) => setEdit({ ...edit, d: { ...edit.d, name: e.target.value } })} /></div>
            <div><Label>Tür</Label>
              <select className="h-9 w-full rounded-md border bg-card px-2 text-sm" value={edit.d.kind} onChange={(e) => setEdit({ ...edit, d: { ...edit.d, kind: e.target.value } })}>
                {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Toplam (₺)</Label><Input inputMode="decimal" value={edit.total} onChange={(e) => setEdit({ ...edit, total: e.target.value })} /></div>
              <div><Label>Aylık taksit</Label><Input inputMode="decimal" value={edit.monthly} onChange={(e) => setEdit({ ...edit, monthly: e.target.value })} /></div>
              <div><Label>Vade (ay)</Label><Input inputMode="numeric" value={edit.months} onChange={(e) => setEdit({ ...edit, months: e.target.value })} /></div>
              <div><Label>İlk ödeme</Label><Input type="date" value={edit.d.start_date} onChange={(e) => setEdit({ ...edit, d: { ...edit.d, start_date: e.target.value } })} /></div>
            </div>
            <div><Label>Not</Label><Input value={edit.d.note ?? ""} onChange={(e) => setEdit({ ...edit, d: { ...edit.d, note: e.target.value } })} /></div>
            <Button className="w-full" onClick={save}>Kaydet</Button>
            {edit.d.id && <Button variant="ghost" className="w-full text-destructive" onClick={remove}>Sil</Button>}
          </div>}
        </DialogContent>
      </Dialog>

      <Dialog open={!!pay} onOpenChange={(o) => !o && setPay(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Ödeme: {pay?.d.name}</DialogTitle></DialogHeader>
          {pay && <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tutar (₺)</Label><Input inputMode="decimal" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></div>
              <div><Label>Tarih</Label><Input type="date" value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} /></div>
            </div>
            <div><Label>Hangi hesaptan? (isteğe bağlı)</Label>
              <select className="h-9 w-full rounded-md border bg-card px-2 text-sm" value={pay.acc} onChange={(e) => setPay({ ...pay, acc: e.target.value })}>
                <option value="">Hesaba işleme</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select></div>
            <Button className="w-full" onClick={savePay}>Kaydet</Button>
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
