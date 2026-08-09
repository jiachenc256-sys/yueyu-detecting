/**
 * Add / refresh 繁體中文 (zhHant) layers from 简体 zh text via OpenCC.
 * Also ensures coverage.zhHant is set.
 *
 *   npm run seed:zh-hant
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as OpenCC from "opencc-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "data/transcripts");
const converter = OpenCC.Converter({ from: "cn", to: "tw" });

interface CueLike {
  layers: {
    zh: { text: string; status: string };
    zhHant?: { text: string; status: string };
    en?: unknown;
  };
}

interface PieceLike {
  id: string;
  coverage: Record<string, number>;
  cues: CueLike[];
}

for (const name of fs.readdirSync(dir).filter((f) => f.endsWith(".json") && !f.includes(".base."))) {
  const file = path.join(dir, name);
  const piece = JSON.parse(fs.readFileSync(file, "utf8")) as PieceLike;
  if (!Array.isArray(piece.cues) || !piece.coverage) {
    console.log(`${name}: skip (not a merged piece)`);
    continue;
  }
  let count = 0;
  for (const cue of piece.cues) {
    if (!cue.layers?.zh) continue;
    const hans = cue.layers.zh.text ?? "";
    if (!hans.trim()) continue;
    const hant = converter(hans);
    cue.layers.zhHant = {
      text: hant,
      status: cue.layers.zh.status === "raw" ? "raw" : "corrected",
    };
    count += 1;
  }
  piece.coverage.zhHant = count;
  fs.writeFileSync(file, `${JSON.stringify(piece, null, 2)}\n`, "utf8");
  console.log(`${name}: zhHant=${count}`);
}
