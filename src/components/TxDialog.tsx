import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { addMonthsToDate, parseAmt, ymd, useAccounts, useCategories, useRefresh, type Tx } from "@/lib/data";
import { cn } from "@/lib/utils";

type Kind = "gider" | "gelir" | "transfer";

export function TxDialog({ open, onOpenChange, edit }: { open: boolean; onOpenChange: (o: boolean) => void; edit?: Tx | null }) {
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const refresh = useRefresh();
  const [type, setType] = useState<Kind>("gider");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(ymd(new Date()));
  const [acc, setAcc] = useState("");
  const [toAcc, setToAcc] = useState("");
  const [cat, setCat] = useState("");
  const [note, setNote] = useState("");
  const [inst, setInst] = useState("1");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (edit) {
      setType(edit.type as Kind); setAmount(String(edit.amount).replace(".", ",")); setDate(edit.date);
      setAcc(edit.account_id ?? ""); setToAcc(edit.to_account_id ?? ""); setCat(edit.category_id ?? ""); setNote(edit.note ?? ""); setInst("1");
    } else {
      setType("gider"); setAmount(""); setDate(ymd(new Date())); setAcc(accounts[0]?.id ?? ""); setToAcc(""); setCat(""); setNote(""); setInst("1");
    }
  }, [open, edit]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open && !edit && !acc && accounts[0]) setAcc(accounts[0].id);
  }, [open, edit, acc, accounts]);

  const cats = categories.filter((c) => c.kind === type);

  async function save() {
    const amt = parseAmt(amount);
    if (!(amt > 0)) { toast.error("Geçerli bir tutar girin"); return; }
    if (type === "transfer" && (!acc || !toAcc || acc === toAcc)) { toast.error("İki farklı hesap seçin"); return; }
    setBusy(true);
    const base = {
      type, date, note: note.trim() || null,
      account_id: acc || null,
      to_account_id: type === "transfer" ? toAcc || null : null,
      category_id: type === "transfer" ? null : cat || null,
    };
    let error;
    if (edit) {
      ({ error } = await supabase.from("transactions").update({ ...base, amount: amt }).eq("id", edit.id));
    } else {
      const n = type === "gider" ? Math.max(1, Math.min(60, parseInt(inst) || 1)) : 1;
      if (n === 1) {
        ({ error } = await supabase.from("transactions").insert({ ...base, amount: amt }));
      } else {
        const group = crypto.randomUUID();
        const per = Math.round((amt / n) * 100) / 100;
        const rows = Array.from({ length: n }, (_, i) => ({
          ...base, date: addMonthsToDate(date, i), group_id: group, inst_no: i + 1, inst_total: n,
          amount: i === n - 1 ? Math.round((amt - per * (n - 1)) * 100) / 100 : per,
        }));
        ({ error } = await supabase.from("transactions").insert(rows));
      }
    }
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Kaydedildi");
    refresh();
    onOpenChange(false);
  }

  const color = type === "gider" ? "bg-expense" : type === "gelir" ? "bg-income" : "bg-transfer";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader><DialogTitle>{edit ? "İşlemi düzenle" : "Yeni işlem"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
          {(["gider", "gelir", "transfer"] as Kind[]).map((k) => (
            <button key={k} type="button" onClick={() => { setType(k); setCat(""); }}
              className={cn("rounded-lg py-2 text-sm font-semibold capitalize transition", type === k ? `${color} text-primary-foreground` : "text-muted-foreground")}>
              {k === "gider" ? "Gider" : k === "gelir" ? "Gelir" : "Transfer"}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          <div>
            <Label>Tutar (₺)</Label>
            <Input inputMode="decimal" autoFocus placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-12 text-2xl font-bold" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Tarih</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            {type === "gider" && !edit && (
              <div><Label>Taksit</Label><Input inputMode="numeric" value={inst} onChange={(e) => setInst(e.target.value)} /></div>
            )}
          </div>
          <div>
            <Label>{type === "transfer" ? "Kaynak hesap" : "Hesap"}</Label>
            <select className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm" value={acc} onChange={(e) => setAcc(e.target.value)}>
              <option value="">— Seçin —</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          {type === "transfer" ? (
            <div>
              <Label>Hedef hesap</Label>
              <select className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm" value={toAcc} onChange={(e) => setToAcc(e.target.value)}>
                <option value="">— Seçin —</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <Label>Kategori</Label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {cats.map((c) => (
                  <button key={c.id} type="button" onClick={() => setCat(cat === c.id ? "" : c.id)}
                    className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm", cat === c.id ? "border-primary bg-accent font-semibold" : "bg-card")}>
                    <span className="size-2.5 rounded-full" style={{ background: c.color }} />{c.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div><Label>Not</Label><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <Button className="h-11 w-full" disabled={busy} onClick={save}>Kaydet</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
