/** Shared academic data types for Yueju archive pieces. */

export type ZhStatus = "raw" | "corrected" | "reviewed";
export type EnStatus = "curated" | "mt" | "draft";

export interface ZhLayer {
  text: string;
  status: ZhStatus;
}

export interface EnLayer {
  text: string;
  status: EnStatus;
  source?: string;
}

export interface CueLayers {
  zh: ZhLayer;
  en?: EnLayer;
}

export interface Cue {
  id: number;
  start: number;
  end: number;
  rawAsr?: string;
  layers: CueLayers;
}

export interface Coverage {
  zh: number;
  enCurated: number;
  enMt: number;
  enAny: number;
}

export interface Piece {
  id: string;
  title: string;
  titleEn: string;
  audio: string;
  sourceSrt?: string;
  schemaVersion: "1.0.0";
  cueCount: number;
  correctedCount: number;
  coverage: Coverage;
  cues: Cue[];
}

/** Sidecar translation entry keyed by cue id. */
export interface TranslationEntry {
  id: number;
  text: string;
  status: EnStatus;
  source?: string;
}

export interface TranslationFile {
  pieceId: string;
  language: "en";
  schemaVersion: "1.0.0";
  entries: TranslationEntry[];
}

/** Legacy flat cue produced by early pipeline builds. */
export interface LegacyCue {
  id: number;
  start: number;
  end: number;
  raw: string;
  text: string;
  corrected?: boolean;
}

export interface LegacyPiece {
  id: string;
  title: string;
  titleEn: string;
  audio: string;
  sourceSrt?: string;
  cueCount: number;
  correctedCount: number;
  cues: LegacyCue[];
}

export type DisplayMode = "zh" | "en" | "bilingual";
