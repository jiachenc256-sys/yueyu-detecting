import { onLocaleChange, t, tf } from "./i18n.js";

/**
 * Speak → recognize → translate (简体 / 繁體 / English).
 * Mic: MediaRecorder → on-device Yueyu-adapted Whisper (same path as upload).
 * Upload / samples: local INT8 ONNX whisper-small + LoRA merge via @xenova/transformers.
 * Translation: MyMemory (no API key).
 */

type TargetLang = "zh-Hans" | "zh-Hant" | "en";

type AsrPipeline = (
  input: string | Blob | Float32Array,
  options?: Record<string, unknown>,
) => Promise<{ text?: string } | Array<{ text?: string }>>;

const TRANSFORMERS_CDN =
  "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2";

const LOCAL_MODEL_ID = "yueyu-whisper-small-onnx";

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

let listening = false;
let finalTranscript = "";
let translateTimer: number | null = null;
let whisperPipeline: AsrPipeline | null = null;
let whisperLoading: Promise<AsrPipeline> | null = null;
let modelPrep: Promise<void> | null = null;
let previewObjectUrl: string | null = null;

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

function applyRecognizedText(text: string, translateSoon = true): void {
  finalTranscript = text.trim();
  syncRecognizedBox();
  if (translateSoon && finalTranscript) scheduleTranslate(finalTranscript);
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
  setStatus(tf("speak.status.sampleLoading", { name: label }));
  try {
    const res = await fetch(url);
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
      const label = btn.textContent?.trim() || url;
      void runSample(url, label);
    });
  });

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
    if (statusEl && !listening && !(recognizedEl?.value || "").trim()) {
      setStatus(t("speak.status.ready"));
    }
  });
});
