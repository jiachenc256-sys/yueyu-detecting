import { getLocale, onLocaleChange, t, tf } from "./i18n.js";
import {
  analyzeGist,
  getPieceRadarAxes,
  loadLyricIndex,
  loadPinyinMap,
  loadPieceRadar,
  loadSceneCards,
  localizeThemeAxes,
  type GistResult,
} from "./speak-gist.js";
import {
  analyzeProsodyFromUrl,
  EMOTION_AXES,
  type ProsodyResult,
} from "./speak-prosody.js";
import {
  fingerprintFromAudioUrl,
  loadFingerprintIndex,
  matchFingerprint,
  type FpHit,
} from "./speak-fingerprint.js";

/**
 * Speak → recognize → translate (简体 / 繁體 / English).
 * Two post-ASR paths:
 *   ① Archive check — is this radio/clip already in the corpus?
 *   ② If not — prosody / 腔调·语调 emotion radar (no lyric claim).
 */

type TargetLang = "zh-Hans" | "zh-Hant" | "en";

type AsrPipeline = (
  input: string | Blob | Float32Array,
  options?: Record<string, unknown>,
) => Promise<{ text?: string } | Array<{ text?: string }>>;

const TRANSFORMERS_CDN =
  "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2";

const LOCAL_MODEL_ID = "yueyu-whisper-small-onnx";
/** Bigram Jaccard vs archive — above this ⇒ treat as archive hit. */
/** Minimum text/FP confidence to treat as a confident archive hit (not a shaky guess). */
const ARCHIVE_HIT_MIN = 0.28;
/** Show near-miss candidates only above this floor (still labeled as weak). */
const ARCHIVE_NEAR_MIN = 0.08;

const recordBtn = document.getElementById("speak-record") as HTMLButtonElement | null;
const clearBtn = document.getElementById("speak-clear") as HTMLButtonElement | null;
const fileInput = document.getElementById("speak-file") as HTMLInputElement | null;
const audioPreview = document.getElementById("speak-audio-preview") as HTMLAudioElement | null;
const statusEl = document.getElementById("speak-status");
const recognizedEl = document.getElementById("speak-recognized") as HTMLTextAreaElement | null;
const zhHansEl = document.getElementById("speak-zh-hans");
const zhHantEl = document.getElementById("speak-zh-hant");
const enEl = document.getElementById("speak-en");
const langSelect = document.getElementById("speak-input-lang") as HTMLSelectElement | null;

const pathRoot = document.getElementById("speak-path");
const archiveBadge = document.getElementById("speak-archive-badge");
const archiveText = document.getElementById("speak-archive-text");
const archiveMatches = document.getElementById("speak-archive-matches");
const archiveRadar = document.getElementById("speak-archive-radar");
const archiveRadarCaption = document.getElementById("speak-archive-radar-caption");
const archiveMeter = document.getElementById("speak-archive-meter");
const archiveMeterLabel = document.getElementById("speak-archive-meter-label");
const archiveOpen = document.getElementById("speak-archive-open") as HTMLAnchorElement | null;
const gistUseBtn = document.getElementById("speak-gist-use") as HTMLButtonElement | null;
const pieceSelect = document.getElementById("speak-piece") as HTMLSelectElement | null;
const followTimeEl = document.getElementById("speak-follow-time") as HTMLInputElement | null;
const followClock = document.getElementById("speak-follow-clock");
const sceneCardEl = document.getElementById("speak-scene-card");
const fpNoteEl = document.getElementById("speak-fp-note");
const prosodyCard = document.getElementById("speak-prosody-card");
const prosodyText = document.getElementById("speak-prosody-text");
const prosodyMetrics = document.getElementById("speak-prosody-metrics");
const prosodyRadar = document.getElementById("speak-prosody-radar");
const prosodyRadarCaption = document.getElementById("speak-prosody-radar-caption");
const prosodyMeter = document.getElementById("speak-prosody-meter");
const prosodyMeterLabel = document.getElementById("speak-prosody-meter-label");

let listening = false;
let finalTranscript = "";
let translateTimer: number | null = null;
let whisperPipeline: AsrPipeline | null = null;
let whisperLoading: Promise<AsrPipeline> | null = null;
/** Prevent double-start when Try sample is clicked while ASR is already running. */
let asrBusy = false;
let modelPrep: Promise<void> | null = null;
let previewObjectUrl: string | null = null;
let lastGist: GistResult | null = null;
let lastProsody: ProsodyResult | null = null;

let mediaStream: MediaStream | null = null;
let mediaRecorder: MediaRecorder | null = null;
let recordedChunks: BlobPart[] = [];

function setStatus(text: string): void {
  if (statusEl) statusEl.textContent = text;
}

/** Absolute URL to assets/asr/<model>/ on this site. */
function modelBaseHref(): string {
  const path = window.location.pathname;
  const dir = path.endsWith("/") ? path : path.replace(/[^/]+$/, "");
  return new URL(`assets/asr/${LOCAL_MODEL_ID}/`, `${window.location.origin}${dir}`).href;
}

