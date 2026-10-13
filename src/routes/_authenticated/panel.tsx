import { createFileRoute, Link } from "@tanstack/react-router";
import { accountBalances, curMonth, fmt, monthLabel, monthTotals, useAccounts, useCategories, useDebts, usePayments, useTxs } from "@/lib/data";
import { TxRow } from "@/components/TxRow";

export const Route = createFileRoute("/_authenticated/panel")({
  head: () => ({ meta: [{ title: "Özet — Bütçe" }, { name: "description", content: "Aylık bütçe özetiniz." }] }),
  component: Panel,
});

function Panel() {
  const { data: accounts = [] } = useAccounts();
  const { data: txs = [] } = useTxs();
  const { data: cats = [] } = useCategories();
  const { data: debts = [] } = useDebts();
  const { data: pays = [] } = usePayments();
  const m = curMonth();
  const bal = accountBalances(accounts, txs);
  const total = accounts.filter((a) => !a.exclude_from_total).reduce((s, a) => s + (bal.get(a.id) ?? 0), 0);
  const t = monthTotals(txs, m);
  const debtLeft = debts.reduce((s, d) => s + Number(d.total) - pays.filter((p) => p.debt_id === d.id).reduce((x, p) => x + Number(p.amount), 0), 0);
  const budgets = cats.filter((c) => c.kind === "gider" && c.monthly_budget).map((c) => {
    const spent = txs.filter((x) => x.type === "gider" && x.category_id === c.id && x.date.startsWith(m)).reduce((s, x) => s + Number(x.amount), 0);
    return { c, spent, pct: Math.min(100, (spent / Number(c.monthly_budget)) * 100) };
  });
  const recent = [...txs].sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)).slice(0, 6);

  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-hero p-5 text-hero-foreground md:p-7">
        <div className="text-sm opacity-80">Toplam bakiye</div>
        <div className="mt-1 text-3xl font-extrabold tracking-tight md:text-4xl">{fmt(total)}</div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
          <div><div className="opacity-75">{monthLabel(m)} gelir</div><div className="font-bold">{fmt(t.inc)}</div></div>
          <div><div className="opacity-75">Gider</div><div className="font-bold">{fmt(t.exp)}</div></div>
          <div><div className="opacity-75">Kalan borç</div><div className="font-bold">{fmt(debtLeft)}</div></div>
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="rounded-2xl border bg-card p-4">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Hesaplar</h2><Link to="/hesaplar" className="text-sm text-primary">Tümü</Link></div>
          <ul className="space-y-2">
            {accounts.map((a) => (
              <li key={a.id} className="flex items-center gap-3">
                <span className="size-3 rounded-full" style={{ background: a.color }} />
                <span className="flex-1 truncate">{a.name}</span>
                <span className={`font-semibold ${(bal.get(a.id) ?? 0) < 0 ? "text-expense" : ""}`}>{fmt(bal.get(a.id) ?? 0)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border bg-card p-4">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Bütçe takibi</h2><Link to="/kategoriler" className="text-sm text-primary">Düzenle</Link></div>
          {budgets.length === 0 ? (
            <p className="text-sm text-muted-foreground">Kategorilere aylık limit ekleyerek bütçenizi takip edin.</p>
          ) : (
            <ul className="space-y-3">
              {budgets.map(({ c, spent, pct }) => (
                <li key={c.id}>
                  <div className="flex justify-between text-sm"><span>{c.name}</span><span className="text-muted-foreground">{fmt(spent)} / {fmt(Number(c.monthly_budget))}</span></div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full ${pct >= 100 ? "bg-expense" : pct >= 80 ? "bg-warning" : "bg-primary"}`} style={{ width: `${pct}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-2xl border bg-card p-4">
        <div className="mb-2 flex items-center justify-between"><h2 className="font-bold">Son işlemler</h2><Link to="/islemler" className="text-sm text-primary">Tümü</Link></div>
        {recent.length === 0 ? <p className="py-4 text-sm text-muted-foreground">Henüz işlem yok. + ile ilk işleminizi ekleyin.</p> :
          <ul className="divide-y">{recent.map((x) => <TxRow key={x.id} tx={x} />)}</ul>}
      </section>
    </div>
  );
}
