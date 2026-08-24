/**
 * Archive-anchored gist + theme radar when ASR is weak.
 * Matches noisy hyp against lyric-index.json (char bigrams + theme keywords).
 * Optional: piece filter, playhead time window, scene-card vernacular gist.
 */

export type ThemeId =
  | "farewell"
  | "longing"
  | "exam"
  | "marriage"
  | "oath"
  | "grief";

export interface LyricEntry {
  id: string;
  pieceId: string;
  title: string;
  text: string;
  themes: ThemeId[];
  start?: number;
  end?: number;
}

export interface LyricIndex {
  schema: string;
  themes: Array<{ id: ThemeId; label: string }>;
  gist: Record<ThemeId, { zh: string; en: string }>;
  pieces?: Record<string, { title?: string; audio?: string }>;
  n: number;
  entries: LyricEntry[];
}

export interface MatchHit {
  entry: LyricEntry;
  score: number;
}

export interface SceneCard {
  start: number;
  end: number;
  zh: string;
  en: string;
}

export interface SceneCardsFile {
  schema: string;
  cards: Record<string, SceneCard[]>;
}

export interface GistResult {
  mode: "direct" | "anchored" | "gist";
  confidence: number;
  hyp: string;
  matches: MatchHit[];
  themeScores: Record<ThemeId, number>;
  topThemes: ThemeId[];
  gistZh: string;
  gistEn: string;
  archiveLine: string | null;
  archiveTitle: string | null;
  sceneZh: string | null;
  sceneEn: string | null;
  timeAnchored: boolean;
}

export interface AnalyzeOpts {
  pieceId?: string | null;
  timeSec?: number | null;
  windowSec?: number;
  sceneCards?: SceneCardsFile | null;
  pinyinMap?: PinyinMapFile | null;
}

interface PinyinMapFile {
  schema: string;
  map: Record<string, { p: string; i: string }>;
}

let cachedIndex: LyricIndex | null = null;
let loadPromise: Promise<LyricIndex | null> | null = null;
let cachedScenes: SceneCardsFile | null = null;
let scenesPromise: Promise<SceneCardsFile | null> | null = null;
let cachedPinyin: PinyinMapFile | null = null;
let pinyinPromise: Promise<PinyinMapFile | null> | null = null;
let cachedPieceRadar: { axes: Record<string, Array<{ id: ThemeId; label: string }>> } | null = null;
let pieceRadarPromise: Promise<typeof cachedPieceRadar> | null = null;

const THEME_ORDER: ThemeId[] = [
  "farewell",
  "longing",
  "exam",
  "marriage",
  "oath",
  "grief",
];

function assetUrl(rel: string): string {
  const path = window.location.pathname;
  const dir = path.endsWith("/") ? path : path.replace(/[^/]+$/, "");
  return new URL(rel, `${window.location.origin}${dir}`).href;
}

function normChars(s: string): string {
  return (s || "")
    .replace(/\s+/g, "")
    .replace(/[^\u4e00-\u9fffA-Za-z0-9]/g, "");
}

function bigrams(s: string): Set<string> {
  const t = normChars(s);
  const out = new Set<string>();
  if (t.length <= 1) {
    if (t) out.add(t);
    return out;
  }
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

function looksDegenerate(hyp: string): boolean {
  const t = normChars(hyp);
  if (t.length < 2) return true;
  const uniq = new Set(t.split("")).size;
  if (t.length >= 4 && uniq / t.length < 0.35) return true;
  return false;
}

export async function loadLyricIndex(): Promise<LyricIndex | null> {
  if (cachedIndex) return cachedIndex;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const res = await fetch(assetUrl("assets/speak/lyric-index.json"));
      if (!res.ok) throw new Error(`lyric-index HTTP ${res.status}`);
      cachedIndex = (await res.json()) as LyricIndex;
      return cachedIndex;
    } catch {
      cachedIndex = null;
      return null;
    } finally {
      loadPromise = null;
    }
  })();
  return loadPromise;
}

