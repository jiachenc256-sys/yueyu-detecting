import type { Cue, DisplayMode } from "./types.js";
import type { SiteLocale } from "./i18n.js";

export function cueMatchesQuery(cue: Cue, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const zh = cue.layers.zh.text.toLowerCase();
  const zhHant = cue.layers.zhHant?.text.toLowerCase() ?? "";
  const en = cue.layers.en?.text.toLowerCase() ?? "";
  const raw = cue.rawAsr?.toLowerCase() ?? "";
  const speaker = cue.speaker?.toLowerCase() ?? "";
  const speakerEn = cue.speakerEn?.toLowerCase() ?? "";
  return (
    zh.includes(q) ||
    zhHant.includes(q) ||
    en.includes(q) ||
    raw.includes(q) ||
    speaker.includes(q) ||
    speakerEn.includes(q)
  );
}

/** Speaker label for the active UI locale / display mode. */
export function speakerDisplayLabel(
  cue: Cue,
  mode: DisplayMode,
  uiLocale?: SiteLocale,
): string | null {
  if (!cue.speaker && !cue.speakerEn) return null;
  const preferEn = mode === "en" || uiLocale === "en";
  if (preferEn) return cue.speakerEn ?? cue.speaker ?? null;
  return cue.speaker ?? cue.speakerEn ?? null;
}

export function primaryDisplayText(cue: Cue, mode: DisplayMode): string {
  if (mode === "en") {
    return cue.layers.en?.text ?? cue.layers.zh.text;
  }
  if (mode === "zh-Hant") {
    return cue.layers.zhHant?.text ?? cue.layers.zh.text;
  }
  // zh-Hans + trilingual primary line
  return cue.layers.zh.text;
}

/** Extra lines under the primary (繁 and/or EN depending on mode). */
export function secondaryDisplayLines(cue: Cue, mode: DisplayMode): string[] {
  if (mode === "trilingual") {
    const lines: string[] = [];
    const hant = cue.layers.zhHant?.text?.trim();
    const en = cue.layers.en?.text?.trim();
    if (hant) lines.push(hant);
    if (en) lines.push(en);
    return lines;
  }
  return [];
}

/** @deprecated Prefer secondaryDisplayLines; kept for older tests calling bilingual-style EN under 简. */
export function secondaryDisplayText(cue: Cue, mode: DisplayMode): string | null {
  if (mode === "trilingual") {
    return cue.layers.en?.text ?? null;
  }
  return null;
}

export function enBadgeLabel(cue: Cue): string | null {
  const status = cue.layers.en?.status;
  if (!status) return null;
  if (status === "curated") return "Curated";
  if (status === "draft") return "Draft";
  return "MT — not authoritative";
}
