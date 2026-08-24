#!/usr/bin/env node
/**
 * Static site has no bundler: entry scripts are cache-busted via ?v= in index.html,
 * but bare relative imports (./speak-gist.js) stay unversioned and can leave a
 * stale dependency in the browser cache — Speak then fails to load and Try sample
 * appears dead. Append the same bust token after each Speak-graph import.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const V = process.env.SPEAK_ASSET_V || "20260824q4";
const files = ["scripts/dist/src/speak.js", "scripts/dist/src/app.js"];
const targets = ["i18n.js", "speak-gist.js", "speak-prosody.js", "speak-fingerprint.js", "speak-linguistics.js"];

for (const rel of files) {
  const path = join(root, rel);
  let text = readFileSync(path, "utf8");
  let next = text;
  for (const name of targets) {
    const re = new RegExp(`(from\\s+[\"']\\.\\/${name.replace(".", "\\.")})(?:\\?v=[^\"']*)?([\"'])`, "g");
    next = next.replace(re, `$1?v=${V}$2`);
  }
  if (next !== text) {
    writeFileSync(path, next);
    console.log(`cache-bust imports in ${rel} → v=${V}`);
  }
}
