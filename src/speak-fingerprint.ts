/**
 * Lightweight spectral fingerprint match against precomputed archive clip vectors.
 * Complements text-based archive check (does not require correct ASR).
 */

export interface FpItem {
  id: string;
  pieceId: string;
  cueId: number;
  start?: number | null;
  end?: number | null;
  v: number[];
}

export interface FpIndex {
  schema: string;
  dim: number;
  n: number;
  items: FpItem[];
}

export interface FpHit {
  item: FpItem;
  score: number;
}

let cached: FpIndex | null = null;
let loadPromise: Promise<FpIndex | null> | null = null;

function assetUrl(rel: string): string {
  const path = window.location.pathname;
  const dir = path.endsWith("/") ? path : path.replace(/[^/]+$/, "");
  return new URL(rel, `${window.location.origin}${dir}`).href;
}

export async function loadFingerprintIndex(): Promise<FpIndex | null> {
  if (cached) return cached;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const res = await fetch(assetUrl("assets/speak/audio-fingerprints.json"));
      if (!res.ok) throw new Error(`audio-fp HTTP ${res.status}`);
      cached = (await res.json()) as FpIndex;
      return cached;
    } catch {
      cached = null;
      return null;
    } finally {
      loadPromise = null;
    }
  })();
  return loadPromise;
}

function cosine(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d > 1e-9 ? dot / d : 0;
}

/** Same recipe as scripts build: bins of energy + zcr, L2-normalized. */
export function fingerprintFromSamples(samples: Float32Array, bins = 24): number[] {
  const vec: number[] = [];
  const n = samples.length || 1;
  for (let b = 0; b < bins; b++) {
    const start = Math.floor((b * n) / bins);
    const end = Math.floor(((b + 1) * n) / bins);
    let energy = 0;
    let zc = 0;
    const len = Math.max(1, end - start);
    let prev = samples[start] ?? 0;
    for (let i = start; i < end; i++) {
      const x = samples[i] ?? 0;
      energy += x * x;
      if ((prev >= 0) !== (x >= 0)) zc++;
      prev = x;
    }
    vec.push(Math.sqrt(energy / len));
    vec.push(zc / len);
  }
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return vec.map((v) => v / norm);
}

export async function fingerprintFromAudioUrl(url: string, maxSec = 8): Promise<number[] | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const ctx = new AudioContext();
    try {
      const audio = await ctx.decodeAudioData(buf.slice(0));
      const ch0 = audio.getChannelData(0);
      const take = Math.min(ch0.length, Math.floor(audio.sampleRate * maxSec));
      return fingerprintFromSamples(ch0.subarray(0, take));
    } finally {
      await ctx.close();
    }
  } catch {
    return null;
  }
}

export function matchFingerprint(
  query: number[],
  index: FpIndex,
  pieceId?: string | null,
  topK = 3,
): FpHit[] {
  const hits: FpHit[] = [];
  for (const item of index.items) {
    if (pieceId && item.pieceId !== pieceId) continue;
    const score = cosine(query, item.v);
    if (score < 0.72) continue;
    hits.push({ item, score });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, topK);
}
