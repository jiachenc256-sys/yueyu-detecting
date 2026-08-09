import type { Cue, DisplayMode } from "./types.js";

export function cueMatchesQuery(cue: Cue, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const zh = cue.layers.zh.text.toLowerCase();
  const en = cue.layers.en?.text.toLowerCase() ?? "";
  const raw = cue.rawAsr?.toLowerCase() ?? "";
  return zh.includes(q) || en.includes(q) || raw.includes(q);
}

export function primaryDisplayText(cue: Cue, mode: DisplayMode): string {
  if (mode === "en") {
    return cue.layers.en?.text ?? cue.layers.zh.text;
  }
  return cue.layers.zh.text;
}

export function secondaryDisplayText(cue: Cue, mode: DisplayMode): string | null {
  if (mode !== "bilingual") return null;
  return cue.layers.en?.text ?? null;
}

export function enBadgeLabel(cue: Cue): string | null {
  const status = cue.layers.en?.status;
  if (!status) return null;
  if (status === "curated") return "Curated";
  if (status === "draft") return "Draft";
  return "MT — not authoritative";
}
