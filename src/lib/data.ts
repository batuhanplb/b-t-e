import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Account = Tables<"accounts">;
export type Category = Tables<"categories">;
export type Tx = Tables<"transactions">;
export type Debt = Tables<"debts">;
export type DebtPayment = Tables<"debt_payments">;

export const TR_M = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
export const ACC_TYPES: Record<string, string> = { nakit: "Nakit", banka: "Banka", kart: "Kredi Kartı", yatirim: "Yatırım", diger: "Diğer" };

const tl = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 });
export const fmt = (n: number) => tl.format(n || 0);
export const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const curMonth = () => ymd(new Date()).slice(0, 7);
export const addM = (m: string, k: number) => {
  const [y, mo] = m.split("-").map(Number);
  const t = y * 12 + (mo - 1) + k;
  return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`;
};
export const monthLabel = (m: string) => { const [y, mo] = m.split("-").map(Number); return `${TR_M[mo - 1]} ${y}`; };
export const addMonthsToDate = (d: string, k: number) => {
  const [y, m, day] = d.split("-").map(Number);
  const nm = addM(`${y}-${pad(m)}`, k);
  const [ny, nmo] = nm.split("-").map(Number);
  const last = new Date(ny, nmo, 0).getDate();
  return `${nm}-${pad(Math.min(day, last))}`;
};
export function parseAmt(v: string): number {
  let s = String(v).replace(/[₺\s]/g, "").trim();
  if (!s) return NaN;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return isFinite(n) ? n : NaN;
}

async function fetchAll<T>(table: "accounts" | "categories" | "transactions" | "debts" | "debt_payments", order: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select("*").order(order, { ascending: true }).range(from, from + 999);
    if (error) throw error;
    out.push(...(data as T[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export const useAccounts = () => useQuery({ queryKey: ["accounts"], queryFn: () => fetchAll<Account>("accounts", "sort") });
export const useCategories = () => useQuery({ queryKey: ["categories"], queryFn: () => fetchAll<Category>("categories", "name") });
export const useTxs = () => useQuery({ queryKey: ["transactions"], queryFn: () => fetchAll<Tx>("transactions", "date") });
export const useDebts = () => useQuery({ queryKey: ["debts"], queryFn: () => fetchAll<Debt>("debts", "created_at") });
export const usePayments = () => useQuery({ queryKey: ["debt_payments"], queryFn: () => fetchAll<DebtPayment>("debt_payments", "date") });

export function useRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

export function accountBalances(accounts: Account[], txs: Tx[], upTo?: string) {
  const b = new Map<string, number>();
  accounts.forEach((a) => b.set(a.id, Number(a.start_balance)));
  for (const t of txs) {
    if (upTo && t.date > upTo) continue;
    const amt = Number(t.amount);
    if (t.type === "gelir" && t.account_id) b.set(t.account_id, (b.get(t.account_id) ?? 0) + amt);
    if (t.type === "gider" && t.account_id) b.set(t.account_id, (b.get(t.account_id) ?? 0) - amt);
    if (t.type === "transfer") {
      if (t.account_id) b.set(t.account_id, (b.get(t.account_id) ?? 0) - amt);
      if (t.to_account_id) b.set(t.to_account_id, (b.get(t.to_account_id) ?? 0) + amt);
    }
  }
  return b;
}

export function monthTotals(txs: Tx[], month: string) {
  let inc = 0, exp = 0;
  for (const t of txs) {
    if (!t.date.startsWith(month)) continue;
    if (t.type === "gelir") inc += Number(t.amount);
    if (t.type === "gider") exp += Number(t.amount);
  }
  return { inc, exp, net: inc - exp };
}
