import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Giriş yap — Bütçe" },
      { name: "description", content: "Bütçe hesabınıza giriş yapın veya yeni hesap oluşturun." },
      { property: "og:title", content: "Giriş yap — Bütçe" },
      { property: "og:description", content: "Bütçe hesabınıza giriş yapın veya yeni hesap oluşturun." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) navigate({ to: "/panel" }); });
    const { data } = supabase.auth.onAuthStateChange((e, s) => { if (e === "SIGNED_IN" && s) navigate({ to: "/panel" }); });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (error) toast.error("Giriş başarısız: " + error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email, password: pw, options: { emailRedirectTo: window.location.origin + "/panel" } });
      if (error) toast.error(error.message);
      else toast.success("Hesap oluşturuldu. E-postanızdaki bağlantıyla onaylayın.");
    }
    setBusy(false);
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error("Google ile giriş başarısız");
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-extrabold tracking-tight text-primary">Bütçe</h1>
        <p className="mb-6 mt-1 text-sm text-muted-foreground">{mode === "in" ? "Hesabınıza giriş yapın" : "Yeni hesap oluşturun"}</p>
        <Button variant="outline" className="h-11 w-full" onClick={google}>Google ile devam et</Button>
        <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground"><div className="h-px flex-1 bg-border" />veya<div className="h-px flex-1 bg-border" /></div>
        <form onSubmit={submit} className="space-y-3">
          <div><Label>E-posta</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Label>Şifre</Label><Input type="password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} /></div>
          <Button type="submit" className="h-11 w-full" disabled={busy}>{mode === "in" ? "Giriş yap" : "Kayıt ol"}</Button>
        </form>
        <button className="mt-4 w-full text-center text-sm text-muted-foreground" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "Hesabınız yok mu? Kayıt olun" : "Zaten hesabınız var mı? Giriş yapın"}
        </button>
      </div>
    </div>
  );
}
