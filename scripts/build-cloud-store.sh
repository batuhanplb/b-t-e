#!/usr/bin/env bash
# Bundles src/cloud-store/entry.ts into public/cloud-store.js for the original static app.
set -euo pipefail
cd "$(dirname "$0")/.."
URL=$(grep '^VITE_SUPABASE_URL=' .env | cut -d= -f2- | tr -d '"')
KEY=$(grep '^VITE_SUPABASE_PUBLISHABLE_KEY=' .env | cut -d= -f2- | tr -d '"')
bun build src/cloud-store/entry.ts --target=browser --format=esm --minify \
  --define "__SB_URL__=\"$URL\"" --define "__SB_KEY__=\"$KEY\"" --outfile public/cloud-store.js
