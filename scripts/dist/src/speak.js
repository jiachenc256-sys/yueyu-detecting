import { onLocaleChange, t, tf } from "./i18n.js?v=20260810t";
const TRANSFORMERS_CDN = "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2";
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
let recognition = null;
let listening = false;
let finalTranscript = "";
let translateTimer = null;
let whisperPipeline = null;
let whisperLoading = null;
let previewObjectUrl = null;
function setStatus(text) {
    if (statusEl)
        statusEl.textContent = text;
}
function getRecognitionCtor() {
    const w = window;
    return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
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
function applyRecognizedText(text, translateSoon = true) {
    finalTranscript = text.trim();
    syncRecognizedBox();
    if (translateSoon && finalTranscript)
        scheduleTranslate(finalTranscript);
}
async function ensureWhisper() {
    if (whisperPipeline)
        return whisperPipeline;
    if (whisperLoading)
        return whisperLoading;
    whisperLoading = (async () => {
        setStatus(t("speak.status.whisperLoad"));
        const mod = (await import(/* @vite-ignore */ TRANSFORMERS_CDN));
        mod.env.allowLocalModels = false;
        mod.env.useBrowserCache = true;
        const asr = await mod.pipeline("automatic-speech-recognition", "Xenova/whisper-tiny", {
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
    catch (error) {
        whisperLoading = null;
        throw error;
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
async function recognizeUploadedFile(file) {
    if (listening)
        recognition?.abort();
    if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
        previewObjectUrl = null;
    }
    previewObjectUrl = URL.createObjectURL(file);
    if (audioPreview) {
        audioPreview.src = previewObjectUrl;
        audioPreview.hidden = false;
    }
    setStatus(tf("speak.status.recognizing", { name: file.name }));
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
function ensureRecognition() {
    if (recognition)
        return recognition;
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
        throw new Error("This browser has no Speech Recognition. Please use Chrome or Edge.");
    }
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.lang = langSelect?.value || "zh-CN";
    rec.onstart = () => {
        listening = true;
        recordBtn?.setAttribute("aria-pressed", "true");
        if (recordBtn)
            recordBtn.textContent = t("speak.stop");
        setStatus(t("speak.status.listening"));
    };
    rec.onresult = (event) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const result = event.results[i];
            if (!result)
                continue;
            const piece = result[0]?.transcript ?? "";
            if (result.isFinal) {
                finalTranscript = `${finalTranscript} ${piece}`.replace(/\s+/g, " ").trim();
            }
            else {
                interim += piece;
            }
        }
        if (recognizedEl) {
            recognizedEl.value = [finalTranscript, interim].filter(Boolean).join(" ").trim();
        }
    };
    rec.onerror = (event) => {
        if (event.error === "not-allowed") {
            setStatus(t("speak.status.micDenied"));
        }
        else if (event.error !== "aborted") {
            setStatus(tf("speak.status.recogError", { msg: event.error }));
        }
    };
    rec.onend = () => {
        listening = false;
        recordBtn?.setAttribute("aria-pressed", "false");
        if (recordBtn)
            recordBtn.textContent = t("speak.start");
        syncRecognizedBox();
        if (finalTranscript.trim())
            scheduleTranslate(finalTranscript);
        else
            setStatus(t("speak.status.noCapture"));
    };
    recognition = rec;
    return rec;
}
function startListening() {
    const rec = ensureRecognition();
    rec.lang = langSelect?.value || "zh-CN";
    finalTranscript = finalTranscript.trim();
    try {
        rec.start();
    }
    catch {
        setStatus(t("speak.status.startFail"));
    }
}
function stopListening() {
    recognition?.stop();
}
function clearAll() {
    if (listening)
        recognition?.abort();
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
    setStatus(t("speak.status.cleared"));
}
function initSpeak() {
    if (!recognizedEl)
        return;
    if (!getRecognitionCtor()) {
        setStatus(t("speak.status.noMic"));
        if (recordBtn)
            recordBtn.disabled = true;
    }
    else {
        setStatus(t("speak.status.ready"));
    }
    recordBtn?.addEventListener("click", () => {
        if (listening)
            stopListening();
        else
            startListening();
    });
    clearBtn?.addEventListener("click", clearAll);
    fileInput?.addEventListener("change", () => {
        const file = fileInput.files?.[0];
        if (!file)
            return;
        void recognizeUploadedFile(file);
    });
    recognizedEl.addEventListener("input", () => {
        finalTranscript = recognizedEl.value;
        scheduleTranslate(finalTranscript);
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