async function translateWithMyMemory(text: string, from: string, to: string): Promise<string> {
  const url = new URL("https://api.mymemory.translated.net/get");
  url.searchParams.set("q", text.slice(0, 450));
  url.searchParams.set("langpair", `${from}|${to}`);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Translation HTTP ${res.status}`);
  const data = (await res.json()) as {
    responseData?: { translatedText?: string };
  };
  const out = data.responseData?.translatedText?.trim();
  if (!out) throw new Error("Empty translation");
  if (/MYMEMORY WARNING/i.test(out)) throw new Error("Translation quota exceeded — try again later");
  return out;
}

function looksLatin(text: string): boolean {
  const letters = text.replace(/\s/g, "");
  if (!letters) return false;
  const latin = (letters.match(/[A-Za-z]/g) ?? []).length;
  return latin / letters.length > 0.5;
}

async function fillTranslations(source: string): Promise<void> {
  const text = source.trim();
  if (!text) {
    if (zhHansEl) zhHansEl.textContent = "—";
    if (zhHantEl) zhHantEl.textContent = "—";
    if (enEl) enEl.textContent = "—";
    return;
  }

  setStatus(t("speak.status.translating"));
  if (zhHansEl) zhHansEl.textContent = "…";
  if (zhHantEl) zhHantEl.textContent = "…";
  if (enEl) enEl.textContent = "…";

  try {
    const latin = looksLatin(text);
    let zhHans: string;
    let zhHant: string;
    let en: string;

    if (latin) {
      zhHans = await translateWithMyMemory(text, "en", "zh-CN");
      try {
        zhHant = await translateWithMyMemory(zhHans, "zh-CN", "zh-TW");
      } catch {
        zhHant = zhHans;
      }
      en = text;
    } else {
      zhHans = text;
      try {
        zhHant = await translateWithMyMemory(text, "zh-CN", "zh-TW");
      } catch {
        zhHant = text;
      }
      en = await translateWithMyMemory(text, "zh-CN", "en");
    }

    if (zhHansEl) zhHansEl.textContent = zhHans;
    if (zhHantEl) zhHantEl.textContent = zhHant;
    if (enEl) enEl.textContent = en;
    setStatus(t("speak.status.done"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus(tf("speak.status.translateFail", { msg: message }));
    if (zhHansEl) zhHansEl.textContent = text;
    if (zhHantEl) zhHantEl.textContent = text;
    if (enEl) enEl.textContent = "(English translation unavailable)";
  }
}

function scheduleTranslate(text: string): void {
  if (translateTimer !== null) window.clearTimeout(translateTimer);
  translateTimer = window.setTimeout(() => {
    void fillTranslations(text);
  }, 1500);
}

function syncRecognizedBox(): void {
  if (recognizedEl) recognizedEl.value = finalTranscript.trim();
}

function setMeter(
  fill: HTMLElement | null,
  label: HTMLElement | null,
  value01: number,
  text: string,
): void {
  const pct = Math.round(Math.max(0, Math.min(1, value01)) * 100);
  if (fill) fill.style.width = `${pct}%`;
  if (label) label.textContent = text;
}

function audioUrlForAnalysis(): string | null {
  if (previewObjectUrl) return previewObjectUrl;
  const src = audioPreview?.currentSrc || audioPreview?.src || "";
  return src.trim() ? src : null;
}

function selectedPieceId(): string | null {
  const v = pieceSelect?.value?.trim();
  return v || null;
}

function followTimeSec(): number | null {
  if (!followTimeEl?.checked) return null;
  if (!audioPreview || !Number.isFinite(audioPreview.currentTime)) return null;
  // Need a piece scope for time anchoring to be meaningful
  if (!selectedPieceId()) return null;
  // No media yet → do not pretend the playhead is at 0s
  const hasMedia = Boolean(previewObjectUrl) || Boolean(audioPreview.currentSrc || audioPreview.src);
  if (!hasMedia) return null;
  return audioPreview.currentTime;
}

function updateFollowClock(): void {
  if (!followClock) return;
  if (!audioPreview || audioPreview.hidden || !Number.isFinite(audioPreview.currentTime)) {
    followClock.textContent = "—";
    return;
  }
  const tsec = audioPreview.currentTime;
  const m = Math.floor(tsec / 60);
  const s = Math.floor(tsec % 60);
  followClock.textContent = `${m}:${String(s).padStart(2, "0")}`;
}

/** Piece HTML pages that exist under pieces/ (Speak “open archive”). */
const PIECE_PAGE_ALIASES: Record<string, string> = {
  "liangzhu-shibaxiangsong-full": "liangzhu-shibaxiangsong",
};

const PIECE_PAGES = new Set([
  "baitu-ji",
  "biyu-zan-xinfang",
  "bubuxinjing-1",
  "bubuxinjing-2",
  "bubuxinjing-3",
  "bubuxinjing-4a",
  "bubuxinjing-4b5a",
  "chai-tou-feng",
  "chen-sanliang",
  "he-wenxiu-suanming",
  "hongloumeng-1",
  "hongloumeng-2",
  "hongloumeng-3",
  "hongloumeng-4",
  "hongloumeng-5",
  "hongloumeng-tianxia",
  "jingchai-ji",
  "liangzhu-shibaxiangsong",
  "liangzhu-xia",
  "limaohuan-taizi",
  "longmen-kezhai",
  "mudanting-huanhunji",
  "para-2",
  "para-3",
  "pearl-tower-gift",
  "wunv-baishou-1",
  "wunv-baishou-2",
  "wunv-baishou-3",
  "wunv-baishou-4",
  "wunv-baishou-huashu",
  "xianglin-sao-xinsuanhua",
  "xixiangji-kaohong",
  "zanghua-yin",
  "zhuiyu-guandeng",
]);

function resolvePiecePageId(pieceId: string): string | null {
  const id = PIECE_PAGE_ALIASES[pieceId] ?? pieceId;
  return PIECE_PAGES.has(id) ? id : null;
}

function cueHref(pieceId: string, entryId: string): string | null {
  const pageId = resolvePiecePageId(pieceId);
  if (!pageId) return null;
  const prefix = `${pieceId}-`;
  const altPrefix = `${pageId}-`;
  let cue = entryId;
  if (entryId.startsWith(prefix)) cue = entryId.slice(prefix.length);
  else if (entryId.startsWith(altPrefix)) cue = entryId.slice(altPrefix.length);
  return `pieces/${encodeURIComponent(pageId)}.html#cue-${encodeURIComponent(cue)}`;
}

