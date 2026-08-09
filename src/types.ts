/** Shared linguistic data types for Yueyu Detecting archive pieces. */

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
  /** Simplified Chinese (简体中文) */
  zh: ZhLayer;
  /** Traditional Chinese (繁體中文) */
  zhHant?: ZhLayer;
  /** English */
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
  zhHant?: number;
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

/** Viewer language modes: 简体 / 繁體 / English / all three. */
export type DisplayMode = "zh-Hans" | "zh-Hant" | "en" | "trilingual";
