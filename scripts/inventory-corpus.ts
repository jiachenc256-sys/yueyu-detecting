#!/usr/bin/env node
/**
 * Scan the local Baidu/corpus drop folder and write a lightweight inventory.
 * Media files stay on disk; only path/size metadata is written into the repo.
 */
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultDrop = path.join(
  process.env.HOME ?? "",
  "Desktop/linguilistic project/baidu-yueju",
);

const MEDIA_EXT = new Set([
  ".mp4",
  ".mov",
  ".m4a",
  ".mp3",
  ".wav",
  ".flac",
  ".mkv",
  ".avi",
  ".ts",
  ".flv",
  ".webm",
  ".aac",
]);

interface InventoryItem {
  relativePath: string;
  ext: string;
  bytes: number;
  kind: "video" | "audio" | "other";
}

async function walk(dir: string, base: string, out: InventoryItem[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        `Drop folder not found:\n  ${base}\nRun: make corpus-setup\nThen download Baidu packs into that folder.`,
      );
    }
    throw error;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, base, out);
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!MEDIA_EXT.has(ext)) continue;
    const info = await stat(full);
    const kind: InventoryItem["kind"] = [".mp4", ".mov", ".mkv", ".avi", ".ts", ".flv", ".webm"].includes(
      ext,
    )
      ? "video"
      : [".m4a", ".mp3", ".wav", ".flac", ".aac"].includes(ext)
        ? "audio"
        : "other";
    out.push({
      relativePath: path.relative(base, full).split(path.sep).join("/"),
      ext,
      bytes: info.size,
      kind,
    });
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

async function main(): Promise<void> {
  const drop = path.resolve(process.argv[2] ?? defaultDrop);
  const items: InventoryItem[] = [];
  await walk(drop, drop, items);
  items.sort((a, b) => a.relativePath.localeCompare(b.relativePath, "en"));

  const summary = {
    generatedAt: new Date().toISOString(),
    dropFolder: drop,
    totalFiles: items.length,
    totalBytes: items.reduce((sum, item) => sum + item.bytes, 0),
    videoCount: items.filter((i) => i.kind === "video").length,
    audioCount: items.filter((i) => i.kind === "audio").length,
    items,
  };

  const outPath = path.join(root, "data/corpus/inventory.json");
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  console.log(`Drop folder: ${drop}`);
  console.log(`Media files: ${summary.totalFiles} (${formatBytes(summary.totalBytes)})`);
  console.log(`  video: ${summary.videoCount}`);
  console.log(`  audio: ${summary.audioCount}`);
  console.log(`Wrote → ${outPath}`);

  if (summary.totalFiles === 0) {
    console.log("");
    console.log("No media found yet. Download your Baidu packs into:");
    console.log(`  ${drop}/videos`);
    console.log(`  ${drop}/audio-or-tracks`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