function populatePieceSelect(index: Awaited<ReturnType<typeof loadLyricIndex>>): void {
  if (!pieceSelect || !index) return;
  const prev = pieceSelect.value;
  const byPiece = new Map<string, string>();
  for (const e of index.entries) {
    if (!byPiece.has(e.pieceId)) byPiece.set(e.pieceId, e.title);
  }
  const preferred = ["jingchai-ji", "baitu-ji", "liangzhu", "xianglin-sao-xinsuanhua"];
  const ids = [...byPiece.keys()].sort((a, b) => {
    const pa = preferred.indexOf(a);
    const pb = preferred.indexOf(b);
    if (pa >= 0 || pb >= 0) return (pa < 0 ? 999 : pa) - (pb < 0 ? 999 : pb);
    return (byPiece.get(a) || a).localeCompare(byPiece.get(b) || b, "zh");
  });
  // Keep first "any" option
  while (pieceSelect.options.length > 1) pieceSelect.remove(1);
  for (const id of ids) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = byPiece.get(id) || id;
    pieceSelect.appendChild(opt);
  }
  if (Array.from(pieceSelect.options).some((o) => o.value === prev)) pieceSelect.value = prev;
}

function preferEnUi(): boolean {
  return getLocale() === "en";
}

function emotionLabelsForUi(): Array<{ id: string; label: string }> {
  const en = preferEnUi();
  return EMOTION_AXES.map((a) => ({ id: a.id, label: en ? a.labelEn : a.labelZh }));
}

function emotionName(id: string): string {
  const axis = EMOTION_AXES.find((a) => a.id === id);
  if (!axis) return id;
  return preferEnUi() ? axis.labelEn : axis.labelZh;
}

function hidePathPanels(): void {
  lastGist = null;
  lastProsody = null;
  if (pathRoot) pathRoot.hidden = true;
  if (prosodyCard) prosodyCard.hidden = true;
  if (gistUseBtn) gistUseBtn.hidden = true;
  if (archiveOpen) {
    archiveOpen.hidden = true;
    archiveOpen.removeAttribute("href");
  }
  setMeter(archiveMeter, archiveMeterLabel, 0, "—");
  setMeter(prosodyMeter, prosodyMeterLabel, 0, "—");
  if (prosodyMetrics) {
    prosodyMetrics.hidden = true;
    prosodyMetrics.textContent = "";
  }
}

function renderThemeRadar(
  svg: HTMLElement | null,
  caption: HTMLElement | null,
  scores: Record<string, number>,
  labels: Array<{ id: string; label: string }>,
  focusText: string,
  emptyText: string,
): void {
  if (!svg) return;
  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const r = 58;
  const n = labels.length || 1;
  const ring = (rr: number) => {
    const pts: string[] = [];
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      pts.push(`${(cx + rr * Math.cos(ang)).toFixed(1)},${(cy + rr * Math.sin(ang)).toFixed(1)}`);
    }
    return pts.join(" ");
  };
  const valuePts: string[] = [];
  const labelsSvg: string[] = [];
  labels.forEach((lab, i) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const v = Math.max(0, Math.min(1, scores[lab.id] ?? 0));
    const rr = r * (0.12 + 0.88 * v);
    valuePts.push(`${(cx + rr * Math.cos(ang)).toFixed(1)},${(cy + rr * Math.sin(ang)).toFixed(1)}`);
    const lx = cx + (r + 22) * Math.cos(ang);
    const ly = cy + (r + 22) * Math.sin(ang);
    labelsSvg.push(
      `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="9" fill="currentColor">${lab.label}</text>`,
    );
  });
  svg.innerHTML = `
    <polygon points="${ring(r)}" fill="none" stroke="rgba(0,0,0,.12)" stroke-width="1"/>
    <polygon points="${ring(r * 0.66)}" fill="none" stroke="rgba(0,0,0,.08)" stroke-width="1"/>
    <polygon points="${ring(r * 0.33)}" fill="none" stroke="rgba(0,0,0,.06)" stroke-width="1"/>
    ${labels
      .map((_, i) => {
        const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        return `<line x1="${cx}" y1="${cy}" x2="${(cx + r * Math.cos(ang)).toFixed(1)}" y2="${(cy + r * Math.sin(ang)).toFixed(1)}" stroke="rgba(0,0,0,.1)" stroke-width="1"/>`;
      })
      .join("")}
    <polygon points="${valuePts.join(" ")}" fill="rgba(44,95,74,.28)" stroke="#2c5f4a" stroke-width="2"/>
    ${labelsSvg.join("")}
  `;
  if (caption) caption.textContent = focusText || emptyText;
}

function archiveHit(result: GistResult, fpBest: number): boolean {
  if (fpBest >= 0.88) return true;
  // Require score — do not promote weak “anchored/direct” mode alone as a confident hit.
  return result.confidence >= ARCHIVE_HIT_MIN;
}

