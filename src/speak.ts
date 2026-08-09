/**
 * Phase A: Speak → recognize → translate (简体 / 繁體 / English).
 * Browser Web Speech API + MyMemory translation (no API key).
 * Baseline ASR — Yueju stage dialect improves later with archive fine-tuning.
 */

type TargetLang = "zh-Hans" | "zh-Hant" | "en";

interface BrowserSpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((ev: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

interface BrowserSpeechRecognitionEvent {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0?: { transcript?: string };
  }>;
}

type RecognitionCtor = new () => BrowserSpeechRecognition;

const recordBtn = document.getElementById("speak-record") as HTMLButtonElement | null;
const clearBtn = document.getElementById("speak-clear") as HTMLButtonElement | null;
const statusEl = document.getElementById("speak-status");
const recognizedEl = document.getElementById("speak-recognized") as HTMLTextAreaElement | null;
const zhHansEl = document.getElementById("speak-zh-hans");
const zhHantEl = document.getElementById("speak-zh-hant");
const enEl = document.getElementById("speak-en");
const langSelect = document.getElementById("speak-input-lang") as HTMLSelectElement | null;

let recognition: BrowserSpeechRecognition | null = null;
let listening = false;
let finalTranscript = "";
let translateTimer: number | null = null;

function setStatus(text: string): void {
  if (statusEl) statusEl.textContent = text;
}

function getRecognitionCtor(): RecognitionCtor | null {
  const w = window as Window & {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
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

  setStatus("Translating… (a few seconds)");
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
    setStatus(
      "Done. Baseline recognition (browser ASR). Yueju dialect accuracy will improve using your archive corpus.",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus(`Translation failed: ${message}`);
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

function ensureRecognition(): BrowserSpeechRecognition {
  if (recognition) return recognition;
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
    if (recordBtn) recordBtn.textContent = "Stop listening";
    setStatus("Listening… speak now. Stop when finished; translation follows in a few seconds.");
  };

  rec.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      if (!result) continue;
      const piece = result[0]?.transcript ?? "";
      if (result.isFinal) {
        finalTranscript = `${finalTranscript} ${piece}`.replace(/\s+/g, " ").trim();
      } else {
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
    } else if (event.error !== "aborted") {
      setStatus(`Recognition error: ${event.error}`);
    }
  };

  rec.onend = () => {
    listening = false;
    recordBtn?.setAttribute("aria-pressed", "false");
    if (recordBtn) recordBtn.textContent = "Start listening";
    syncRecognizedBox();
    if (finalTranscript.trim()) scheduleTranslate(finalTranscript);
    else setStatus("Stopped. No speech captured — try again closer to the mic.");
  };

  recognition = rec;
  return rec;
}

function startListening(): void {
  const rec = ensureRecognition();
  rec.lang = langSelect?.value || "zh-CN";
  finalTranscript = finalTranscript.trim();
  try {
    rec.start();
  } catch {
    setStatus("Could not start recognition. Wait a moment and try again.");
  }
}

function stopListening(): void {
  recognition?.stop();
}

function clearAll(): void {
  if (listening) recognition?.abort();
  finalTranscript = "";
  if (recognizedEl) recognizedEl.value = "";
  if (zhHansEl) zhHansEl.textContent = "—";
  if (zhHantEl) zhHantEl.textContent = "—";
  if (enEl) enEl.textContent = "—";
  setStatus("Cleared. Ready when you are.");
}

function initSpeak(): void {
  if (!recordBtn || !recognizedEl) return;

  if (!getRecognitionCtor()) {
    setStatus("Speech recognition needs Chrome or Edge on desktop. Safari/Firefox support is limited.");
    recordBtn.disabled = true;
  } else {
    setStatus("Ready. Click Start listening, speak, then Stop — translation appears shortly after.");
  }

  recordBtn.addEventListener("click", () => {
    if (listening) stopListening();
    else startListening();
  });

  clearBtn?.addEventListener("click", clearAll);

  recognizedEl.addEventListener("input", () => {
    finalTranscript = recognizedEl.value;
    scheduleTranslate(finalTranscript);
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
}

document.addEventListener("DOMContentLoaded", initSpeak);
