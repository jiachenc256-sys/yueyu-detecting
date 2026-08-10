import { onLocaleChange, t, tf } from "./i18n.js";
/**
 * In-site Tanci panel: image-only OCR via sister project Talcne backend,
 * then 简 / 繁 / EN translation (same MyMemory path as Speak).
 */
const STORAGE_KEY = "yueyu.talcneApiBase";
const DEFAULT_API = "http://127.0.0.1:8000";
/** Production OCR backend (Render). Used when the site is not on localhost. */
const PRODUCTION_API = "https://talcne.onrender.com";
/** Filled from `/config.json` → `talcneApiBase` (optional override). */
let configApiBase = "";
function isLocalHost() {
    const host = window.location.hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}
const fileInput = document.getElementById("tanci-file");
const recognizeBtn = document.getElementById("tanci-recognize");
const exportBtn = document.getElementById("tanci-export");
const clearBtn = document.getElementById("tanci-clear");
const statusEl = document.getElementById("tanci-status");
const textEl = document.getElementById("tanci-text");
const previewList = document.getElementById("tanci-preview-list");
const zhHansEl = document.getElementById("tanci-zh-hans");
const zhHantEl = document.getElementById("tanci-zh-hant");
const enEl = document.getElementById("tanci-en");
let selectedFiles = [];
let previewUrls = [];
let lastPages = [];
let busy = false;
let translateTimer = null;
function setStatus(text) {
    if (statusEl)
        statusEl.textContent = text;
}
function normalizeApiBase(raw) {
    return raw.trim().replace(/\/+$/, "");
}
/**
 * Priority: window override → localStorage → config.json → localhost.
 * Production: set `talcneApiBase` in `/config.json` to the Render URL.
 */