async function runPostAsrPaths(hyp: string): Promise<GistResult | null> {
  const [index, scenes, fpIndex, pinyinMap] = await Promise.all([
    loadLyricIndex(),
    loadSceneCards(),
    loadFingerprintIndex(),
    loadPinyinMap(),
    loadPieceRadar(),
  ]);
  if (!hyp.trim()) {
    hidePathPanels();
    return null;
  }

  if (pathRoot) pathRoot.hidden = false;
  if (prosodyCard) prosodyCard.hidden = true;
  if (sceneCardEl) {
    sceneCardEl.hidden = true;
    sceneCardEl.textContent = "";
  }
  if (fpNoteEl) {
    fpNoteEl.hidden = true;
    fpNoteEl.textContent = "";
  }

  const pieceId = selectedPieceId();
  const timeSec = followTimeSec();

  let result: GistResult | null = null;
  if (index) {
    result = analyzeGist(hyp, index, {
      pieceId,
      timeSec,
      sceneCards: scenes,
      pinyinMap,
    });
    lastGist = result;
  }

  // Audio fingerprint (independent of ASR text quality)
  let fpHits: FpHit[] = [];
  const audioUrl = audioUrlForAnalysis();
  if (audioUrl && fpIndex) {
    const q = await fingerprintFromAudioUrl(audioUrl);
    if (q) fpHits = matchFingerprint(q, fpIndex, pieceId, 3);
  }
  const fpBest = fpHits[0]?.score ?? 0;

  // If fingerprint finds a strong clip but text match is weak, promote archive line from FP cue
  if (result && fpHits[0] && fpBest >= 0.88 && result.confidence < 0.35) {
    const hit = fpHits[0].item;
    const entry = index?.entries.find((e) => e.id === hit.id || e.id === `${hit.pieceId}-${hit.cueId}`);
    if (entry) {
      result = {
        ...result,
        mode: "anchored",
        confidence: Math.max(result.confidence, fpBest * 0.95),
        archiveLine: entry.text,
        archiveTitle: entry.title,
        matches: [{ entry, score: fpBest }, ...result.matches].slice(0, 5),
        gistZh: `声纹接近档案切片「${entry.text}」（《${entry.title}》）。${result.sceneZh ? `场景：${result.sceneZh}` : ""}`,
        gistEn: `Audio fingerprint close to archive clip “${entry.text}” (${entry.title}).${result.sceneEn ? ` Scene: ${result.sceneEn}` : ""}`,
      };
      lastGist = result;
    }
  }

  const hit = result ? archiveHit(result, fpBest) : fpBest >= 0.88;
  const conf = Math.max(result?.confidence ?? 0, fpBest >= 0.88 ? fpBest : 0);
  setMeter(
    archiveMeter,
    archiveMeterLabel,
    conf,
    tf("speak.path.archiveConf", { pct: String(Math.round(conf * 100)) }),
  );

  if (archiveBadge) {
    archiveBadge.classList.remove("speak-gist__badge--gist", "speak-gist__badge--anchored");
    if (hit) {
      archiveBadge.textContent = t("speak.path.badgeHit");
      archiveBadge.classList.add("speak-gist__badge--anchored");
    } else {
      archiveBadge.textContent = t("speak.path.badgeMiss");
      archiveBadge.classList.add("speak-gist__badge--gist");
    }
  }

  if (archiveText) {
    if (!result) {
      archiveText.textContent = t("speak.path.archiveUnavailable");
    } else if (hit) {
      archiveText.textContent = preferEnUi() ? result.gistEn : result.gistZh;
    } else if ((result.confidence ?? 0) >= ARCHIVE_NEAR_MIN || fpBest >= 0.72) {
      archiveText.textContent = t("speak.path.weakBody");
    } else {
      archiveText.textContent = t("speak.path.missBody");
    }
  }

  if (sceneCardEl) {
    const sceneLine = preferEnUi() ? result?.sceneEn : result?.sceneZh;
    if (sceneLine && (hit || (pieceId && timeSec != null))) {
      sceneCardEl.hidden = false;
      sceneCardEl.textContent = sceneLine;
    } else {
      sceneCardEl.hidden = true;
      sceneCardEl.textContent = "";
    }
  }

  if (fpNoteEl) {
    if (fpHits[0]) {
      fpNoteEl.hidden = false;
      const best = fpHits[0];
      fpNoteEl.textContent = tf("speak.path.fpNote", {
        pct: String(Math.round(best.score * 100)),
        id: best.item.id,
      });
    } else {
      fpNoteEl.hidden = true;
      fpNoteEl.textContent = "";
    }
  }

  if (archiveMatches) {
    const showWeak =
      !hit && result && ((result.confidence ?? 0) >= ARCHIVE_NEAR_MIN || fpBest >= 0.72);
    archiveMatches.innerHTML =
      hit && result
        ? result.matches
            .slice(0, 3)
            .map(
              (m) =>
                `<li><strong>《${m.entry.title}》</strong> ${m.entry.text} <span style="opacity:.65">(${(m.score * 100).toFixed(0)}%)</span></li>`,
            )
            .join("")
        : showWeak && result
          ? `<li class="speak-match-weak-label">${t("speak.path.weakLabel")}</li>` +
            result.matches
              .slice(0, 2)
              .map(
                (m) =>
                  `<li class="speak-match-weak"><strong>《${m.entry.title}》</strong> ${m.entry.text} <span style="opacity:.65">(${(m.score * 100).toFixed(0)}%)</span></li>`,
              )
              .join("")
          : "";
  }

  if (result && index) {
    const radarAxes = localizeThemeAxes(getPieceRadarAxes(pieceId, index.themes), preferEnUi());
    const top = result.topThemes
      .map((id) => radarAxes.find((x) => x.id === id)?.label ?? index.themes.find((x) => x.id === id)?.label)
      .filter(Boolean)
      .join(" · ");
    renderThemeRadar(
      archiveRadar,
      archiveRadarCaption,
      result.themeScores,
      radarAxes,
      hit && top ? tf("speak.gist.radarFocus", { themes: top }) : t("speak.path.radarIdle"),
      t("speak.gist.radarEmpty"),
    );
  }

  if (gistUseBtn) {
    gistUseBtn.hidden = !(hit && result?.archiveLine);
  }
  if (archiveOpen) {
    const top = result?.matches[0]?.entry;
    const href = hit && top ? cueHref(top.pieceId, top.id) : null;
    if (href) {
      archiveOpen.hidden = false;
      archiveOpen.href = href;
      archiveOpen.target = "_blank";
      archiveOpen.rel = "noopener";
    } else {
      archiveOpen.hidden = true;
      archiveOpen.removeAttribute("href");
    }
  }

  // Part ② — delivery / emotion (always show panel; radar needs audio)
  const mediaUrl = audioUrlForAnalysis();
  if (mediaUrl) {
    if (!hit) setStatus(t("speak.path.prosodyRunning"));
    const prosody = await analyzeProsodyFromUrl(mediaUrl, pieceId);
    lastProsody = prosody;
    if (prosody && prosodyCard) {
      prosodyCard.hidden = false;
      const en = preferEnUi();
      let summary = en ? prosody.summaryEn : prosody.summaryZh;
      if (hit) {
        summary = en
          ? summary.replace(/^Not in archive\.\s*/i, "Archive candidate ready; from delivery, ")
          : summary.replace(/^档案未命中。/, "档案已有候选句；同时从腔调看，");
      }
      if (prosodyText) prosodyText.textContent = summary;
      if (prosodyMetrics) {
        prosodyMetrics.hidden = false;
        prosodyMetrics.textContent = en ? prosody.metricsEn : prosody.metricsZh;
      }
      const topScore = Math.max(...Object.values(prosody.scores), 0);
      setMeter(
        prosodyMeter,
        prosodyMeterLabel,
        topScore,
        tf("speak.path.emotionConf", { pct: String(Math.round(topScore * 100)) }),
      );
      const labels = emotionLabelsForUi();
      const focus = prosody.top.map(emotionName).filter(Boolean).join(" · ");
      renderThemeRadar(
        prosodyRadar,
        prosodyRadarCaption,
        prosody.scores,
        labels,
        focus ? tf("speak.path.emotionFocus", { themes: focus }) : t("speak.path.emotionEmpty"),
        t("speak.path.emotionEmpty"),
      );
      if (!hit) {
        // Don't force-translate Chinese prosody into EN when UI is already EN.
        if (!en) scheduleTranslate(summary);
        return result;
      }
    }
  } else {
    if (prosodyCard) {
      prosodyCard.hidden = false;
      if (prosodyText) {
        prosodyText.textContent = hit
          ? t("speak.path.prosodyOptionalAudio")
          : t("speak.path.prosodyNeedAudio");
      }
      if (prosodyMetrics) {
        prosodyMetrics.hidden = true;
        prosodyMetrics.textContent = "";
      }
    }
    setMeter(prosodyMeter, prosodyMeterLabel, 0, "—");
    if (prosodyRadar) prosodyRadar.innerHTML = "";
  }

  if (hit && result?.archiveLine && result.mode !== "direct") {
    scheduleTranslate(result.archiveLine);
  } else if (hit && result?.mode === "direct") {
    scheduleTranslate(hyp);
  } else {
    scheduleTranslate(hyp);
  }
  return result;
}

