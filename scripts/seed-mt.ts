#!/usr/bin/env node
/**
 * Build an offline MT sidecar for cues lacking curated English.
 *
 * Uses a small phrase lexicon + structural gloss heuristics so the archive
 * remains reproducible without API keys. Every entry is status "mt".
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { LegacyPiece, Piece, TranslationEntry, TranslationFile } from "../src/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const LEXICON: Array<[RegExp, string]> = [
  [/序曲/g, "overture"],
  [/哎呀+/g, "aiya"],
  [/诸位客官/g, "honored guests"],
  [/龙门客栈/g, "Dragon Gate Inn"],
  [/龙门关/g, "Dragon Gate Pass"],
  [/老板娘/g, "proprietress"],
  [/金镶玉/g, "Jin Xiangyu"],
  [/千户将军/g, "Company Commander"],
  [/鞑靼人?/g, "Tatar"],
  [/鞑虏/g, "Tartar dog"],
  [/大漠/g, "desert"],
  [/朝廷/g, "the court"],
  [/东厂/g, "Eastern Depot"],
  [/通缉令/g, "wanted order"],
  [/逃犯/g, "fugitive"],
  [/姐姐/g, "elder sister"],
  [/睡了/g, "has gone to sleep"],
  [/有理/g, "well reasoned"],
  [/是不是啊/g, "isn't that so"],
  [/我要你的/g, "I want your "],
  [/不配在人间/g, "unfit for this world"],
  [/这破门/g, "this broken door"],
  [/又该修了/g, "needs fixing again"],
  [/这是要变天了/g, "the weather is about to change"],
  [/方圆百里/g, "for a hundred li around"],
  [/国色天香/g, "peerless beauty"],
  [/婀娜娉婷/g, "graceful and poised"],
  [/大逆不道/g, "treasonous talk"],
  [/鸟不拉屎/g, "a desolate place"],
  [/半夜三更/g, "in the dead of night"],
  [/风锁雨/g, "wind locks the rain"],
  [/人踪迹/g, "traces of people"],
  [/心焦急/g, "anxious hearts"],
  [/不太平/g, "unrest"],
  [/天子爷/g, "the Son of Heaven"],
  [/老天爷/g, "Heaven"],
];

function glossZh(text: string): string {
  let out = text.trim();
  if (!out) return "[empty]";

  // Stage directions / brackets
  if (/^\[[^\]]+\]$/.test(out)) {
    return out.replace("序曲", "Overture");
  }

  let working = out;
  for (const [pattern, replacement] of LEXICON) {
    working = working.replace(pattern, replacement);
  }

  // If lexicon covered most Chinese characters, tidy spacing.
  const remainingHan = (working.match(/\p{Script=Han}/gu) ?? []).length;
  if (remainingHan === 0) {
    return working.replace(/\s+/g, " ").trim();
  }

  // Provisional academic MT gloss: keep residual Chinese visible for audit.
  return `[MT] ${working.replace(/\s+/g, " ").trim()}`;
}

async function main(): Promise<void> {
  const pieceId = process.argv[2] ?? "longmen-kezhai";
  const basePath = path.join(root, "data/transcripts", `${pieceId}.base.json`);
  const piecePath = path.join(root, "data/transcripts", `${pieceId}.json`);
  const curatedPath = path.join(root, "data/translations", `${pieceId}.en.json`);
  const outPath = path.join(root, "data/translations", `${pieceId}.en.mt.json`);

  let base: LegacyPiece | Piece;
  try {
    base = JSON.parse(await readFile(basePath, "utf8")) as LegacyPiece | Piece;
  } catch {
    base = JSON.parse(await readFile(piecePath, "utf8")) as LegacyPiece | Piece;
  }

  const curatedIds = new Set<number>();
  try {
    const curated = JSON.parse(await readFile(curatedPath, "utf8")) as TranslationFile;
    for (const entry of curated.entries) curatedIds.add(entry.id);
  } catch {
    // optional
  }

  const entries: TranslationEntry[] = [];
  for (const cue of base.cues) {
    if (curatedIds.has(cue.id)) continue;
    const zhText =
      "layers" in cue && cue.layers
        ? (cue as { layers: { zh: { text: string } } }).layers.zh.text
        : (cue as { text: string }).text;
    entries.push({
      id: cue.id,
      text: glossZh(zhText),
      status: "mt",
      source: "offline-lexicon-heuristic-2026-08",
    });
  }

  const file: TranslationFile = {
    pieceId,
    language: "en",
    schemaVersion: "1.0.0",
    entries,
  };

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(file, null, 2)}\n`, "utf8");
  console.log(`Wrote ${entries.length} MT entries → ${outPath}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