export async function loadSceneCards(): Promise<SceneCardsFile | null> {
  if (cachedScenes) return cachedScenes;
  if (scenesPromise) return scenesPromise;
  scenesPromise = (async () => {
    try {
      const res = await fetch(assetUrl("assets/speak/scene-cards.json"));
      if (!res.ok) throw new Error(`scene-cards HTTP ${res.status}`);
      cachedScenes = (await res.json()) as SceneCardsFile;
      return cachedScenes;
    } catch {
      cachedScenes = null;
      return null;
    } finally {
      scenesPromise = null;
    }
  })();
  return scenesPromise;
}

export async function loadPinyinMap(): Promise<PinyinMapFile | null> {
  if (cachedPinyin) return cachedPinyin;
  if (pinyinPromise) return pinyinPromise;
  pinyinPromise = (async () => {
    try {
      const res = await fetch(assetUrl("assets/speak/pinyin-map.json"));
      if (!res.ok) throw new Error(`pinyin-map HTTP ${res.status}`);
      cachedPinyin = (await res.json()) as PinyinMapFile;
      return cachedPinyin;
    } catch {
      cachedPinyin = null;
      return null;
    } finally {
      pinyinPromise = null;
    }
  })();
  return pinyinPromise;
}

export async function loadPieceRadar(): Promise<typeof cachedPieceRadar> {
  if (cachedPieceRadar) return cachedPieceRadar;
  if (pieceRadarPromise) return pieceRadarPromise;
  pieceRadarPromise = (async () => {
    try {
      const res = await fetch(assetUrl("assets/speak/piece-radar.json"));
      if (!res.ok) throw new Error(`piece-radar HTTP ${res.status}`);
      cachedPieceRadar = (await res.json()) as NonNullable<typeof cachedPieceRadar>;
      return cachedPieceRadar;
    } catch {
      cachedPieceRadar = null;
      return null;
    } finally {
      pieceRadarPromise = null;
    }
  })();
  return pieceRadarPromise;
}

export function getPieceRadarAxes(
  pieceId: string | null | undefined,
  fallback: Array<{ id: ThemeId; label: string }>,
): Array<{ id: ThemeId; label: string }> {
  if (!pieceId || !cachedPieceRadar?.axes?.[pieceId]) return fallback;
  return cachedPieceRadar.axes[pieceId];
}

/** English labels for theme radar when UI locale is EN (assets store Chinese labels). */
export const THEME_LABEL_EN: Record<ThemeId, string> = {
  farewell: "Farewell",
  longing: "Longing",
  exam: "Exam / career",
  marriage: "Marriage bond",
  oath: "Vow / coded love",
  grief: "Grief",
};

export function localizeThemeAxes(
  axes: Array<{ id: ThemeId; label: string }>,
  preferEn: boolean,
): Array<{ id: ThemeId; label: string }> {
  if (!preferEn) return axes;
  return axes.map((a) => ({ id: a.id, label: THEME_LABEL_EN[a.id] ?? a.label }));
}

function toPinyinSyllables(text: string, map: PinyinMapFile | null): string[] {
  const out: string[] = [];
  for (const ch of normChars(text)) {
    const hit = map?.map[ch];
    if (hit?.p) out.push(hit.p);
    else if (/[a-z0-9]/i.test(ch)) out.push(ch.toLowerCase());
  }
  return out;
}

function pinyinBigrams(syllables: string[]): Set<string> {
  const out = new Set<string>();
  if (syllables.length === 1) {
    out.add(syllables[0]!);
    return out;
  }
  for (let i = 0; i < syllables.length - 1; i++) {
    out.add(`${syllables[i]}-${syllables[i + 1]}`);
  }
  return out;
}