function applyRecognizedText(text: string, translateSoon = true): void {
  finalTranscript = text.trim();
  syncRecognizedBox();
  if (translateSoon && finalTranscript) {
    void runPostAsrPaths(finalTranscript);
  } else {
    hidePathPanels();
  }
}

interface SpeakManifest {
  decoderParts: string[];
}

async function joinDecoderIntoCache(base: string): Promise<void> {
  const manifestRes = await fetch(new URL("speak-manifest.json", base));
  if (!manifestRes.ok) throw new Error(`speak-manifest HTTP ${manifestRes.status}`);
  const manifest = (await manifestRes.json()) as SpeakManifest;
  const cache = await caches.open("transformers-cache");
  const decoderNames = ["decoder_model_quantized.onnx", "decoder_model.onnx"];
  const primary = new URL(`onnx/${decoderNames[0]}`, base).href;
  if (await cache.match(primary)) return;

  setStatus(t("speak.status.modelJoin"));
  const buffers: ArrayBuffer[] = [];
  for (const part of manifest.decoderParts) {
    const res = await fetch(new URL(`onnx/${part}`, base));
    if (!res.ok) throw new Error(`Missing decoder part ${part}`);
    buffers.push(await res.arrayBuffer());
  }
  const blob = new Blob(buffers, { type: "application/octet-stream" });
  for (const name of decoderNames) {
    const url = new URL(`onnx/${name}`, base).href;
    await cache.put(
      url,
      new Response(blob.slice(), {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Length": String(blob.size),
        },
      }),
    );
  }
}