function getApiBase() {
    try {
        const fromWindow = window.__YUEYU_TALCNE_API__;
        if (typeof fromWindow === "string" && fromWindow.trim()) {
            return normalizeApiBase(fromWindow);
        }
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved)
            return normalizeApiBase(saved);
    }
    catch {
        /* ignore */
    }
    if (configApiBase)
        return configApiBase;
    // Custom domain / GitHub Pages must never fall back to 127.0.0.1 (causes Failed to fetch).
    if (!isLocalHost())
        return PRODUCTION_API;
    return DEFAULT_API;
}
async function loadPublicConfig() {
    try {
        const url = new URL("config.json", window.location.href).toString();
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok)
            return;
        const data = (await res.json());
        if (typeof data.talcneApiBase === "string" && data.talcneApiBase.trim()) {
            configApiBase = normalizeApiBase(data.talcneApiBase);
        }
    }
    catch {
        /* optional file */
    }
}
function refreshActionState() {
    if (recognizeBtn)
        recognizeBtn.disabled = busy || selectedFiles.length === 0;
    if (exportBtn)
        exportBtn.disabled = !(textEl?.value.trim());
    if (fileInput)
        fileInput.disabled = busy;
}
function revokePreviews() {
    for (const url of previewUrls)
        URL.revokeObjectURL(url);
    previewUrls = [];
}
function renderPreviews() {
    if (!previewList)
        return;
    previewList.replaceChildren();
    if (!selectedFiles.length) {
        const empty = document.createElement("p");
        empty.className = "tanci-preview__empty";
        empty.dataset.i18n = "tanci.previewEmpty";
        empty.textContent = t("tanci.previewEmpty");
        previewList.appendChild(empty);
        return;
    }
    revokePreviews();
    selectedFiles.forEach((file, index) => {
        const url = URL.createObjectURL(file);
        previewUrls.push(url);
        const figure = document.createElement("figure");
        figure.className = "tanci-preview__item";
        const img = document.createElement("img");
        img.src = url;
        img.alt = file.name;
        const cap = document.createElement("figcaption");
        cap.textContent = `${index + 1}. ${file.name}`;
        figure.append(img, cap);
        previewList.appendChild(figure);
    });
}
function splitCorrectedLines(text) {
    return text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !/^——\s*第\d+[张页]\s*——$/.test(line));
}
function clearTranslations() {
    if (zhHansEl)
        zhHansEl.textContent = "—";
    if (zhHantEl)
        zhHantEl.textContent = "—";
    if (enEl)
        enEl.textContent = "—";
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
async function fillTranslations(source) {
    const text = source.trim();
    if (!text) {
        clearTranslations();
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
        const zhHans = text;
        let zhHant;
        try {
            zhHant = await translateWithMyMemory(text, "zh-CN", "zh-TW");
        }
        catch {
            zhHant = text;
        }
        const en = await translateWithMyMemory(text, "zh-CN", "en");
        if (zhHansEl)
            zhHansEl.textContent = zhHans;
        if (zhHantEl)
            zhHantEl.textContent = zhHant;
        if (enEl)
            enEl.textContent = en;
        setStatus(t("tanci.status.doneTranslate"));
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
    }, 1200);
}
async function callOcrApi(file) {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`${getApiBase()}/api/ocr`, {
        method: "POST",
        body: formData,
    });
    let data = {};
    try {
        data = (await response.json());
    }
    catch {
        data = {};
    }
    if (!response.ok) {
        const detail = data.detail || data.error || `HTTP ${response.status}`;
        throw new Error(String(detail));
    }
    return data;
}
async function recognizeImages() {
    if (!selectedFiles.length || busy)
        return;
    busy = true;
    refreshActionState();
    lastPages = [];
    const textParts = [];
    const multi = selectedFiles.length > 1;
    try {
        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            if (!file)
                continue;
            setStatus(multi
                ? t("tanci.status.progressMulti")
                    .replace("{n}", String(i + 1))
                    .replace("{total}", String(selectedFiles.length))
                : t("tanci.status.progress"));
            const data = await callOcrApi(file);
            if (data.success === false) {
                throw new Error(data.error || t("tanci.status.fail"));
            }
            const page = data.pages?.[0];
            const pageText = page?.text ?? data.text ?? "";
            lastPages.push({
                page: i + 1,
                text: pageText,
                blocks: page?.blocks ?? [],
            });
            textParts.push(multi ? `—— 第${i + 1}张 ——\n${pageText}` : pageText);
        }
        const joined = textParts.join("\n\n");
        if (textEl)
            textEl.value = joined;
        setStatus(t("tanci.status.done"));
        await fillTranslations(joined);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setStatus(`${t("tanci.status.fail")}: ${message}`);
    }
    finally {
        busy = false;
        refreshActionState();
    }
}
function buildYueyuExportPayload() {
    const fullText = textEl?.value.trim() ?? "";
    const lines = splitCorrectedLines(fullText);
    const pagePayloads = lastPages.length > 0
        ? lastPages.map((p) => ({
            page: p.page ?? 1,
            text: p.text ?? "",
            lines: splitCorrectedLines(p.text ?? ""),
            blocks: (p.blocks ?? []).map((b) => ({
                text: b.text ?? "",
                confidence: typeof b.confidence === "number" ? b.confidence : null,
            })),
        }))
        : [
            {
                page: 1,
                text: fullText,
                lines,
                blocks: [],
            },
        ];
    return {
        schemaVersion: "1.0.0",
        source: "talcne",
        target: "yueyu-detecting",
        exportedAt: new Date().toISOString(),
        script: "zh-Hans",
        fileNames: selectedFiles.map((f) => f.name),
        fullText,
        lines,
        pages: pagePayloads,
        translations: {
            zhHans: zhHansEl?.textContent?.trim() || fullText,
            zhHant: zhHantEl?.textContent?.trim() || "",
            en: enEl?.textContent?.trim() || "",
        },
        note: "Corrected OCR text from Yueyu Detecting in-site Tanci panel (Talcne backend).",
    };
}
function exportYueyuJson() {
    const fullText = textEl?.value.trim() ?? "";
    if (!fullText)
        return;
    const payload = buildYueyuExportPayload();
    const stamp = String(payload.exportedAt).slice(0, 10);
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `talcne-yueyu-export-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatus(t("tanci.status.exported"));
}
function clearAll() {
    selectedFiles = [];
    lastPages = [];
    if (translateTimer !== null) {
        window.clearTimeout(translateTimer);
        translateTimer = null;
    }
    if (fileInput)
        fileInput.value = "";
    if (textEl)
        textEl.value = "";
    clearTranslations();
    revokePreviews();
    renderPreviews();
    setStatus(t("tanci.ready"));
    refreshActionState();
}
async function initTanciPanel() {
    if (!fileInput || !recognizeBtn || !textEl)
        return;
    await loadPublicConfig();
    fileInput.addEventListener("change", () => {
        selectedFiles = Array.from(fileInput.files ?? []).filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif)$/i.test(f.name));
        renderPreviews();
        refreshActionState();
        setStatus(selectedFiles.length
            ? t("tanci.status.selected").replace("{n}", String(selectedFiles.length))
            : t("tanci.ready"));
    });
    recognizeBtn.addEventListener("click", () => {
        void recognizeImages();
    });
    exportBtn?.addEventListener("click", exportYueyuJson);
    clearBtn?.addEventListener("click", clearAll);
    textEl.addEventListener("input", () => {
        refreshActionState();
        scheduleTranslate(textEl.value);
    });
    onLocaleChange(() => {
        renderPreviews();
        refreshActionState();
    });
    renderPreviews();
    refreshActionState();
}
document.addEventListener("DOMContentLoaded", () => {
    void initTanciPanel();
});
//# sourceMappingURL=tanci.js.map