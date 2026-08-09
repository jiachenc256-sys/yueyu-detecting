import type {
  Coverage,
  Cue,
  EnLayer,
  EnStatus,
  LegacyCue,
  LegacyPiece,
  Piece,
  TranslationEntry,
  TranslationFile,
} from "./types.js";

const EN_STATUS_RANK: Record<EnStatus, number> = {
  curated: 3,
  draft: 2,
  mt: 1,
};

/** Higher academic authority wins when the same cue id appears in multiple files. */
export function preferEnLayer(current: EnLayer | undefined, incoming: EnLayer): EnLayer {
  if (!current) return incoming;
  return EN_STATUS_RANK[incoming.status] > EN_STATUS_RANK[current.status] ? incoming : current;
}

export function legacyCueToLayered(cue: LegacyCue): Cue {
  const zhStatus = cue.corrected ? "corrected" : cue.text === cue.raw ? "raw" : "corrected";
  const layered: Cue = {
    id: cue.id,
    start: cue.start,
    end: cue.end,
    layers: {
      zh: {
        text: cue.text,
        status: zhStatus,
      },
    },
  };
  if (cue.raw !== cue.text || cue.corrected) {
    layered.rawAsr = cue.raw;
  } else if (cue.raw) {
    layered.rawAsr = cue.raw;
  }
  return layered;
}

export function computeCoverage(cues: Cue[]): Coverage {
  let enCurated = 0;
  let enMt = 0;
  let enAny = 0;
  for (const cue of cues) {
    const en = cue.layers.en;
    if (!en) continue;
    enAny += 1;
    if (en.status === "curated") enCurated += 1;
    if (en.status === "mt") enMt += 1;
  }
  return {
    zh: cues.length,
    enCurated,
    enMt,
    enAny,
  };
}

export function indexTranslations(file: TranslationFile): Map<number, TranslationEntry> {
  const map = new Map<number, TranslationEntry>();
  for (const entry of file.entries) {
    const existing = map.get(entry.id);
    if (!existing) {
      map.set(entry.id, entry);
      continue;
    }
    const preferred = preferEnLayer(
      { text: existing.text, status: existing.status, ...(existing.source ? { source: existing.source } : {}) },
      { text: entry.text, status: entry.status, ...(entry.source ? { source: entry.source } : {}) },
    );
    map.set(entry.id, {
      id: entry.id,
      text: preferred.text,
      status: preferred.status,
      ...(preferred.source ? { source: preferred.source } : {}),
    });
  }
  return map;
}

function entryToLayer(entry: TranslationEntry): EnLayer {
  const layer: EnLayer = {
    text: entry.text,
    status: entry.status,
  };
  if (entry.source) layer.source = entry.source;
  return layer;
}

/**
 * Merge Chinese base cues with curated and MT English sidecars.
 * Precedence: curated > draft > mt.
 */
export function mergeLayers(
  base: LegacyPiece | Piece,
  curated?: TranslationFile,
  mt?: TranslationFile,
): Piece {
  const cues: Cue[] = ("schemaVersion" in base
    ? base.cues
    : base.cues.map(legacyCueToLayered)
  ).map((cue) => ({
    ...cue,
    layers: { ...cue.layers, zh: { ...cue.layers.zh } },
  }));

  const curatedIndex = curated ? indexTranslations(curated) : new Map<number, TranslationEntry>();
  const mtIndex = mt ? indexTranslations(mt) : new Map<number, TranslationEntry>();

  for (const cue of cues) {
    let en = cue.layers.en;
    const curatedEntry = curatedIndex.get(cue.id);
    if (curatedEntry) {
      en = preferEnLayer(en, entryToLayer(curatedEntry));
    }
    const mtEntry = mtIndex.get(cue.id);
    if (mtEntry) {
      en = preferEnLayer(en, entryToLayer(mtEntry));
    }
    if (en) {
      cue.layers.en = en;
    }
  }

  const coverage = computeCoverage(cues);
  const correctedCount = cues.filter(
    (c) => c.layers.zh.status === "corrected" || c.layers.zh.status === "reviewed",
  ).length;

  const piece: Piece = {
    id: base.id,
    title: base.title,
    titleEn: base.titleEn,
    audio: base.audio,
    schemaVersion: "1.0.0",
    cueCount: cues.length,
    correctedCount,
    coverage,
    cues,
  };
  const sourceSrt = "sourceSrt" in base ? base.sourceSrt : undefined;
  if (typeof sourceSrt === "string" && sourceSrt.length > 0) {
    piece.sourceSrt = sourceSrt;
  }
  return piece;
}