async function prepareLocalModel(): Promise<void> {
  if (!modelPrep) {
    modelPrep = (async () => {
      setStatus(t("speak.status.modelPrep"));
      await joinDecoderIntoCache(modelBaseHref());
    })().catch((err) => {
      modelPrep = null;
      throw err;
    });
  }
  await modelPrep;
}

async function ensureWhisper(): Promise<AsrPipeline> {
  if (whisperPipeline) return whisperPipeline;
  if (whisperLoading) return whisperLoading;

  whisperLoading = (async () => {
    await prepareLocalModel();
    setStatus(t("speak.status.whisperLoad"));
    const mod = (await import(/* @vite-ignore */ TRANSFORMERS_CDN)) as {
      pipeline: (
        task: string,
        model: string,
        options?: {
          quantized?: boolean;
          progress_callback?: (data: { status?: string; progress?: number }) => void;
        },
      ) => Promise<AsrPipeline>;
      env: {
        allowLocalModels: boolean;
        allowRemoteModels: boolean;
        useBrowserCache: boolean;
        localModelPath: string;
      };
    };

    const base = modelBaseHref();
    mod.env.allowLocalModels = true;
    mod.env.allowRemoteModels = false;
    mod.env.useBrowserCache = true;
    // localModelPath + modelId → .../assets/asr/yueyu-whisper-small-onnx/
    mod.env.localModelPath = new URL("../", base).href;

    const asr = await mod.pipeline("automatic-speech-recognition", LOCAL_MODEL_ID, {
      quantized: true,
      progress_callback: (data) => {
        if (data.status === "progress" && typeof data.progress === "number") {
          setStatus(tf("speak.status.whisperProgress", { pct: Math.round(data.progress) }));
        }
      },
    });

    whisperPipeline = asr;
    setStatus(t("speak.status.whisperReady"));
    return asr;
  })();

  try {
    return await whisperLoading;
  } catch (localError) {
    whisperLoading = null;
    // Fallback if local ONNX assets are missing (e.g. not yet deployed).
    setStatus(t("speak.status.whisperFallback"));
    whisperLoading = (async () => {
      const mod = (await import(/* @vite-ignore */ TRANSFORMERS_CDN)) as {
        pipeline: (
          task: string,
          model: string,
          options?: {
            progress_callback?: (data: { status?: string; progress?: number }) => void;
          },
        ) => Promise<AsrPipeline>;
        env: {
          allowLocalModels: boolean;
          allowRemoteModels: boolean;
          useBrowserCache: boolean;
        };
      };
      mod.env.allowLocalModels = false;
      mod.env.allowRemoteModels = true;
      mod.env.useBrowserCache = true;
      const asr = await mod.pipeline("automatic-speech-recognition", "Xenova/whisper-tiny", {
        progress_callback: (data) => {
          if (data.status === "progress" && typeof data.progress === "number") {
            setStatus(tf("speak.status.whisperProgress", { pct: Math.round(data.progress) }));
          }
        },
      });
      whisperPipeline = asr;
      setStatus(t("speak.status.whisperReadyFallback"));
      return asr;
    })();
    try {
      return await whisperLoading;
    } catch (error) {
      whisperLoading = null;
      throw localError instanceof Error ? localError : error;
    }
  }
}

function whisperLanguageHint(): string | undefined {
  const lang = langSelect?.value || "zh-CN";
  if (lang.startsWith("en")) return "english";
  if (lang.startsWith("zh")) return "chinese";
  return undefined;
}

async function recognizeBlob(blob: Blob, label: string): Promise<void> {
  if (asrBusy) {
    setStatus(t("speak.status.busy"));
    return;
  }
  asrBusy = true;
  setSampleButtonsDisabled(true);
  try {
    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = null;
    }
    previewObjectUrl = URL.createObjectURL(blob);
    if (audioPreview) {
      audioPreview.src = previewObjectUrl;
      audioPreview.hidden = false;
    }

    setStatus(tf("speak.status.recognizing", { name: label }));
    if (recognizedEl) recognizedEl.value = "";
    if (zhHansEl) zhHansEl.textContent = "…";
    if (zhHantEl) zhHantEl.textContent = "…";
    if (enEl) enEl.textContent = "…";

    try {
      const asr = await ensureWhisper();
      const language = whisperLanguageHint();
      const result = await asr(previewObjectUrl, {
        chunk_length_s: 30,
        stride_length_s: 5,
        ...(language ? { language, task: "transcribe" } : {}),
      });

      const text = Array.isArray(result)
        ? result.map((r) => r.text ?? "").join(" ").trim()
        : (result.text ?? "").trim();

      if (!text) {
        applyRecognizedText("", false);
        setStatus(t("speak.status.noSpeech"));
        return;
      }

      applyRecognizedText(text, true);
      setStatus(t("speak.status.recogDone"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(tf("speak.status.uploadFail", { msg: message }));
    }
  } finally {
    asrBusy = false;
    setSampleButtonsDisabled(false);
  }
}

function setSampleButtonsDisabled(disabled: boolean): void {
  document.querySelectorAll<HTMLButtonElement>("[data-speak-sample]").forEach((btn) => {
    btn.disabled = disabled;
  });
}

async function recognizeUploadedFile(file: File): Promise<void> {
  if (listening) stopListening(false);
  await recognizeBlob(file, file.name);
}

function pickRecorderMime(): string | undefined {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return undefined;
}

async function startListening(): Promise<void> {
  if (listening) return;
  if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    setStatus(t("speak.status.noMic"));
    return;
  }

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    setStatus(t("speak.status.micDenied"));
    return;
  }

  recordedChunks = [];
  const mime = pickRecorderMime();
  mediaRecorder = mime
    ? new MediaRecorder(mediaStream, { mimeType: mime })
    : new MediaRecorder(mediaStream);

  mediaRecorder.ondataavailable = (ev) => {
    if (ev.data.size > 0) recordedChunks.push(ev.data);
  };

  mediaRecorder.onerror = () => {
    setStatus(tf("speak.status.recogError", { msg: "MediaRecorder" }));
  };

  mediaRecorder.onstop = () => {
    listening = false;
    recordBtn?.setAttribute("aria-pressed", "false");
    if (recordBtn) recordBtn.textContent = t("speak.start");
    mediaStream?.getTracks().forEach((tr) => tr.stop());
    mediaStream = null;

    const type = mediaRecorder?.mimeType || "audio/webm";
    mediaRecorder = null;
    if (!recordedChunks.length) {
      setStatus(t("speak.status.noCapture"));
      return;
    }
    const blob = new Blob(recordedChunks, { type });
    recordedChunks = [];
    void recognizeBlob(blob, t("speak.recordingLabel"));
  };

  mediaRecorder.start(250);
  listening = true;
  recordBtn?.setAttribute("aria-pressed", "true");
  if (recordBtn) recordBtn.textContent = t("speak.stop");
  setStatus(t("speak.status.listening"));
}

