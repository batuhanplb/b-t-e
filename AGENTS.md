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

- Mobile module edits use `meta.dashMobile` and the shared pointer/grid engine; desktop edits remain in `meta.dash`. Why: phone sizing must not overwrite saved desktop coordinates.
