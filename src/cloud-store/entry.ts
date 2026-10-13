// Browser bundle for the original Bütçe app (public/app.js).
// Implements the same `store` interface the original Firebase data layer exposed,
// backed by Lovable Cloud auth + the user_docs / shares tables.
// Build: bun run build:cloud-store  (outputs public/cloud-store.js)
import { createClient } from "@supabase/supabase-js";
import { createLovableAuth } from "@lovable.dev/cloud-auth-js";

declare const __SB_URL__: string;
declare const __SB_KEY__: string;

type Handlers = {
  meta: (m: unknown) => void;
  months: (o: Record<string, unknown[]>, fromCache: boolean) => void;
  debts: (o: Record<string, unknown>) => void;
  err: (e: unknown) => void;
};
type User = { email: string | null; name: string | null } | null;
type Op = { op: "set" | "del"; path: string[]; data?: unknown };

const supabase = createClient(__SB_URL__, __SB_KEY__, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: localStorage },
});
const lovableAuth = createLovableAuth();

const clone = <T,>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const errOf = (e: { message?: string; code?: string } | null) => {
  if (!e) return null;
  const err = new Error(e.message || "error") as Error & { code: string };
  err.code = e.code === "42501" ? "permission-denied" : e.code || "unknown";
  return err;
};

export async function cloudStore(onUser: (u: User, err?: string) => void, toast?: (m: string) => void) {
  let uid: string | null = null;
  let h: Handlers | null = null;
  let cache = { meta: null as unknown, months: {} as Record<string, unknown[]>, debts: {} as Record<string, unknown> };
  const chains: Record<string, Promise<unknown>> = {};
  const emit = () => {
    if (!h) return;
    h.meta(clone(cache.meta));
    h.months(clone(cache.months), false);
    h.debts(clone(cache.debts));
  };
  const q = (key: string, fn: () => Promise<unknown>) => {
    chains[key] = (chains[key] || Promise.resolve()).then(fn).catch((err) => {
      console.error(err);
      toast?.(err && err.code === "permission-denied" ? "Bu hesapla yazma izni yok." : "Kaydedilemedi, bağlantıyı kontrol edin.");
    });
    return chains[key];
  };
  const put = async (coll: string, id: string, data: unknown) => {
    const { error } = await supabase.from("user_docs").upsert({ user_id: uid!, coll, doc_id: id, data: data as never, updated_at: new Date().toISOString() });
    if (error) throw errOf(error);
  };
  const del = async (coll: string, id: string) => {
    const { error } = await supabase.from("user_docs").delete().eq("user_id", uid!).eq("coll", coll).eq("doc_id", id);
    if (error) throw errOf(error);
  };
  const applyLocal = (coll: string, id: string, data: unknown | null) => {
    if (coll === "meta") cache.meta = data;
    else if (coll === "tx") { if (data) cache.months[id] = clone((data as { items: unknown[] }).items || []); else delete cache.months[id]; }
    else if (coll === "debts") { if (data) cache.debts[id] = clone(data); else delete cache.debts[id]; }
  };

  async function loadAll() {
    const rows: { coll: string; doc_id: string; data: unknown }[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from("user_docs").select("coll,doc_id,data").eq("user_id", uid!).range(from, from + 999);
      if (error) throw errOf(error);
      rows.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    cache = { meta: null, months: {}, debts: {} };
    rows.forEach((r) => applyLocal(r.coll, r.doc_id, r.data));
  }

  const store = {
    kind: "cloud",
    user: null as User,
    async signIn() {
      const r = await lovableAuth.signInWithOAuth("google", { redirect_uri: location.origin + location.pathname, extraParams: { prompt: "select_account" } });
      if (r.error) throw Object.assign(r.error, { code: /cancel/i.test(r.error.message) ? "auth/popup-closed" : "auth/failed" });
      if (!r.redirected && r.tokens) await supabase.auth.setSession(r.tokens);
    },
    signOut() { return supabase.auth.signOut(); },
    listen(x: Handlers) {
      h = x;
      loadAll().then(emit).catch((e) => x.err(e));
    },
    setMeta(meta: unknown) { const b = clone(meta); applyLocal("meta", "main", b); emit(); return q("meta", () => put("meta", "main", b)); },
    setMonth(m: string, items: unknown[]) {
      const b = clone(items);
      applyLocal("tx", m, b.length ? { items: b } : null); emit();
      return q("tx/" + m, () => (b.length ? put("tx", m, { items: b }) : del("tx", m)));
    },
    setDebt(id: string, d: unknown) { const b = clone(d); applyLocal("debts", id, b); emit(); return q("debt/" + id, () => put("debts", id, b)); },
    delDebt(id: string) { applyLocal("debts", id, null); emit(); return q("debt/" + id, () => del("debts", id)); },
    setShare(t: string, d: unknown) {
      return q("share", async () => {
        const { error } = await supabase.from("shares").upsert({ token: t, owner: uid!, data: clone(d) as never, updated_at: new Date().toISOString() });
        if (error) throw errOf(error);
      });
    },
    delShare(t: string) {
      return q("share", async () => { const { error } = await supabase.from("shares").delete().eq("token", t); if (error) throw errOf(error); });
    },
    async getShare(t: string) {
      const { data, error } = await supabase.rpc("get_share", { _token: t });
      if (error) throw errOf(error);
      return data ?? null;
    },
    async bulk(ops: Op[]) {
      for (let i = 0; i < ops.length; i += 400) {
        const chunk = ops.slice(i, i + 400);
        const sets = chunk.filter((o) => o.op !== "del").map((o) => ({ user_id: uid!, coll: o.path[0]!, doc_id: o.path[1]!, data: clone(o.data) as never, updated_at: new Date().toISOString() }));
        if (sets.length) { const { error } = await supabase.from("user_docs").upsert(sets); if (error) throw errOf(error); }
        for (const o of chunk.filter((o) => o.op === "del")) await del(o.path[0]!, o.path[1]!);
        chunk.forEach((o) => applyLocal(o.path[0]!, o.path[1]!, o.op === "del" ? null : clone(o.data)));
      }
      emit();
    },
  };

  let lastUid: string | null | undefined;
  const handle = (session: { user: { id: string; email?: string; user_metadata?: Record<string, string> } } | null) => {
    const u = session?.user ?? null;
    if ((u?.id ?? null) === lastUid) return;
    lastUid = u?.id ?? null;
    h = null; uid = lastUid;
    store.user = u ? { email: u.email ?? null, name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? null } : null;
    onUser(store.user);
  };
  supabase.auth.onAuthStateChange((_e, s) => setTimeout(() => handle(s), 0));
  const { data } = await supabase.auth.getSession();
  setTimeout(() => handle(data.session), 0);
  return store;
}
