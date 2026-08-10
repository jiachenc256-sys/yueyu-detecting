#!/usr/bin/env node
/**
 * Convert a Talcne 「导出 JSON（越语侦听）」 file into a Yueyu piece JSON.
 *
 * Usage:
 *   node scripts/import-talcne-export.mjs path/to/export.json \
 *     --id pearl-tower-text \
 *     --title "珍珠塔 · 文字层" \
 *     --title-en "Pearl Tower · text layer" \
 *     [--text-only]
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
  const args = { _: [], "text-only": false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--id" || a === "--title" || a === "--title-en") {
      args[a.slice(2)] = argv[++i];
    } else if (a === "--text-only") {
      args["text-only"] = true;
    } else if (a.startsWith("--")) {
      usage(`Unknown flag: ${a}`);
    } else {
      args._.push(a);
    }
  }
  return args;
}

function splitTranslationLines(block, expected) {
  if (!block || typeof block !== "string") return null;
  const parts = block
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length === expected ? parts : null;
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
  const hantLines = splitTranslationLines(raw.translations?.zhHant, lines.length);
  const enLines = splitTranslationLines(raw.translations?.en, lines.length);
  let enCurated = 0;
  let zhHantCount = 0;

  const cues = lines.map((text, i) => {
    const start = i * SECONDS_PER_LINE;
    const end = start + SECONDS_PER_LINE;
    const layers = {
      zh: { text: script === "zh-Hant" ? text : text, status: "corrected" },
    };
    if (script === "zh-Hant") {
      layers.zhHant = { text, status: "corrected" };
      zhHantCount += 1;
    } else if (hantLines) {
      layers.zhHant = { text: hantLines[i], status: "corrected" };
      zhHantCount += 1;
    }
    if (enLines) {
      layers.en = { text: enLines[i], status: "curated", source: "talcne-export" };
      enCurated += 1;
    }
    return {
      id: i + 1,
      start,
      end,
      rawAsr: text,
      layers,
    };
  });

  const textOnly = Boolean(args["text-only"]);
  const piece = {
    id: args.id,
    title: args.title,
    titleEn: args["title-en"],
    audio: textOnly ? "" : `assets/audio/${args.id}.mp3`,
    category: "tanci",
    sourceSrt: raw.fileNames?.[0] ? `talcne:${raw.fileNames[0]}` : "talcne-export",
    schemaVersion: "1.0.0",
    cueCount: cues.length,
    correctedCount: cues.length,
    coverage: {
      zh: cues.length,
      enCurated,
      enMt: 0,
      enAny: enCurated,
      ...(zhHantCount ? { zhHant: zhHantCount } : {}),
    },
    cues,
  };

  const outPath = join(root, "data", "transcripts", `${args.id}.json`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(piece, null, 2)}\n`, "utf8");
  console.log(`Wrote ${outPath}`);
  console.log(`Next: add pieces/${args.id}.html and an Archive card with data-archive-category="tanci"`);
  if (textOnly) {
    console.log("Text-only piece: set body data-text-only=\"true\" on the piece page (no audio required).");
  } else {
    console.log(`Note: audio path is a placeholder until you add assets/audio/${args.id}.mp3`);
  }
}

main();
