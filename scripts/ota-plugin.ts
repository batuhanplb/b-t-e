// Site derlenirken Android uygulaması için havadan güncelleme paketi üretir:
// public/ota/bundle.zip (app-www ile aynı içerik) + public/ota/latest.json (içerik özetinden sürüm).
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { zipSync } from "fflate";

function collect(dir: string, root: string, out: Record<string, Uint8Array>) {
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    const rel = relative(root, full).split("\\").join("/");
    if (rel === "ota" || rel === "__" || rel === "sw.js") continue;
    if (statSync(full).isDirectory()) collect(full, root, out);
    else out[rel] = new Uint8Array(readFileSync(full));
  }
}

export function buildOta(root = process.cwd()) {
  const pub = join(root, "public");
  const files: Record<string, Uint8Array> = {};
  collect(pub, pub, files);
  files["index.html"] = new Uint8Array(readFileSync(join(root, "src/original-index.html")));
  const h = createHash("sha256");
  for (const k of Object.keys(files).sort()) h.update(k).update(files[k]);
  const version = "w-" + h.digest("hex").slice(0, 12);
  const outDir = join(pub, "ota");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "bundle.zip"), zipSync(files, { level: 9 }));
  writeFileSync(join(outDir, "latest.json"), JSON.stringify({ version, url: "/ota/bundle.zip" }));
  return version;
}

export function otaPlugin() {
  return {
    name: "butce-ota",
    apply: "build" as const,
    buildStart() {
      buildOta();
    },
  };
}
