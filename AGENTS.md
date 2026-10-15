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
