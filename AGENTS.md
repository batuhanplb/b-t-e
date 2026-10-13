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

- The app is the original Bütçe static site: `/` and `/index.html` serve src/original-index.html verbatim; app.js, core.js, sw.js, manifest, icons live in public/. Only the data layer was swapped: app.js `loadCloudStore()` imports `/cloud-store.js`, a bundle of src/cloud-store/entry.ts (same store interface as the old Firebase layer, backed by Cloud auth + `user_docs`/`shares` tables). After editing entry.ts run `bun run build:cloud-store`. Why: user requires the original UI/logic untouched.
