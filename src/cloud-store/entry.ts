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

// Offline support: a per-user local copy of all docs plus a persisted outbox of
// pending writes (keyed by doc, last write wins). The outbox is flushed when
// the connection returns; server loads are overlaid with pending writes.
type Pending = { coll: string; id: string; data: unknown | null };
const LS_CACHE = (u: string) => "butce.cache." + u;
const LS_OUT = (u: string) => "butce.outbox." + u;
const LS_USER = "butce.lastUser";
const lsGet = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } };
const lsSet = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* quota */ } };

export async function cloudStore(onUser: (u: User, err?: string) => void, toast?: (m: string) => void) {
  let uid: string | null = null;
  let h: Handlers | null = null;
  let cache = { meta: null as unknown, months: {} as Record<string, unknown[]>, debts: {} as Record<string, unknown> };
  let outbox: Record<string, Pending> = {};
  let flushing: Promise<void> | null = null;
  let warned = false;
  const saveCache = () => { if (uid) lsSet(LS_CACHE(uid), cache); };
  const saveOut = () => { if (uid) lsSet(LS_OUT(uid), outbox); };
  const emit = () => {
    if (!h) return;
    h.meta(clone(cache.meta));
    h.months(clone(cache.months), false);
    h.debts(clone(cache.debts));
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
  const flush = (): Promise<void> => {
    if (flushing) return flushing;
    flushing = (async () => {
      for (const key of Object.keys(outbox)) {
        const p = outbox[key]!;
        try {
          if (p.data === null) await del(p.coll, p.id); else await put(p.coll, p.id, p.data);
          if (outbox[key] === p) { delete outbox[key]; saveOut(); }
        } catch (err) {
          const e = err as { code?: string };
          if (e?.code === "permission-denied") { delete outbox[key]; saveOut(); toast?.("Bu hesapla yazma izni yok."); continue; }
          if (!warned) { warned = true; toast?.("Çevrimdışı kaydedildi, bağlantı gelince eşitlenecek."); }
          break;
        }
      }
      if (!Object.keys(outbox).length) warned = false;
    })().finally(() => { flushing = null; });
    return flushing;
  };
  const write = (coll: string, id: string, data: unknown | null) => {
    applyLocal(coll, id, coll === "tx" && data !== null ? data : data);
    saveCache(); emit();
    outbox[coll + "/" + id] = { coll, id, data };
    saveOut();
    return flush();
  };
  const q = (_key: string, fn: () => Promise<unknown>) => fn().catch((err) => {
    console.error(err);
    toast?.(err && err.code === "permission-denied" ? "Bu hesapla yazma izni yok." : "Kaydedilemedi, bağlantıyı kontrol edin.");
  });

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
    Object.values(outbox).forEach((p) => applyLocal(p.coll, p.id, p.data));
    saveCache();
  }

  const store = {
    kind: "cloud",
    user: null as User,
    async signIn() {
      // Native (Capacitor) app: popups don't work in the WebView, so run the
      // managed Google flow in the system browser on the published site and
      // receive the session back through the app.lovable.butce://auth deep link.
      const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
      if (cap?.isNativePlatform?.()) {
        const [{ Browser }, { App }] = await Promise.all([import("@capacitor/browser"), import("@capacitor/app")]);
        const done = new Promise<void>((resolve, reject) => {
          App.addListener("appUrlOpen", async ({ url }) => {
            if (!url.startsWith("app.lovable.butce://auth")) return;
            try {
              const p = new URLSearchParams(url.split("#")[1] || "");
              const at = p.get("access_token"), rt = p.get("refresh_token");
              if (!at || !rt) throw new Error("missing tokens");
              await supabase.auth.setSession({ access_token: at, refresh_token: rt });
              resolve();
            } catch (e) { reject(Object.assign(new Error("Giriş tamamlanamadı"), { code: "auth/failed" })); }
            finally { Browser.close().catch(() => {}); }
          });
        });
        await Browser.open({ url: "https://butceapp.lovable.app/?native_auth=1" });
        await done;
        return;
      }
      const r = await lovableAuth.signInWithOAuth("google", { redirect_uri: location.origin + location.pathname, extraParams: { prompt: "select_account" } });
      if (r.error) throw Object.assign(r.error, { code: /cancel/i.test(r.error.message) ? "auth/popup-closed" : "auth/failed" });
      if (!r.redirected && r.tokens) await supabase.auth.setSession(r.tokens);
    },
    signOut() { return supabase.auth.signOut(); },
    listen(x: Handlers) {
      h = x;
      const local = uid ? lsGet<typeof cache | null>(LS_CACHE(uid), null) : null;
      if (local) { cache = local; Object.values(outbox).forEach((p) => applyLocal(p.coll, p.id, p.data)); emit(); }
      loadAll().then(() => { emit(); flush(); }).catch((e) => { if (!local) x.err(e); });
    },
    setMeta(meta: unknown) { return write("meta", "main", clone(meta)); },
    setMonth(m: string, items: unknown[]) {
      const b = clone(items);
      return write("tx", m, b.length ? { items: b } : null);
    },
    setDebt(id: string, d: unknown) { return write("debts", id, clone(d)); },
    delDebt(id: string) { return write("debts", id, null); },
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
      saveCache();
      emit();
    },
  };

  type SUser = { id: string; email?: string; user_metadata?: Record<string, string> };
  let lastUid: string | null | undefined;
  const handle = (session: { user: SUser } | null) => {
    const u = session?.user ?? null;
    if ((u?.id ?? null) === lastUid) return;
    lastUid = u?.id ?? null;
    h = null; uid = lastUid;
    outbox = uid ? lsGet<Record<string, Pending>>(LS_OUT(uid), {}) : {};
    if (u) lsSet(LS_USER, { id: u.id, email: u.email, user_metadata: u.user_metadata });
    const meta = u?.user_metadata ?? {};
    store.user = u ? { email: u.email ?? null, name: meta['full_name'] ?? meta['name'] ?? null } : null;
    onUser(store.user);
  };
  // Never drop the user on a transient null session (offline token refresh,
  // phone waking from sleep). Only an explicit SIGNED_OUT logs the user out.
  supabase.auth.onAuthStateChange((e, s) => {
    if (e === "SIGNED_OUT") { try { localStorage.removeItem(LS_USER); } catch { /* */ } }
    if (!s && e !== "SIGNED_OUT") return;
    setTimeout(() => handle(s), 0);
    if (s) setTimeout(() => flush(), 50);
  });
  let data: { session: { user: SUser; access_token: string; refresh_token: string } | null } = { session: null };
  try { data = (await supabase.auth.getSession()).data as typeof data; } catch { /* offline */ }
  // Offline with an expired token: keep the last signed-in user working locally.
  const lastUser = lsGet<SUser | null>(LS_USER, null);
  setTimeout(() => handle(data.session ?? (lastUser ? { user: lastUser } : null)), 0);
  const wake = () => {
    if (document.visibilityState !== "visible" || !navigator.onLine) return;
    supabase.auth.getSession().then(({ data: d }) => {
      const exp = d.session?.expires_at ?? 0;
      const p = d.session && exp * 1000 - Date.now() < 5 * 60_000 ? supabase.auth.refreshSession() : Promise.resolve();
      return p.catch(() => {}).then(() => flush());
    }).catch(() => {});
  };
  document.addEventListener("visibilitychange", wake);
  window.addEventListener("online", wake);
  setInterval(() => { if (navigator.onLine && Object.keys(outbox).length) flush(); }, 30_000);

  // Native-app auth bridge: the Capacitor app opens the published site with
  // ?native_auth=1 in the system browser. If a session exists, hand it back to
  // the app via the custom-scheme deep link; otherwise kick off Google sign-in
  // that redirects back here after completion.
  if (new URLSearchParams(location.search).has("native_auth")) {
    const toApp = (s: { access_token: string; refresh_token: string }) => {
      location.href = "app.lovable.butce://auth#access_token=" + encodeURIComponent(s.access_token) + "&refresh_token=" + encodeURIComponent(s.refresh_token);
    };
    if (data.session) toApp(data.session);
    else {
      // The managed OAuth return may still be processing the URL; give the
      // session a moment to appear before starting a fresh sign-in.
      let done = false;
      const sub = supabase.auth.onAuthStateChange((_e, s) => { if (s && !done) { done = true; sub.data.subscription.unsubscribe(); toApp(s); } });
      setTimeout(() => {
        if (done) return;
        done = true;
        sub.data.subscription.unsubscribe();
        lovableAuth.signInWithOAuth("google", { redirect_uri: location.origin + "/?native_auth=1", extraParams: { prompt: "select_account" } }).catch(() => {});
      }, 2000);
    }
  }
  return store;
}
