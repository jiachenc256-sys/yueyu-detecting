#!/usr/bin/env node
/**
 * Convert a Talcne 「导出 JSON（越语侦听）」 file into a Yueyu piece JSON.
 *
 * Usage:
 *   node scripts/import-talcne-export.mjs path/to/export.json \
 *     --id pearl-tower-text \
 *     --title "珍珠塔 · 文字层" \
 *     --title-en "Pearl Tower · text layer"
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const SECONDS_PER_LINE = 4;

function usage(msg) {
  if (msg) console.error(msg);
  console.error(`Usage: node scripts/import-talcne-export.mjs <export.json> --id <kebab-id> --title <中文> --title-en <English>`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--id" || a === "--title" || a === "--title-en") {
      args[a.slice(2)] = argv[++i];
    } else if (a.startsWith("--")) {
      usage(`Unknown flag: ${a}`);
    } else {
      args._.push(a);
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = args._[0];
  if (!inputPath) usage("Missing export JSON path.");
  if (!args.id || !args.title || !args["title-en"]) usage("Need --id, --title, and --title-en.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(args.id)) usage("--id must be kebab-case.");

  const raw = JSON.parse(readFileSync(resolve(inputPath), "utf8"));
  if (raw.source && raw.source !== "talcne") {
    console.warn(`Warning: source is "${raw.source}", expected "talcne".`);
  }
  const lines = Array.isArray(raw.lines) ? raw.lines.map(String).map((s) => s.trim()).filter(Boolean) : [];
  if (!lines.length) usage("Export has no non-empty lines[].");

  const script = raw.script === "zh-Hant" ? "zh-Hant" : "zh-Hans";
  const cues = lines.map((text, i) => {
    const start = i * SECONDS_PER_LINE;
    const end = start + SECONDS_PER_LINE;
    const zhLayer = { text, status: "corrected" };
    const layers =
      script === "zh-Hant"
        ? { zh: { text, status: "corrected" }, zhHant: zhLayer }
        : { zh: zhLayer };
    return {
      id: i + 1,
      start,
      end,
      rawAsr: text,
      layers,
    };
  });

  const piece = {
    id: args.id,
    title: args.title,
    titleEn: args["title-en"],
    audio: `assets/audio/${args.id}.mp3`,
    category: "tanci",
    sourceSrt: raw.fileNames?.[0] ? `talcne:${raw.fileNames[0]}` : "talcne-export",
    schemaVersion: "1.0.0",
    cueCount: cues.length,
    correctedCount: cues.length,
    coverage: {
      zh: cues.length,
      enCurated: 0,
      enMt: 0,
      enAny: 0,
      ...(script === "zh-Hant" ? { zhHant: cues.length } : {}),
    },
    cues,
  };

  const outPath = join(root, "data", "transcripts", `${args.id}.json`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(piece, null, 2)}\n`, "utf8");
  console.log(`Wrote ${outPath}`);
  console.log(`Next: add an Archive card in index.html with data-archive-category="tanci" href="pieces/${args.id}.html"`);
  console.log(`Note: audio path is a placeholder until you add assets/audio/${args.id}.mp3`);
}

main();
