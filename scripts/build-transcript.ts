#!/usr/bin/env node
/**
 * Parse Desktop SRT (or a provided path), apply ASR corrections,
 * and write a legacy-compatible base transcript JSON for merge-layers.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyCorrections, parseSrt } from "../src/srt.js";
import type { LegacyPiece } from "../src/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultSource = path.join(
  process.env.HOME ?? "",
  "Desktop/linguilistic project/新龙门客寨.srt",
);
const defaultOutput = path.join(root, "data/transcripts/longmen-kezhai.base.json");

async function main(): Promise<void> {
  const source = path.resolve(process.argv[2] ?? defaultSource);
  const output = path.resolve(process.argv[3] ?? defaultOutput);

  const content = await readFile(source, "utf8");
  const cues = applyCorrections(parseSrt(content));

  const payload: LegacyPiece = {
    id: "longmen-kezhai",
    title: "新龙门客寨",
    titleEn: "New Dragon Inn",
    audio: "assets/audio/longmen-kezhai.m4a",
    sourceSrt: "新龙门客寨.srt",
    cueCount: cues.length,
    correctedCount: cues.filter((c) => c.corrected).length,
    cues,
  };

  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(
    `Wrote ${payload.cueCount} cues (${payload.correctedCount} corrected) → ${output}`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
