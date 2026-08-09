#!/usr/bin/env node
/**
 * Merge Chinese base cues with curated + MT English sidecars.
 * Writes the academic piece JSON consumed by the viewer.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mergeLayers } from "../src/merge.js";
import type { LegacyPiece, Piece, TranslationFile } from "../src/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function maybeReadJson<T>(filePath: string): Promise<T | undefined> {
  try {
    return await readJson<T>(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function main(): Promise<void> {
  const pieceId = process.argv[2] ?? "longmen-kezhai";
  const basePath = path.join(root, "data/transcripts", `${pieceId}.base.json`);
  const legacyPath = path.join(root, "data/transcripts", `${pieceId}.json`);
  const curatedPath = path.join(root, "data/translations", `${pieceId}.en.json`);
  const mtPath = path.join(root, "data/translations", `${pieceId}.en.mt.json`);
  const outPath = path.join(root, "data/transcripts", `${pieceId}.json`);

  const base =
    (await maybeReadJson<LegacyPiece | Piece>(basePath)) ??
    (await readJson<LegacyPiece | Piece>(legacyPath));
  const curated = await maybeReadJson<TranslationFile>(curatedPath);
  const mt = await maybeReadJson<TranslationFile>(mtPath);

  const merged = mergeLayers(base, curated, mt);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");

  console.log(
    `Merged ${merged.cueCount} cues → ${outPath}\n` +
      `  zh=${merged.coverage.zh} curated=${merged.coverage.enCurated} ` +
      `mt=${merged.coverage.enMt} enAny=${merged.coverage.enAny}`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
