<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- `/` and `/index.html` serve src/original-index.html verbatim; vanilla app.js/core.js retain existing workflows. Why: the static application remains the functional source of truth.
- Shared presentation changes belong in public/butce-theme.css, loaded after legacy styles; preserve saved dashboard coordinates. Why: visual refinements must not rewrite budgeting logic or user preferences.
- app.js imports /cloud-store.js, bundled from src/cloud-store/entry.ts; run `bun run build:cloud-store` after editing its source. Why: the static app executes the committed browser bundle.

- Dashboard layout is order + size preset only (`SZ` table in app.js, saved as v3 `{id,on,sz}`); mobile uses `meta.dashMobile`, desktop `meta.dash`, no drag/resize. Why: preset sizes keep modules stable on touch and desktop.
- Transaction amount display formatting lives in the browser-safe `public/transaction-input.js`; persistence still uses `core.js` numeric parsing. Why: live grouping stays independently testable without changing financial calculations.
- Kullanıcı uygulamayı Chrome'da "Ana ekrana ekle" ile PWA olarak kullanıyor (1.3.0.0'da Android/APK katmanı tamamen kaldırıldı: `android/`, `capacitor.config.ts`, `scripts/build-app.sh`, `scripts/ota-plugin.ts`, `.github/workflows/android.yml` ve uygulama içi APK/OTA paneli yok). Bu yüzden her değişiklik canlı siteye (Lovable publish) ulaşmalı; kullanıcıya APK önermeyin. Geçmişteki APK kurulumu gerekirse `git show <commit>:android/app/butce-sign.p12` ile imza anahtarı geri alınabilir (imza değişirse "uygulama kurulamadı" hatası olur). Why: gerçek kullanım PWA; yayın gecikmesi kullanıcıyı eski sürümde bırakıyor.
- `src/cloud-store/entry.ts` içinde hâlâ isteğe bağlı bir Capacitor giriş köprüsü var (`?native_auth=1` + `app.lovable.butce://auth`); `cap?.isNativePlatform?.()` ile korunduğu için tarayıcıda çalışmaz, bundle'ı yeniden üretmeden silme. `@capacitor/app`, `@capacitor/browser`, `@capacitor/core` bağımlılıkları yalnızca bu yüzden duruyor; `@capacitor/android`, `@capacitor/cli`, `@capacitor/splash-screen`, `@capacitor/status-bar`, `@capgo/capacitor-updater` artık kullanılmıyor ama `bun.lock` ile çakışmaması için `package.json`'dan elle çıkarılmadı (bir sonraki `bun install` sonrası temizlenebilir).
- Ayarlar > Uygulama bölümü web sürümünü gösterir ve "Yenile" servis çalışanını güncelleyip sayfayı tazeler (veriye dokunmaz). Why: kullanıcı hangi sürümü gördüğünü doğrulayabilsin.
- Settings shows APP_VERSION (public/app.js, format 1.a.b.c); bump it on every change: last digit for small text/style tweaks, third for features, second for major systems. Why: user tracks releases by this number.
- Credit-card statement reconciliation lives in browser-safe `public/statement.js` (period calc, PDF text parsing via pdf.js CDN, matching) and runs fully on-device without AI. Why: no per-use cost, data stays private, logic is unit-tested.

- Git commits pushed from outside Lovable MUST be authored as `batuhanplb <81333730+batuhanplb@users.noreply.github.com>` (repo-local `git config user.name`/`user.email`). Why: commits authored as Lovable's own bot identity `gpt-engineer-app[bot]` are treated as Lovable's own and never show up as external commit cards in the Lovable chat, so the editor/preview stays stale. Never rewrite pushed history.