function stopListening(runRecognition = true): void {
  if (!mediaRecorder || mediaRecorder.state === "inactive") {
    listening = false;
    mediaStream?.getTracks().forEach((tr) => tr.stop());
    mediaStream = null;
    return;
  }
  if (!runRecognition) {
    mediaRecorder.onstop = null;
    mediaRecorder.stop();
    mediaStream?.getTracks().forEach((tr) => tr.stop());
    mediaStream = null;
    mediaRecorder = null;
    listening = false;
    recordedChunks = [];
    recordBtn?.setAttribute("aria-pressed", "false");
    if (recordBtn) recordBtn.textContent = t("speak.start");
    return;
  }
  mediaRecorder.stop();
}

function clearAll(): void {
  if (listening) stopListening(false);
  finalTranscript = "";
  if (recognizedEl) recognizedEl.value = "";
  if (zhHansEl) zhHansEl.textContent = "—";
  if (zhHantEl) zhHantEl.textContent = "—";
  if (enEl) enEl.textContent = "—";
  if (fileInput) fileInput.value = "";
  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
  }
  if (audioPreview) {
    audioPreview.removeAttribute("src");
    audioPreview.hidden = true;
  }
  hidePathPanels();
  setStatus(t("speak.status.cleared"));
}

function initSpeakOutputTabs(): void {
  const tabs = document.querySelectorAll<HTMLButtonElement>("[data-speak-output-tab]");
  const panels = document.querySelectorAll<HTMLElement>("[data-speak-output]");
  if (!tabs.length || !panels.length) return;

  function activate(lang: string): void {
    tabs.forEach((tab) => {
      const on = tab.dataset.speakOutputTab === lang;
      tab.setAttribute("aria-selected", on ? "true" : "false");
      tab.classList.toggle("speak-output-tab--active", on);
    });
    panels.forEach((panel) => {
      const on = panel.dataset.speakOutput === lang;
      panel.classList.toggle("speak-output--active", on);
      panel.hidden = !on && window.matchMedia("(max-width: 900px)").matches;
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => activate(tab.dataset.speakOutputTab ?? "zh-Hans"));
  });

  const mq = window.matchMedia("(max-width: 900px)");
  const syncMode = (): void => {
    const tablist = document.querySelector<HTMLElement>(".speak-output-tabs");
    if (tablist) tablist.hidden = !mq.matches;
    if (mq.matches) {
      const current =
        document.querySelector<HTMLButtonElement>(".speak-output-tab[aria-selected='true']")
          ?.dataset.speakOutputTab ?? "zh-Hans";
      activate(current);
    } else {
      panels.forEach((panel) => {
        panel.hidden = false;
        panel.classList.add("speak-output--active");
      });
    }
  };
  mq.addEventListener("change", syncMode);
  syncMode();
}

async function runSample(url: string, label: string): Promise<void> {
  // Resolve relative sample paths against the page URL (not the module URL).
  const abs = new URL(url, window.location.href).href;
  setStatus(tf("speak.status.sampleLoading", { name: label }));
  try {
    const res = await fetch(abs);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const name = url.split("/").pop() ?? "sample.m4a";
    const file = new File([blob], name, { type: blob.type || "audio/mp4" });
    await recognizeUploadedFile(file);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus(tf("speak.status.sampleFail", { msg: message }));
  }
}

