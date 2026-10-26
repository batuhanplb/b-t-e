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
- Android app is Capacitor: `scripts/build-app.sh` copies public/ + original-index.html into `app-www/` (bundled offline, no remote server.url); GitHub Actions `.github/workflows/android.yml` builds the debug APK on every push to main. Why: one codebase, APK without a local Android SDK.
- Native Google sign-in: Capacitor app opens https://butceapp.lovable.app/?native_auth=1 in the system browser; the site deep-links the session back via app.lovable.butce://auth (manifest intent-filter). Why: managed OAuth popups do not work inside the WebView.
- Android güncellemesi iki katmanlı: web değişiklikleri CapacitorUpdater ile havadan gelir (APK gerekmez), yeni APK yalnızca kabuk (eklenti/izin/ikon/versionCode) değişince gerekir. APK her push'ta `apk-latest` GitHub sürümüne `butce.apk` adıyla yüklenir; telefondan sabit bağlantı: https://github.com/batuhanplb/b-t-e/releases/latest/download/butce.apk (Ayarlar > Uygulama > APK indir). Ayarlar paneli web sürümü, aktif havadan paket, kurulu uygulama sürümü ve son kontrol zamanını gösterir; Why: kullanıcı hangi katmanın güncel olduğunu görsün, boşuna APK kurmasın.
- Android APK'sı `android/app/butce-sign.p12` içindeki sabit anahtarla imzalanır (şifre build.gradle'da, bilinçli olarak repoda). Why: her derleme aynı imzayı taşır, yeni APK eskisinin üzerine kurulur; anahtar değişirse Android "uygulama kurulamadı" der ve kaldırıp kurmak gerekir. Workflow `apksigner` ile sertifika SHA-256'sını doğrular; keystore'u asla değiştirme/silme.
- Android donanım geri tuşu `app.js` içinde ele alınır: önce açık katman (onay, alt sayfa, balon, seçim), sonra ana sayfa, en sonda iki kez basınca çıkış. Why: WebView'in varsayılan "hemen uygulamadan çıkma" davranışı uygulama hissini bozuyordu.
- Settings shows APP_VERSION (public/app.js, format 1.a.b.c); bump it on every change: last digit for small text/style tweaks, third for features, second for major systems. Why: user tracks releases by this number.
- Credit-card statement reconciliation lives in browser-safe `public/statement.js` (period calc, PDF text parsing via pdf.js CDN, matching) and runs fully on-device without AI. Why: no per-use cost, data stays private, logic is unit-tested.

- Git commits pushed from outside Lovable MUST be authored as `batuhanplb <81333730+batuhanplb@users.noreply.github.com>` (repo-local `git config user.name`/`user.email`). Why: commits authored as Lovable's own bot identity `gpt-engineer-app[bot]` are treated as Lovable's own and never show up as external commit cards in the Lovable chat, so the editor/preview stays stale. Never rewrite pushed history.