export function pickSceneCard(
  cards: SceneCardsFile | null | undefined,
  pieceId: string | null | undefined,
  timeSec: number | null | undefined,
): SceneCard | null {
  if (!cards || !pieceId) return null;
  const list = cards.cards[pieceId];
  if (!list?.length) return null;
  const t = timeSec ?? null;
  if (t != null) {
    const hit = list.find((c) => t >= c.start && t <= c.end);
    if (hit) return hit;
  }
  return list[0] ?? null;
}

export function scoreHypAgainstIndex(
  hyp: string,
  index: LyricIndex,
  topK = 5,
  pieceId?: string | null,
  timeSec?: number | null,
  windowSec = 50,
  pinyinMap?: PinyinMapFile | null,
): MatchHit[] {
  const hb = bigrams(hyp);
  const hypPy = pinyinBigrams(toPinyinSyllables(hyp, pinyinMap ?? null));
  const scored: MatchHit[] = [];
  const useTime = timeSec != null && Number.isFinite(timeSec) && !!pieceId;

  for (const entry of index.entries) {
    if (pieceId && entry.pieceId !== pieceId) continue;

    const charScore = jaccard(hb, bigrams(entry.text));
    const pyScore = hypPy.size
      ? jaccard(hypPy, pinyinBigrams(toPinyinSyllables(entry.text, pinyinMap ?? null)))
      : 0;
    // Blend: characters still primary; pinyin rescues homophone ASR errors
    let score = Math.max(charScore, 0.55 * charScore + 0.45 * pyScore);
    if (score <= 0.02) continue;

    if (useTime && entry.start != null && entry.end != null) {
      const mid = (entry.start + entry.end) / 2;
      const dist = Math.abs(mid - (timeSec as number));
      if (dist > windowSec) {
        if (score < 0.35) continue;
        score *= 0.55;
      } else {
        const near = 1 - dist / windowSec;
        score = Math.min(1, score * (1 + 0.45 * near));
      }
    }

    scored.push({ entry, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

function themeScoresFromMatches(matches: MatchHit[], hyp: string): Record<ThemeId, number> {
  const scores = Object.fromEntries(THEME_ORDER.map((t) => [t, 0])) as Record<ThemeId, number>;
  for (const m of matches) {
    for (const th of m.entry.themes) {
      scores[th] = Math.max(scores[th], m.score);
    }
  }
  const h = normChars(hyp);
  const KW: Record<ThemeId, string[]> = {
    farewell: ["送", "别", "江边", "上京", "帝京"],
    longing: ["思", "望", "泪", "夜", "孤"],
    exam: ["试", "榜", "状元", "青云", "折桂"],
    marriage: ["聘", "钗", "婚", "嫁", "莲"],
    oath: ["永", "情深", "比翼", "铭"],
    grief: ["愁", "拦", "苦", "险", "难"],
  };
  for (const th of THEME_ORDER) {
    if (KW[th].some((k) => h.includes(normChars(k)))) {
      scores[th] = Math.max(scores[th], 0.35);
    }
  }
  return scores;
}

function themeVerbZh(theme: ThemeId | undefined): string {
  switch (theme) {
    case "farewell":
      return "在送别";
    case "longing":
      return "在思念盼归";
    case "exam":
      return "在谈赴考前程";
    case "marriage":
      return "在说姻缘聘约";
    case "oath":
      return "在立誓定情";
    case "grief":
      return "在诉苦忧";
    default:
      return "在说";
  }
}

function themeVerbEn(theme: ThemeId | undefined): string {
  switch (theme) {
    case "farewell":
      return "parting";
    case "longing":
      return "longing";
    case "exam":
      return "the exam road";
    case "marriage":
      return "marriage bonds";
    case "oath":
      return "a vow";
    case "grief":
      return "grief";
    default:
      return "this moment";
  }
}

/** One vernacular line from scene + archive hit (local templates only). */
export function composeVernacular(args: {
  scene: SceneCard | null;
  topMatch: MatchHit | null;
  theme: ThemeId | undefined;
  gistBlock: { zh: string; en: string } | null;
}): { zh: string; en: string } {
  const { scene, topMatch, theme, gistBlock } = args;
  const line = topMatch?.entry.text ?? null;
  const title = topMatch?.entry.title ?? null;
  const verbZh = themeVerbZh(theme);
  const verbEn = themeVerbEn(theme);

  if (scene && line && title) {
    return {
      zh: `${scene.zh} 眼下角色${verbZh}：「${line}」。`,
      en: `${scene.en} Here the line speaks of ${verbEn}: “${line}”.`,
    };
  }
  if (scene && line) {
    return {
      zh: `${scene.zh} 贴近唱词：「${line}」。`,
      en: `${scene.en} Closest lyric: “${line}”.`,
    };
  }
  if (scene) {
    return { zh: scene.zh, en: scene.en };
  }
  if (line && title && gistBlock) {
    return {
      zh: `《${title}》里这句贴近：「${line}」。大意：${gistBlock.zh}`,
      en: `In ${title}, closest line: “${line}”. Sense: ${gistBlock.en}`,
    };
  }
  if (line && title) {
    return {
      zh: `《${title}》候选句：「${line}」。字还对不齐，可先看邻近剧情。`,
      en: `Candidate in ${title}: “${line}”. Lyrics may still be rough—check nearby plot.`,
    };
  }
  if (gistBlock) {
    return { zh: gistBlock.zh, en: gistBlock.en };
  }
  return {
    zh: "未能稳健对齐到档案唱词。可改识别框后重试，或到档案页打开对应剧目跟读。",
    en: "Could not confidently anchor to archive lyrics. Edit the transcript or open the Archive.",
  };
}

export function analyzeGist(hyp: string, index: LyricIndex, opts: AnalyzeOpts = {}): GistResult {
  const pieceId = opts.pieceId ?? null;
  const timeSec = opts.timeSec ?? null;
  const windowSec = opts.windowSec ?? 50;
  const timeAnchored = timeSec != null && !!pieceId;

  const matches = scoreHypAgainstIndex(
    hyp,
    index,
    5,
    pieceId,
    timeSec,
    windowSec,
    opts.pinyinMap,
  );
  const best = matches[0]?.score ?? 0;
  const degenerate = looksDegenerate(hyp);
  const themeScores = themeScoresFromMatches(matches, hyp);
  const topThemes = [...THEME_ORDER]
    .map((id) => ({ id, s: themeScores[id] }))
    .filter((x) => x.s > 0.05)
    .sort((a, b) => b.s - a.s)
    .slice(0, 3)
    .map((x) => x.id);

  let mode: GistResult["mode"] = "direct";
  if (degenerate || best < 0.18) mode = "gist";
  else if (best < 0.42) mode = "anchored";
  else mode = "direct";

  const sceneTime = matches[0]?.entry.start ?? timeSec;
  const scene = pickSceneCard(opts.sceneCards, pieceId || matches[0]?.entry.pieceId, sceneTime);
  const primaryTheme = topThemes[0];
  const gistBlock = primaryTheme ? index.gist[primaryTheme] : null;
  const topMatch = matches[0] ?? null;

  const composed = composeVernacular({
    scene,
    topMatch,
    theme: primaryTheme,
    gistBlock,
  });
  let gistZh = composed.zh;
  let gistEn = composed.en;

  if (timeAnchored) {
    gistZh = `〔播放头 ${timeSec!.toFixed(0)}s 附近〕` + gistZh;
    gistEn = `[Near playhead ${timeSec!.toFixed(0)}s] ` + gistEn;
  }

  return {
    mode,
    confidence: best,
    hyp,
    matches,
    themeScores,
    topThemes,
    gistZh,
    gistEn,
    archiveLine: topMatch?.entry.text ?? null,
    archiveTitle: topMatch?.entry.title ?? null,
    sceneZh: scene?.zh ?? null,
    sceneEn: scene?.en ?? null,
    timeAnchored,
  };
}

export { THEME_ORDER };
