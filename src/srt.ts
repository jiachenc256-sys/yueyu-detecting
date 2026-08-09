import { parseSrtTime } from "./time.js";
import type { LegacyCue } from "./types.js";

export interface SrtParseOptions {
  manualFixes?: Record<number, string>;
  patternFixes?: Array<{ pattern: RegExp; replacement: string }>;
}

const DEFAULT_MANUAL_FIXES: Record<number, string> = {
  1: "[序曲]",
  2: "[序曲]",
  3: "[序曲]",
  4: "[序曲]",
  5: "我要你的眼睛 你有眼看不见",
  6: "我要你的皮 你有皮不要脸呐",
  7: "我要你的脚 你有腿站不直呐",
};

const DEFAULT_PATTERN_FIXES: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /眼响/g, replacement: "眼睛" },
  { pattern: /看不见p$/g, replacement: "看不见" },
  { pattern: /交响/g, replacement: "脚" },
  { pattern: /衣不要/g, replacement: "皮不要" },
  { pattern: /镶镶/g, replacement: "镶玉" },
];

export function parseSrt(content: string): LegacyCue[] {
  const blocks = content.trim().split(/\n\s*\n/);
  const cues: LegacyCue[] = [];

  for (const block of blocks) {
    const lines = block.trim().split(/\r?\n/);
    if (lines.length < 3) continue;
    const index = Number(lines[0]?.trim());
    if (!Number.isInteger(index)) continue;
    const timing = lines[1]?.trim() ?? "";
    if (!timing.includes("-->")) continue;
    const [startStr, endStr] = timing.split("-->").map((part) => part.trim());
    if (!startStr || !endStr) continue;
    const text = lines
      .slice(2)
      .map((line) => line.trim())
      .filter(Boolean)
      .join(" ");
    cues.push({
      id: index,
      start: parseSrtTime(startStr),
      end: parseSrtTime(endStr),
      raw: text,
      text,
    });
  }

  return cues;
}

export function applyCorrections(cues: LegacyCue[], options: SrtParseOptions = {}): LegacyCue[] {
  const manualFixes = options.manualFixes ?? DEFAULT_MANUAL_FIXES;
  const patternFixes = options.patternFixes ?? DEFAULT_PATTERN_FIXES;

  return cues.map((cue) => {
    const next = { ...cue };
    const manual = manualFixes[cue.id];
    if (manual !== undefined) {
      next.text = manual;
      next.corrected = true;
      return next;
    }

    let text = cue.text;
    for (const { pattern, replacement } of patternFixes) {
      text = text.replace(pattern, replacement);
    }
    if (text !== cue.text) {
      next.text = text;
      next.corrected = true;
    }
    return next;
  });
}
