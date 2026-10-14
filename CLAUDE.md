# Bütçe — rules for working in this repo

## CURRENT STATE (read this first)

- **Firebase is GONE.** No Firebase SDK, no `firebaseStore()`, no Firestore, no
  Firebase Auth anywhere in the code path. Do not add any of it back, and do
  not "fix" anything assuming Firebase is in use.
- The backend is **Lovable Cloud** (Supabase-based): tables `user_docs` +
  `shares`, Cloud auth with Google sign-in, RLS per user. Data starts fresh —
  the old Firebase data was never migrated.
- `public/__/firebase/init.json` is a leftover artifact from the original app,
  kept only so the static file set stays identical. It is unused.
- The bundle `public/cloud-store.js` (from `src/cloud-store/entry.ts`) is the
  ONLY data layer. If you see Firebase references in docs or comments, they
  describe the OLD app and are historical.

## Working with this repo

This repo syncs two-way with the user's Lovable project on `main`. Work directly
on `main`, commit, and push — never leave work uncommitted, and never force-push,
rebase, amend or squash pushed commits (it breaks Lovable's project history).


## Hard rules

- The user has authorized a visual refresh, superseding the prior original-UI
  restriction. Keep Turkish UI, TRY currency (tr-TR formatting), existing
  workflows and saved module layouts. Shared styling is in `public/butce-theme.css`;
  prioritize compact readable text and tables that do not overflow the page.
- `/` and `/index.html` serve `src/original-index.html` verbatim. `app.js`,
  `core.js`, `sw.js`, manifest and icons live in `public/`.
- The only swapped layer is data: `app.js` calls `loadCloudStore()`, which
  imports `/cloud-store.js` — a bundle of `src/cloud-store/entry.ts` (same
  store interface the old Firebase layer had, backed by Lovable Cloud:
  `user_docs` + `shares` tables, Cloud auth + Google sign-in).
- After editing `src/cloud-store/entry.ts`, run `bun run build:cloud-store`
  so `public/cloud-store.js` is regenerated. Committing the edit without the
  rebuilt bundle breaks the app.

## Testing / data

- There is ONE live backend — running the app locally writes real user data.
  Any manual testing must use the test account:
  `butce.qa.test.0913@mailinator.com`. Delete trial records afterwards.
- Do not commit database dumps or credentials. Secrets are env vars.

## Stack notes

- Static-site core (app.js/core.js) is vanilla JS — keep it that way.
- TanStack Start is only the host that serves the original files.
