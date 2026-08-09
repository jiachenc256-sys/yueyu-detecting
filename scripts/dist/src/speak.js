"use strict";
/**
 * Phase A: Speak → recognize → translate (简体 / 繁體 / English).
 * Browser Web Speech API + MyMemory translation (no API key).
 * Baseline ASR — Yueju stage dialect improves later with archive fine-tuning.
 */
const recordBtn = document.getElementById("speak-record");
const clearBtn = document.getElementById("speak-clear");
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
    setStatus("Translating… (a few seconds)");
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
        setStatus("Done. Baseline recognition (browser ASR). Yueju dialect accuracy will improve using your archive corpus.");
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setStatus(`Translation failed: ${message}`);
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
            recordBtn.textContent = "Stop listening";
        setStatus("Listening… speak now. Stop when finished; translation follows in a few seconds.");
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
            setStatus("Microphone permission denied. Allow mic access and try again.");
        }
        else if (event.error !== "aborted") {
            setStatus(`Recognition error: ${event.error}`);
        }
    };
    rec.onend = () => {
        listening = false;
        recordBtn?.setAttribute("aria-pressed", "false");
        if (recordBtn)
            recordBtn.textContent = "Start listening";
        syncRecognizedBox();
        if (finalTranscript.trim())
            scheduleTranslate(finalTranscript);
        else
            setStatus("Stopped. No speech captured — try again closer to the mic.");
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
        setStatus("Could not start recognition. Wait a moment and try again.");
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
    setStatus("Cleared. Ready when you are.");
}
function initSpeak() {
    if (!recordBtn || !recognizedEl)
        return;
    if (!getRecognitionCtor()) {
        setStatus("Speech recognition needs Chrome or Edge on desktop. Safari/Firefox support is limited.");
        recordBtn.disabled = true;
    }
    else {
        setStatus("Ready. Click Start listening, speak, then Stop — translation appears shortly after.");
    }
    recordBtn.addEventListener("click", () => {
        if (listening)
            stopListening();
        else
            startListening();
    });
    clearBtn?.addEventListener("click", clearAll);
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
document.addEventListener("DOMContentLoaded", initSpeak);
//# sourceMappingURL=speak.js.map