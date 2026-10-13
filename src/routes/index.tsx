import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { BarChart3, Landmark, PieChart, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bütçe — Kişisel finans takibi" },
      { name: "description", content: "Harcamalarınızı, gelirlerinizi, hesaplarınızı ve borçlarınızı tek yerden takip edin." },
      { property: "og:title", content: "Bütçe — Kişisel finans takibi" },
      { property: "og:description", content: "Harcamalarınızı, gelirlerinizi, hesaplarınızı ve borçlarınızı tek yerden takip edin." },
    ],
  }),
  component: Index,
});

const FEATURES = [
  { icon: Wallet, t: "Hesaplar", d: "Nakit, banka ve kart bakiyeleri" },
  { icon: PieChart, t: "Bütçe", d: "Kategori bazında aylık limitler" },
  { icon: Landmark, t: "Borçlar", d: "Kredi ve taksit takibi" },
  { icon: BarChart3, t: "Analiz", d: "Aylık gelir-gider grafikleri" },
];

function Index() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) navigate({ to: "/panel", replace: true }); });
  }, [navigate]);
  return (
    <div className="min-h-dvh bg-background px-5 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl bg-hero p-8 text-hero-foreground md:p-12">
          <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">Bütçe</h1>
          <p className="mt-3 max-w-md text-lg opacity-90">Paranızın nereye gittiğini bilin. Harcama, gelir, hesap ve borçlarınız tek ekranda.</p>
          <Link to="/auth" className="mt-6 inline-flex h-11 items-center rounded-xl bg-primary-foreground px-6 font-semibold text-hero">Başla</Link>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.t} className="rounded-2xl border bg-card p-4">
              <f.icon className="size-5 text-primary" />
              <div className="mt-2 font-semibold">{f.t}</div>
              <div className="text-sm text-muted-foreground">{f.d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
