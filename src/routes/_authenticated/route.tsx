import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BarChart3, Home, Landmark, List, LogOut, Plus, Tags, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TxDialog } from "@/components/TxDialog";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: Shell,
});

const NAV = [
  { to: "/panel", label: "Özet", icon: Home },
  { to: "/islemler", label: "İşlemler", icon: List },
  { to: "/hesaplar", label: "Hesaplar", icon: Wallet },
  { to: "/borclar", label: "Borçlar", icon: Landmark },
  { to: "/analiz", label: "Analiz", icon: BarChart3 },
  { to: "/kategoriler", label: "Kategoriler", icon: Tags },
] as const;

function Shell() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  async function signOut() {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <div className="min-h-dvh md:flex">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-card p-4 md:flex">
        <div className="mb-6 px-2 text-xl font-extrabold tracking-tight text-primary">Bütçe</div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
              activeProps={{ className: "bg-accent text-accent-foreground font-semibold" }}>
              <n.icon className="size-4" />{n.label}
            </Link>
          ))}
        </nav>
        <button onClick={() => setOpen(true)} className="mb-2 flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground">
          <Plus className="size-4" /> Yeni işlem
        </button>
        <button onClick={signOut} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
          <LogOut className="size-4" /> Çıkış yap
        </button>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between bg-background/90 px-4 backdrop-blur md:hidden">
          <span className="text-lg font-extrabold tracking-tight text-primary">Bütçe</span>
          <div className="flex gap-1">
            <Link to="/kategoriler" aria-label="Kategoriler" className="grid size-10 place-items-center rounded-lg hover:bg-muted"><Tags className="size-5" /></Link>
            <button aria-label="Çıkış yap" onClick={signOut} className="grid size-10 place-items-center rounded-lg hover:bg-muted"><LogOut className="size-5" /></button>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 pb-28 pt-2 md:px-8 md:pb-10 md:pt-8">
          <Outlet />
        </main>
      </div>

      <button aria-label="Yeni işlem" onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-30 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg md:hidden">
        <Plus className="size-6" />
      </button>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.slice(0, 5).map((n) => (
          <Link key={n.to} to={n.to} className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-muted-foreground"
            activeProps={{ className: "text-primary font-bold" }}>
            <n.icon className="size-5" />{n.label}
          </Link>
        ))}
      </nav>
      <TxDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
