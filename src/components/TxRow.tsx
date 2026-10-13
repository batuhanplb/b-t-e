import { ArrowLeftRight } from "lucide-react";
import { fmt, useAccounts, useCategories, type Tx } from "@/lib/data";

export function TxRow({ tx, onClick }: { tx: Tx; onClick?: () => void }) {
  const { data: accounts = [] } = useAccounts();
  const { data: cats = [] } = useCategories();
  const cat = cats.find((c) => c.id === tx.category_id);
  const acc = accounts.find((a) => a.id === tx.account_id);
  const to = accounts.find((a) => a.id === tx.to_account_id);
  const title = tx.type === "transfer" ? `${acc?.name ?? "?"} → ${to?.name ?? "?"}` : cat?.name ?? "Kategorisiz";
  const sign = tx.type === "gider" ? "−" : tx.type === "gelir" ? "+" : "";
  const cls = tx.type === "gider" ? "text-expense" : tx.type === "gelir" ? "text-income" : "text-transfer";
  return (
    <li>
      <button type="button" onClick={onClick} className="flex w-full items-center gap-3 py-2.5 text-left">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted" style={cat ? { background: cat.color + "22" } : undefined}>
          {tx.type === "transfer" ? <ArrowLeftRight className="size-4 text-transfer" /> : <span className="size-3 rounded-full" style={{ background: cat?.color ?? "gray" }} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{title}{tx.inst_total ? <span className="ml-1 text-xs text-muted-foreground">({tx.inst_no}/{tx.inst_total})</span> : null}</span>
          <span className="block truncate text-xs text-muted-foreground">{tx.date.split("-").reverse().join(".")}{tx.type !== "transfer" && acc ? ` · ${acc.name}` : ""}{tx.note ? ` · ${tx.note}` : ""}</span>
        </span>
        <span className={`shrink-0 font-semibold ${cls}`}>{sign}{fmt(Number(tx.amount))}</span>
      </button>
    </li>
  );
}