function initSpeak(): void {
  if (!recognizedEl) return;

  if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    setStatus(t("speak.status.noMic"));
    if (recordBtn) recordBtn.disabled = true;
  } else {
    setStatus(t("speak.status.ready"));
  }

  recordBtn?.addEventListener("click", () => {
    if (listening) stopListening(true);
    else void startListening();
  });

  clearBtn?.addEventListener("click", clearAll);

  fileInput?.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    void recognizeUploadedFile(file);
  });

  document.querySelectorAll<HTMLButtonElement>("[data-speak-sample]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const url = btn.dataset.speakSample;
      if (!url) return;
      const piece = btn.dataset.speakPiece;
      if (piece && pieceSelect) {
        // Prefer scoping archive check to the demo piece for a clearer ① hit.
        const opt = Array.from(pieceSelect.options).find((o) => o.value === piece);
        if (opt) pieceSelect.value = piece;
      }
      if (followTimeEl) followTimeEl.checked = false;
      const label = btn.textContent?.trim() || url;
      void runSample(url, label);
    });
  });

  recognizedEl.addEventListener("input", () => {
    finalTranscript = recognizedEl.value;
    void runPostAsrPaths(finalTranscript);
  });

  gistUseBtn?.addEventListener("click", () => {
    if (!lastGist?.archiveLine) return;
    applyRecognizedText(lastGist.archiveLine, true);
    setStatus(t("speak.gist.applied"));
  });

  void loadLyricIndex().then((index) => {
    populatePieceSelect(index);
  });
  void loadSceneCards();
  void loadFingerprintIndex();

  pieceSelect?.addEventListener("change", () => {
    // Only suggest follow-along when audio is already loaded
    if (selectedPieceId() && followTimeEl && !followTimeEl.checked && previewObjectUrl) {
      followTimeEl.checked = true;
    }
    if (finalTranscript.trim()) void runPostAsrPaths(finalTranscript);
  });

  followTimeEl?.addEventListener("change", () => {
    if (finalTranscript.trim()) void runPostAsrPaths(finalTranscript);
  });

  audioPreview?.addEventListener("timeupdate", () => {
    updateFollowClock();
  });
  audioPreview?.addEventListener("seeked", () => {
    updateFollowClock();
    if (followTimeEl?.checked && finalTranscript.trim()) void runPostAsrPaths(finalTranscript);
  });

  document.querySelectorAll<HTMLButtonElement>("[data-translate-target]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.translateTarget as TargetLang | undefined;
      const map: Record<TargetLang, HTMLElement | null> = {
        "zh-Hans": zhHansEl,
        "zh-Hant": zhHantEl,
        en: enEl,
      };
      document.querySelectorAll(".speak-output").forEach((el) => {
        el.classList.remove("speak-output--focus");
      });
      if (target && map[target]) {
        map[target]?.closest(".speak-output")?.classList.add("speak-output--focus");
      }
    });
  });

  initSpeakOutputTabs();
}

function syncSpeakChrome(): void {
  if (!recordBtn) return;
  recordBtn.textContent = listening ? t("speak.stop") : t("speak.start");
}

document.addEventListener("DOMContentLoaded", () => {
  initSpeak();
  onLocaleChange(() => {
    syncSpeakChrome();
    if (statusEl && !listening && !(recognizedEl?.value || "").trim() && !asrBusy) {
      setStatus(t("speak.status.ready"));
    }
    // Re-label ①/② from cached results only — do not re-run Whisper / re-decode audio
    // (that was racing Try-sample and could make the button look dead).
    const hyp = (recognizedEl?.value || "").trim();
    if (hyp && lastGist && !asrBusy) {
      void refreshPathLocaleOnly();
    }
  });
});

/** Swap zh/en copy + radar axis labels without re-fetching audio features. */
async function refreshPathLocaleOnly(): Promise<void> {
  if (!lastGist || !pathRoot || pathRoot.hidden) return;
  const en = preferEnUi();
  const isHit = archiveBadge?.classList.contains("speak-gist__badge--anchored");
  const conf = lastGist.confidence ?? 0;

  if (archiveText) {
    if (isHit) archiveText.textContent = en ? lastGist.gistEn : lastGist.gistZh;
    else if (conf >= ARCHIVE_NEAR_MIN) archiveText.textContent = t("speak.path.weakBody");
    else archiveText.textContent = t("speak.path.missBody");
  }
  if (sceneCardEl) {
    const line = en ? lastGist.sceneEn : lastGist.sceneZh;
    if (line && (isHit || line)) {
      sceneCardEl.hidden = false;
      sceneCardEl.textContent = line;
    }
  }
  if (lastProsody && prosodyText) {
    let summary = en ? lastProsody.summaryEn : lastProsody.summaryZh;
    if (isHit) {
      summary = en
        ? summary.replace(/^Not in archive\.\s*/i, "Archive candidate ready; from delivery, ")
        : summary.replace(/^档案未命中。/, "档案已有候选句；同时从腔调看，");
    }
    prosodyText.textContent = summary;
    if (prosodyMetrics) {
      prosodyMetrics.hidden = false;
      prosodyMetrics.textContent = en ? lastProsody.metricsEn : lastProsody.metricsZh;
    }
    const labels = emotionLabelsForUi();
    const focus = lastProsody.top.map(emotionName).filter(Boolean).join(" · ");
    renderThemeRadar(
      prosodyRadar,
      prosodyRadarCaption,
      lastProsody.scores,
      labels,
      focus ? tf("speak.path.emotionFocus", { themes: focus }) : t("speak.path.emotionEmpty"),
      t("speak.path.emotionEmpty"),
    );
  }
  const index = await loadLyricIndex();
  if (index) {
    const pieceId = selectedPieceId();
    const radarAxes = localizeThemeAxes(getPieceRadarAxes(pieceId, index.themes), en);
    const top = lastGist.topThemes
      .map((id) => radarAxes.find((x) => x.id === id)?.label)
      .filter(Boolean)
      .join(" · ");
    renderThemeRadar(
      archiveRadar,
      archiveRadarCaption,
      lastGist.themeScores,
      radarAxes,
      isHit && top ? tf("speak.gist.radarFocus", { themes: top }) : t("speak.path.radarIdle"),
      t("speak.gist.radarEmpty"),
    );
  }
}
