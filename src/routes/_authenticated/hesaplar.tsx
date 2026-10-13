import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ACC_TYPES, accountBalances, fmt, parseAmt, useAccounts, useRefresh, useTxs, type Account } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/hesaplar")({
  head: () => ({ meta: [{ title: "Hesaplar — Bütçe" }, { name: "description", content: "Nakit, banka ve kart hesaplarınız." }] }),
  component: Hesaplar,
});

function Hesaplar() {
  const { data: accounts = [] } = useAccounts();
  const { data: txs = [] } = useTxs();
  const refresh = useRefresh();
  const bal = accountBalances(accounts, txs);
  const [edit, setEdit] = useState<Partial<Account> | null>(null);
  const [start, setStart] = useState("");

  const groups = Object.entries(ACC_TYPES).map(([k, label]) => ({ k, label, items: accounts.filter((a) => a.type === k) })).filter((g) => g.items.length);
  const total = accounts.filter((a) => !a.exclude_from_total).reduce((s, a) => s + (bal.get(a.id) ?? 0), 0);

  function open(a?: Account) {
    setEdit(a ?? { name: "", type: "banka", color: "#0f6e66", exclude_from_total: false });
    setStart(a ? String(a.start_balance).replace(".", ",") : "0");
  }
  async function save() {
    if (!edit?.name?.trim()) return toast.error("Ad girin");
    const s = parseAmt(start || "0");
    const row = { name: edit.name.trim(), type: edit.type!, color: edit.color!, exclude_from_total: !!edit.exclude_from_total, start_balance: isNaN(s) ? 0 : s };
    const r = edit.id ? await supabase.from("accounts").update(row).eq("id", edit.id) : await supabase.from("accounts").insert({ ...row, sort: accounts.length });
    if (r.error) return toast.error(r.error.message);
    toast.success("Kaydedildi"); setEdit(null); refresh();
  }
  async function remove() {
    if (!edit?.id || !confirm("Hesap silinsin mi? İşlemler hesapsız kalır.")) return;
    const r = await supabase.from("accounts").delete().eq("id", edit.id);
    if (r.error) return toast.error(r.error.message);
    toast.success("Silindi"); setEdit(null); refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div><h1 className="text-2xl font-bold">Hesaplar</h1><div className="text-sm text-muted-foreground">Toplam: <b className="text-foreground">{fmt(total)}</b></div></div>
        <Button onClick={() => open()}><Plus className="size-4" /> Hesap</Button>
      </div>
      {groups.map((g) => (
        <section key={g.k} className="rounded-2xl border bg-card p-2">
          <div className="px-2 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</div>
          {g.items.map((a) => (
            <button key={a.id} onClick={() => open(a)} className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left hover:bg-muted">
              <span className="size-4 rounded-full" style={{ background: a.color }} />
              <span className="flex-1"><span className="font-medium">{a.name}</span>{a.exclude_from_total && <span className="ml-2 text-xs text-muted-foreground">toplama dahil değil</span>}</span>
              <span className={`font-bold ${(bal.get(a.id) ?? 0) < 0 ? "text-expense" : ""}`}>{fmt(bal.get(a.id) ?? 0)}</span>
            </button>
          ))}
        </section>
      ))}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{edit?.id ? "Hesabı düzenle" : "Yeni hesap"}</DialogTitle></DialogHeader>
          {edit && <div className="space-y-3">
            <div><Label>Ad</Label><Input value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div><Label>Tür</Label>
                <select className="h-9 w-full rounded-md border bg-card px-2 text-sm" value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value })}>
                  {Object.entries(ACC_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
              <div><Label>Renk</Label><Input type="color" className="w-14 p-1" value={edit.color} onChange={(e) => setEdit({ ...edit, color: e.target.value })} /></div>
            </div>
            <div><Label>Açılış bakiyesi (₺)</Label><Input inputMode="decimal" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <label className="flex items-center justify-between text-sm">Toplam bakiyeye dahil etme<Switch checked={!!edit.exclude_from_total} onCheckedChange={(v) => setEdit({ ...edit, exclude_from_total: v })} /></label>
            <Button className="w-full" onClick={save}>Kaydet</Button>
            {edit.id && <Button variant="ghost" className="w-full text-destructive" onClick={remove}>Hesabı sil</Button>}
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
