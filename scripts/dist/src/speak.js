import { onLocaleChange, t, tf } from "./i18n.js";
import { analyzeGist, getPieceRadarAxes, loadLyricIndex, loadPinyinMap, loadPieceRadar, loadSceneCards, } from "./speak-gist.js";
import { analyzeProsodyFromUrl, EMOTION_AXES, } from "./speak-prosody.js";
import { fingerprintFromAudioUrl, loadFingerprintIndex, matchFingerprint, } from "./speak-fingerprint.js";
const TRANSFORMERS_CDN = "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2";
const LOCAL_MODEL_ID = "yueyu-whisper-small-onnx";
/** Bigram Jaccard vs archive — above this ⇒ treat as archive hit. */
const ARCHIVE_HIT_MIN = 0.22;
const recordBtn = document.getElementById("speak-record");
const clearBtn = document.getElementById("speak-clear");
const fileInput = document.getElementById("speak-file");
const audioPreview = document.getElementById("speak-audio-preview");
const statusEl = document.getElementById("speak-status");
const recognizedEl = document.getElementById("speak-recognized");
const zhHansEl = document.getElementById("speak-zh-hans");
const zhHantEl = document.getElementById("speak-zh-hant");
const enEl = document.getElementById("speak-en");
const langSelect = document.getElementById("speak-input-lang");
const pathRoot = document.getElementById("speak-path");
const archiveBadge = document.getElementById("speak-archive-badge");
const archiveText = document.getElementById("speak-archive-text");
const archiveMatches = document.getElementById("speak-archive-matches");
const archiveRadar = document.getElementById("speak-archive-radar");
const archiveRadarCaption = document.getElementById("speak-archive-radar-caption");
const archiveMeter = document.getElementById("speak-archive-meter");
const archiveMeterLabel = document.getElementById("speak-archive-meter-label");
const archiveOpen = document.getElementById("speak-archive-open");
const gistUseBtn = document.getElementById("speak-gist-use");
const pieceSelect = document.getElementById("speak-piece");
const followTimeEl = document.getElementById("speak-follow-time");
const followClock = document.getElementById("speak-follow-clock");
const sceneCardEl = document.getElementById("speak-scene-card");
const fpNoteEl = document.getElementById("speak-fp-note");
const prosodyCard = document.getElementById("speak-prosody-card");
const prosodyText = document.getElementById("speak-prosody-text");
const prosodyRadar = document.getElementById("speak-prosody-radar");
const prosodyRadarCaption = document.getElementById("speak-prosody-radar-caption");
const prosodyMeter = document.getElementById("speak-prosody-meter");
const prosodyMeterLabel = document.getElementById("speak-prosody-meter-label");
let listening = false;
let finalTranscript = "";
let translateTimer = null;
let whisperPipeline = null;
let whisperLoading = null;
let modelPrep = null;
let previewObjectUrl = null;
let lastGist = null;
let lastProsody = null;
let mediaStream = null;
let mediaRecorder = null;
let recordedChunks = [];
function setStatus(text) {
    if (statusEl)
        statusEl.textContent = text;
}
/** Absolute URL to assets/asr/<model>/ on this site. */
function modelBaseHref() {
    const path = window.location.pathname;
    const dir = path.endsWith("/") ? path : path.replace(/[^/]+$/, "");
    return new URL(`assets/asr/${LOCAL_MODEL_ID}/`, `${window.location.origin}${dir}`).href;
}
async function translateWithMyMemory(text, from, to) {
    const url = new URL("https://api.mymemory.translated.net/get");
    url.searchParams.set("q", text.slice(0, 450));
    url.searchParams.set("langpair", `${from}|${to}`);
    const res = await fetch(url.toString());
    if (!res.ok)
        throw new Error(`Translation HTTP ${res.status}`);
    const data = (await res.json());
    const out = data.responseData?.translatedText?.trim();
    if (!out)
        throw new Error("Empty translation");
    if (/MYMEMORY WARNING/i.test(out))
        throw new Error("Translation quota exceeded — try again later");
    return out;
}
function looksLatin(text) {
    const letters = text.replace(/\s/g, "");
    if (!letters)
        return false;
    const latin = (letters.match(/[A-Za-z]/g) ?? []).length;
    return latin / letters.length > 0.5;
}
async function fillTranslations(source) {
    const text = source.trim();
    if (!text) {
        if (zhHansEl)
            zhHansEl.textContent = "—";
        if (zhHantEl)
            zhHantEl.textContent = "—";
        if (enEl)
            enEl.textContent = "—";
        return;
    }
    setStatus(t("speak.status.translating"));
    if (zhHansEl)
        zhHansEl.textContent = "…";
    if (zhHantEl)
        zhHantEl.textContent = "…";
    if (enEl)
        enEl.textContent = "…";
    try {
        const latin = looksLatin(text);
        let zhHans;
        let zhHant;
        let en;
        if (latin) {
            zhHans = await translateWithMyMemory(text, "en", "zh-CN");
            try {
                zhHant = await translateWithMyMemory(zhHans, "zh-CN", "zh-TW");
            }
            catch {
                zhHant = zhHans;
            }
            en = text;
        }
        else {
            zhHans = text;
            try {
                zhHant = await translateWithMyMemory(text, "zh-CN", "zh-TW");
            }
            catch {
                zhHant = text;
            }
            en = await translateWithMyMemory(text, "zh-CN", "en");
        }
        if (zhHansEl)
            zhHansEl.textContent = zhHans;
        if (zhHantEl)
            zhHantEl.textContent = zhHant;
        if (enEl)
            enEl.textContent = en;
        setStatus(t("speak.status.done"));
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setStatus(tf("speak.status.translateFail", { msg: message }));
        if (zhHansEl)
            zhHansEl.textContent = text;
        if (zhHantEl)
            zhHantEl.textContent = text;
        if (enEl)
            enEl.textContent = "(English translation unavailable)";
    }
}
function scheduleTranslate(text) {
    if (translateTimer !== null)
        window.clearTimeout(translateTimer);
    translateTimer = window.setTimeout(() => {
        void fillTranslations(text);
    }, 1500);
}
function syncRecognizedBox() {
    if (recognizedEl)
        recognizedEl.value = finalTranscript.trim();
}
function setMeter(fill, label, value01, text) {
    const pct = Math.round(Math.max(0, Math.min(1, value01)) * 100);
    if (fill)
        fill.style.width = `${pct}%`;
    if (label)
        label.textContent = text;
}
function selectedPieceId() {
    const v = pieceSelect?.value?.trim();
    return v || null;
}
function followTimeSec() {
    if (!followTimeEl?.checked)
        return null;
    if (!audioPreview || !Number.isFinite(audioPreview.currentTime))
        return null;
    // Need a piece scope for time anchoring to be meaningful
    if (!selectedPieceId())
        return null;
    return audioPreview.currentTime;
}
function updateFollowClock() {
    if (!followClock)
        return;
    if (!audioPreview || audioPreview.hidden || !Number.isFinite(audioPreview.currentTime)) {
        followClock.textContent = "—";
        return;
    }
    const tsec = audioPreview.currentTime;
    const m = Math.floor(tsec / 60);
    const s = Math.floor(tsec % 60);
    followClock.textContent = `${m}:${String(s).padStart(2, "0")}`;
}
function cueHref(pieceId, entryId) {
    const prefix = `${pieceId}-`;
    const cue = entryId.startsWith(prefix) ? entryId.slice(prefix.length) : entryId;
    return `pieces/${encodeURIComponent(pieceId)}.html#cue-${encodeURIComponent(cue)}`;
}
function populatePieceSelect(index) {
    if (!pieceSelect || !index)
        return;
    const prev = pieceSelect.value;
    const byPiece = new Map();
    for (const e of index.entries) {
        if (!byPiece.has(e.pieceId))
            byPiece.set(e.pieceId, e.title);
    }
    const preferred = ["jingchai-ji", "baitu-ji", "liangzhu", "xianglin-sao-xinsuanhua"];
    const ids = [...byPiece.keys()].sort((a, b) => {
        const pa = preferred.indexOf(a);
        const pb = preferred.indexOf(b);
        if (pa >= 0 || pb >= 0)
            return (pa < 0 ? 999 : pa) - (pb < 0 ? 999 : pb);
        return (byPiece.get(a) || a).localeCompare(byPiece.get(b) || b, "zh");
    });
    // Keep first "any" option
    while (pieceSelect.options.length > 1)
        pieceSelect.remove(1);
    for (const id of ids) {
        const opt = document.createElement("option");
        opt.value = id;
        opt.textContent = byPiece.get(id) || id;
        pieceSelect.appendChild(opt);
    }
    if (Array.from(pieceSelect.options).some((o) => o.value === prev))
        pieceSelect.value = prev;
}
function hidePathPanels() {
    lastGist = null;
    lastProsody = null;
    if (pathRoot)
        pathRoot.hidden = true;
    if (prosodyCard)
        prosodyCard.hidden = true;
    if (gistUseBtn)
        gistUseBtn.hidden = true;
    if (archiveOpen) {
        archiveOpen.hidden = true;
        archiveOpen.removeAttribute("href");
    }
    setMeter(archiveMeter, archiveMeterLabel, 0, "—");
    setMeter(prosodyMeter, prosodyMeterLabel, 0, "—");
}
function renderThemeRadar(svg, caption, scores, labels, focusText, emptyText) {
    if (!svg)
        return;
    const size = 180;
    const cx = size / 2;
    const cy = size / 2;
    const r = 58;
    const n = labels.length || 1;
    const ring = (rr) => {
        const pts = [];
        for (let i = 0; i < n; i++) {
            const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
            pts.push(`${(cx + rr * Math.cos(ang)).toFixed(1)},${(cy + rr * Math.sin(ang)).toFixed(1)}`);
        }
        return pts.join(" ");
    };
    const valuePts = [];
    const labelsSvg = [];
    labels.forEach((lab, i) => {
        const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        const v = Math.max(0, Math.min(1, scores[lab.id] ?? 0));
        const rr = r * (0.12 + 0.88 * v);
        valuePts.push(`${(cx + rr * Math.cos(ang)).toFixed(1)},${(cy + rr * Math.sin(ang)).toFixed(1)}`);
        const lx = cx + (r + 22) * Math.cos(ang);
        const ly = cy + (r + 22) * Math.sin(ang);
        labelsSvg.push(`<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="9" fill="currentColor">${lab.label}</text>`);
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
    if (caption)
        caption.textContent = focusText || emptyText;
}
function archiveHit(result, fpBest) {
    if (fpBest >= 0.88)
        return true;
    if (result.confidence >= ARCHIVE_HIT_MIN)
        return true;
    return result.mode === "direct" || result.mode === "anchored";
}
async function runPostAsrPaths(hyp) {
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
    if (pathRoot)
        pathRoot.hidden = false;
    if (prosodyCard)
        prosodyCard.hidden = true;
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
    let result = null;
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
    let fpHits = [];
    if (previewObjectUrl && fpIndex) {
        const q = await fingerprintFromAudioUrl(previewObjectUrl);
        if (q)
            fpHits = matchFingerprint(q, fpIndex, pieceId, 3);
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
                gistEn: `Audio fingerprint close to archive clip “${entry.text}” (${entry.title}).`,
            };
            lastGist = result;
        }
    }
    const hit = result ? archiveHit(result, fpBest) : fpBest >= 0.88;
    const conf = Math.max(result?.confidence ?? 0, fpBest >= 0.88 ? fpBest : 0);
    setMeter(archiveMeter, archiveMeterLabel, conf, tf("speak.path.archiveConf", { pct: String(Math.round(conf * 100)) }));
    if (archiveBadge) {
        archiveBadge.classList.remove("speak-gist__badge--gist", "speak-gist__badge--anchored");
        if (hit) {
            archiveBadge.textContent = t("speak.path.badgeHit");
            archiveBadge.classList.add("speak-gist__badge--anchored");
        }
        else {
            archiveBadge.textContent = t("speak.path.badgeMiss");
            archiveBadge.classList.add("speak-gist__badge--gist");
        }
    }
    if (archiveText) {
        if (!result) {
            archiveText.textContent = t("speak.path.archiveUnavailable");
        }
        else if (hit) {
            archiveText.textContent = result.gistZh;
        }
        else {
            archiveText.textContent = t("speak.path.missBody");
        }
    }
    if (sceneCardEl) {
        // Show vernacular scene when we know the piece/time, even if lyric text missed
        if (result?.sceneZh && (hit || (pieceId && timeSec != null))) {
            sceneCardEl.hidden = false;
            sceneCardEl.textContent = result.sceneZh;
        }
        else {
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
        }
        else {
            fpNoteEl.hidden = true;
            fpNoteEl.textContent = "";
        }
    }
    if (archiveMatches) {
        archiveMatches.innerHTML = hit && result
            ? result.matches
                .slice(0, 3)
                .map((m) => `<li><strong>《${m.entry.title}》</strong> ${m.entry.text} <span style="opacity:.65">(${(m.score * 100).toFixed(0)}%)</span></li>`)
                .join("")
            : "";
    }
    if (result && index) {
        const radarAxes = getPieceRadarAxes(pieceId, index.themes);
        const top = result.topThemes
            .map((id) => radarAxes.find((x) => x.id === id)?.label ?? index.themes.find((x) => x.id === id)?.label)
            .filter(Boolean)
            .join(" · ");
        renderThemeRadar(archiveRadar, archiveRadarCaption, result.themeScores, radarAxes, hit && top ? tf("speak.gist.radarFocus", { themes: top }) : t("speak.path.radarIdle"), t("speak.gist.radarEmpty"));
    }
    if (gistUseBtn) {
        gistUseBtn.hidden = !(hit && result?.archiveLine);
    }
    if (archiveOpen) {
        const top = result?.matches[0]?.entry;
        if (hit && top) {
            archiveOpen.hidden = false;
            archiveOpen.href = cueHref(top.pieceId, top.id);
            archiveOpen.target = "_blank";
            archiveOpen.rel = "noopener";
        }
        else {
            archiveOpen.hidden = true;
            archiveOpen.removeAttribute("href");
        }
    }
    // Part ② only when archive miss
    if (!hit && previewObjectUrl) {
        setStatus(t("speak.path.prosodyRunning"));
        const prosody = await analyzeProsodyFromUrl(previewObjectUrl, pieceId);
        lastProsody = prosody;
        if (prosody && prosodyCard) {
            prosodyCard.hidden = false;
            if (prosodyText)
                prosodyText.textContent = prosody.summaryZh;
            const topScore = Math.max(...Object.values(prosody.scores), 0);
            setMeter(prosodyMeter, prosodyMeterLabel, topScore, tf("speak.path.emotionConf", { pct: String(Math.round(topScore * 100)) }));
            const labels = EMOTION_AXES.map((a) => ({ id: a.id, label: a.labelZh }));
            const focus = prosody.top
                .map((id) => EMOTION_AXES.find((a) => a.id === id)?.labelZh)
                .filter(Boolean)
                .join(" · ");
            renderThemeRadar(prosodyRadar, prosodyRadarCaption, prosody.scores, labels, focus ? tf("speak.path.emotionFocus", { themes: focus }) : t("speak.path.emotionEmpty"), t("speak.path.emotionEmpty"));
            // Prefer emotion summary for translation when lyrics are unknown
            scheduleTranslate(prosody.summaryZh);
            return result;
        }
    }
    else {
        setMeter(prosodyMeter, prosodyMeterLabel, 0, "—");
    }
    if (hit && result?.archiveLine && result.mode !== "direct") {
        scheduleTranslate(result.archiveLine);
    }
    else if (hit && result?.mode === "direct") {
        scheduleTranslate(hyp);
    }
    else {
        scheduleTranslate(hyp);
    }
    return result;
}
function applyRecognizedText(text, translateSoon = true) {
    finalTranscript = text.trim();
    syncRecognizedBox();
    if (translateSoon && finalTranscript) {
        void runPostAsrPaths(finalTranscript);
    }
    else {
        hidePathPanels();
    }
}
async function joinDecoderIntoCache(base) {
    const manifestRes = await fetch(new URL("speak-manifest.json", base));
    if (!manifestRes.ok)
        throw new Error(`speak-manifest HTTP ${manifestRes.status}`);
    const manifest = (await manifestRes.json());
    const cache = await caches.open("transformers-cache");
    const decoderNames = ["decoder_model_quantized.onnx", "decoder_model.onnx"];
    const primary = new URL(`onnx/${decoderNames[0]}`, base).href;
    if (await cache.match(primary))
        return;
    setStatus(t("speak.status.modelJoin"));
    const buffers = [];
    for (const part of manifest.decoderParts) {
        const res = await fetch(new URL(`onnx/${part}`, base));
        if (!res.ok)
            throw new Error(`Missing decoder part ${part}`);
        buffers.push(await res.arrayBuffer());
    }
    const blob = new Blob(buffers, { type: "application/octet-stream" });
    for (const name of decoderNames) {
        const url = new URL(`onnx/${name}`, base).href;
        await cache.put(url, new Response(blob.slice(), {
            headers: {
                "Content-Type": "application/octet-stream",
                "Content-Length": String(blob.size),
            },
        }));
    }
}
async function prepareLocalModel() {
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
async function ensureWhisper() {
    if (whisperPipeline)
        return whisperPipeline;
    if (whisperLoading)
        return whisperLoading;
    whisperLoading = (async () => {
        await prepareLocalModel();
        setStatus(t("speak.status.whisperLoad"));
        const mod = (await import(/* @vite-ignore */ TRANSFORMERS_CDN));
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
    }
    catch (localError) {
        whisperLoading = null;
        // Fallback if local ONNX assets are missing (e.g. not yet deployed).
        setStatus(t("speak.status.whisperFallback"));
        whisperLoading = (async () => {
            const mod = (await import(/* @vite-ignore */ TRANSFORMERS_CDN));
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
        }
        catch (error) {
            whisperLoading = null;
            throw localError instanceof Error ? localError : error;
        }
    }
}
function whisperLanguageHint() {
    const lang = langSelect?.value || "zh-CN";
    if (lang.startsWith("en"))
        return "english";
    if (lang.startsWith("zh"))
        return "chinese";
    return undefined;
}
async function recognizeBlob(blob, label) {
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
    if (recognizedEl)
        recognizedEl.value = "";
    if (zhHansEl)
        zhHansEl.textContent = "…";
    if (zhHantEl)
        zhHantEl.textContent = "…";
    if (enEl)
        enEl.textContent = "…";
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
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setStatus(tf("speak.status.uploadFail", { msg: message }));
    }
}
async function recognizeUploadedFile(file) {
    if (listening)
        stopListening(false);
    await recognizeBlob(file, file.name);
}
function pickRecorderMime() {
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
async function startListening() {
    if (listening)
        return;
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setStatus(t("speak.status.noMic"));
        return;
    }
    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }
    catch {
        setStatus(t("speak.status.micDenied"));
        return;
    }
    recordedChunks = [];
    const mime = pickRecorderMime();
    mediaRecorder = mime
        ? new MediaRecorder(mediaStream, { mimeType: mime })
        : new MediaRecorder(mediaStream);
    mediaRecorder.ondataavailable = (ev) => {
        if (ev.data.size > 0)
            recordedChunks.push(ev.data);
    };
    mediaRecorder.onerror = () => {
        setStatus(tf("speak.status.recogError", { msg: "MediaRecorder" }));
    };
    mediaRecorder.onstop = () => {
        listening = false;
        recordBtn?.setAttribute("aria-pressed", "false");
        if (recordBtn)
            recordBtn.textContent = t("speak.start");
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
    if (recordBtn)
        recordBtn.textContent = t("speak.stop");
    setStatus(t("speak.status.listening"));
}
function stopListening(runRecognition = true) {
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
        if (recordBtn)
            recordBtn.textContent = t("speak.start");
        return;
    }
    mediaRecorder.stop();
}
function clearAll() {
    if (listening)
        stopListening(false);
    finalTranscript = "";
    if (recognizedEl)
        recognizedEl.value = "";
    if (zhHansEl)
        zhHansEl.textContent = "—";
    if (zhHantEl)
        zhHantEl.textContent = "—";
    if (enEl)
        enEl.textContent = "—";
    if (fileInput)
        fileInput.value = "";
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
function initSpeakOutputTabs() {
    const tabs = document.querySelectorAll("[data-speak-output-tab]");
    const panels = document.querySelectorAll("[data-speak-output]");
    if (!tabs.length || !panels.length)
        return;
    function activate(lang) {
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
    const syncMode = () => {
        const tablist = document.querySelector(".speak-output-tabs");
        if (tablist)
            tablist.hidden = !mq.matches;
        if (mq.matches) {
            const current = document.querySelector(".speak-output-tab[aria-selected='true']")
                ?.dataset.speakOutputTab ?? "zh-Hans";
            activate(current);
        }
        else {
            panels.forEach((panel) => {
                panel.hidden = false;
                panel.classList.add("speak-output--active");
            });
        }
    };
    mq.addEventListener("change", syncMode);
    syncMode();
}
async function runSample(url, label) {
    setStatus(tf("speak.status.sampleLoading", { name: label }));
    try {
        const res = await fetch(url);
        if (!res.ok)
            throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const name = url.split("/").pop() ?? "sample.m4a";
        const file = new File([blob], name, { type: blob.type || "audio/mp4" });
        await recognizeUploadedFile(file);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setStatus(tf("speak.status.sampleFail", { msg: message }));
    }
}
function initSpeak() {
    if (!recognizedEl)
        return;
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setStatus(t("speak.status.noMic"));
        if (recordBtn)
            recordBtn.disabled = true;
    }
    else {
        setStatus(t("speak.status.ready"));
    }
    recordBtn?.addEventListener("click", () => {
        if (listening)
            stopListening(true);
        else
            void startListening();
    });
    clearBtn?.addEventListener("click", clearAll);
    fileInput?.addEventListener("change", () => {
        const file = fileInput.files?.[0];
        if (!file)
            return;
        void recognizeUploadedFile(file);
    });
    document.querySelectorAll("[data-speak-sample]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const url = btn.dataset.speakSample;
            if (!url)
                return;
            const label = btn.textContent?.trim() || url;
            void runSample(url, label);
        });
    });
    recognizedEl.addEventListener("input", () => {
        finalTranscript = recognizedEl.value;
        void runPostAsrPaths(finalTranscript);
    });
    gistUseBtn?.addEventListener("click", () => {
        if (!lastGist?.archiveLine)
            return;
        applyRecognizedText(lastGist.archiveLine, true);
        setStatus(t("speak.gist.applied"));
    });
    void loadLyricIndex().then((index) => {
        populatePieceSelect(index);
    });
    void loadSceneCards();
    void loadFingerprintIndex();
    pieceSelect?.addEventListener("change", () => {
        if (selectedPieceId() && followTimeEl && !followTimeEl.checked) {
            // Suggest follow mode when a piece is chosen
            followTimeEl.checked = true;
        }
        if (finalTranscript.trim())
            void runPostAsrPaths(finalTranscript);
    });
    followTimeEl?.addEventListener("change", () => {
        if (finalTranscript.trim())
            void runPostAsrPaths(finalTranscript);
    });
    audioPreview?.addEventListener("timeupdate", () => {
        updateFollowClock();
    });
    audioPreview?.addEventListener("seeked", () => {
        updateFollowClock();
        if (followTimeEl?.checked && finalTranscript.trim())
            void runPostAsrPaths(finalTranscript);
    });
    document.querySelectorAll("[data-translate-target]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const target = btn.dataset.translateTarget;
            const map = {
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
function syncSpeakChrome() {
    if (!recordBtn)
        return;
    recordBtn.textContent = listening ? t("speak.stop") : t("speak.start");
}
document.addEventListener("DOMContentLoaded", () => {
    initSpeak();
    onLocaleChange(() => {
        syncSpeakChrome();
        if (statusEl && !listening && !(recognizedEl?.value || "").trim()) {
            setStatus(t("speak.status.ready"));
        }
    });
});
//# sourceMappingURL=speak.js.map