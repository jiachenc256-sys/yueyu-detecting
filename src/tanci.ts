import { onLocaleChange, t } from "./i18n.js";

/**
 * In-site Tanci panel: image-only OCR via sister project Talcne backend.
 * Protocol matches Talcne `POST /api/ocr` (FormData field `file`).
 */

const STORAGE_KEY = "yueyu.talcneApiBase";
const DEFAULT_API = "http://127.0.0.1:8000";

interface OcrBlock {
  text?: string;
  confidence?: number;
}

interface OcrPage {
  page?: number;
  text?: string;
  blocks?: OcrBlock[];
}

interface OcrResponse {
  success?: boolean;
  text?: string;
  pages?: OcrPage[];
  error?: string;
  detail?: string;
}

const apiInput = document.getElementById("tanci-api-base") as HTMLInputElement | null;
const fileInput = document.getElementById("tanci-file") as HTMLInputElement | null;
const recognizeBtn = document.getElementById("tanci-recognize") as HTMLButtonElement | null;
const exportBtn = document.getElementById("tanci-export") as HTMLButtonElement | null;
const clearBtn = document.getElementById("tanci-clear") as HTMLButtonElement | null;
const statusEl = document.getElementById("tanci-status");
const textEl = document.getElementById("tanci-text") as HTMLTextAreaElement | null;
const previewList = document.getElementById("tanci-preview-list");

let selectedFiles: File[] = [];
let previewUrls: string[] = [];
let lastPages: OcrPage[] = [];
let busy = false;

function setStatus(text: string): void {
  if (statusEl) statusEl.textContent = text;
}

function normalizeApiBase(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

function getApiBase(): string {
  const fromInput = apiInput?.value?.trim();
  if (fromInput) return normalizeApiBase(fromInput);
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return normalizeApiBase(saved);
  } catch {
    /* ignore */
  }
  return DEFAULT_API;
}

function persistApiBase(): void {
  if (!apiInput) return;
  const value = normalizeApiBase(apiInput.value || DEFAULT_API);
  apiInput.value = value;
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* ignore */
  }
}

function refreshActionState(): void {
  if (recognizeBtn) recognizeBtn.disabled = busy || selectedFiles.length === 0;
  if (exportBtn) exportBtn.disabled = !(textEl?.value.trim());
  if (fileInput) fileInput.disabled = busy;
}

function revokePreviews(): void {
  for (const url of previewUrls) URL.revokeObjectURL(url);
  previewUrls = [];
}

function renderPreviews(): void {
  if (!previewList) return;
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

function splitCorrectedLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^——\s*第\d+[张页]\s*——$/.test(line));
}

async function callOcrApi(file: File): Promise<OcrResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${getApiBase()}/api/ocr`, {
    method: "POST",
    body: formData,
  });
  let data: OcrResponse = {};
  try {
    data = (await response.json()) as OcrResponse;
  } catch {
    data = {};
  }
  if (!response.ok) {
    const detail = data.detail || data.error || `HTTP ${response.status}`;
    throw new Error(String(detail));
  }
  return data;
}

async function recognizeImages(): Promise<void> {
  if (!selectedFiles.length || busy) return;
  persistApiBase();
  busy = true;
  refreshActionState();
  lastPages = [];
  const textParts: string[] = [];
  const multi = selectedFiles.length > 1;

  try {
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      if (!file) continue;
      setStatus(
        multi ? t("tanci.status.progressMulti").replace("{n}", String(i + 1)).replace("{total}", String(selectedFiles.length)) : t("tanci.status.progress"),
      );
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
    if (textEl) textEl.value = textParts.join("\n\n");
    setStatus(t("tanci.status.done"));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setStatus(`${t("tanci.status.fail")}: ${message}`);
  } finally {
    busy = false;
    refreshActionState();
  }
}

function buildYueyuExportPayload(): Record<string, unknown> {
  const fullText = textEl?.value.trim() ?? "";
  const lines = splitCorrectedLines(fullText);
  const pagePayloads =
    lastPages.length > 0
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
            blocks: [] as Array<{ text: string; confidence: number | null }>,
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
    note: "Corrected OCR text from Yueyu Detecting in-site Tanci panel (Talcne backend).",
  };
}

function exportYueyuJson(): void {
  const fullText = textEl?.value.trim() ?? "";
  if (!fullText) return;
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

function clearAll(): void {
  selectedFiles = [];
  lastPages = [];
  if (fileInput) fileInput.value = "";
  if (textEl) textEl.value = "";
  revokePreviews();
  renderPreviews();
  setStatus(t("tanci.ready"));
  refreshActionState();
}

function applyLocaleStrings(): void {
  if (statusEl && !busy) {
    const current = statusEl.textContent ?? "";
    const known = [
      t("tanci.ready"),
      t("tanci.status.done"),
      t("tanci.status.exported"),
    ];
    if (!current || known.some((k) => current === k) || current.startsWith("已") || current.startsWith("Ready") || current.startsWith("已就緒")) {
      /* keep operational messages; refresh idle ready only when empty-ish */
    }
  }
  renderPreviews();
  refreshActionState();
}

function initTanciPanel(): void {
  if (!apiInput || !fileInput || !recognizeBtn || !textEl) return;

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    apiInput.value = saved ? normalizeApiBase(saved) : DEFAULT_API;
  } catch {
    apiInput.value = DEFAULT_API;
  }

  apiInput.addEventListener("change", persistApiBase);
  apiInput.addEventListener("blur", persistApiBase);

  fileInput.addEventListener("change", () => {
    selectedFiles = Array.from(fileInput.files ?? []).filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif)$/i.test(f.name));
    renderPreviews();
    refreshActionState();
    setStatus(
      selectedFiles.length
        ? t("tanci.status.selected").replace("{n}", String(selectedFiles.length))
        : t("tanci.ready"),
    );
  });

  recognizeBtn.addEventListener("click", () => {
    void recognizeImages();
  });

  exportBtn?.addEventListener("click", exportYueyuJson);
  clearBtn?.addEventListener("click", clearAll);
  textEl.addEventListener("input", refreshActionState);

  onLocaleChange(() => {
    applyLocaleStrings();
  });

  renderPreviews();
  refreshActionState();
}

document.addEventListener("DOMContentLoaded", initTanciPanel);
