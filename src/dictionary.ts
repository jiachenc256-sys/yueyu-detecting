import { onLocaleChange, t, tf, getLocale } from "./i18n.js";

interface ZiyinItem {
  han: string;
  shangyu?: string;
  zhuji?: string;
  shengzhou?: string;
  pinyin?: string;
  level?: number;
  tag?: string;
}

interface PhraseItem {
  id: string;
  zh: string;
  en: string;
  scene?: string;
  chars?: string[];
  note?: string;
}

let chars: ZiyinItem[] = [];
let phrases: PhraseItem[] = [];

function audioUrlFor(han: string): string {
  return `assets/learn/ziyin-audio/shengzhou/${encodeURIComponent(han)}.m4a`;
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function matchChar(item: ZiyinItem, q: string): boolean {
  if (!q) return item.level !== undefined && item.level <= 4;
  const n = normalize(q);
  return (
    item.han.includes(q) ||
    normalize(item.pinyin ?? "").includes(n) ||
    normalize(item.tag ?? "").includes(n) ||
    normalize(item.shangyu ?? "").includes(n) ||
    normalize(item.zhuji ?? "").includes(n) ||
    normalize(item.shengzhou ?? "").includes(n)
  );
}

function matchPhrase(item: PhraseItem, q: string): boolean {
  if (!q) return true;
  const n = normalize(q);
  return (
    item.zh.includes(q) ||
    normalize(item.en).includes(n) ||
    normalize(item.scene ?? "").includes(n) ||
    normalize(item.note ?? "").includes(n) ||
    (item.chars ?? []).some((c) => c.includes(q))
  );
}

function renderChars(list: ZiyinItem[]): void {
  const root = document.getElementById("dict-chars");
  if (!root) return;
  root.innerHTML = "";
  const limited = list.slice(0, 40);
  if (!limited.length) {
    root.innerHTML = `<p class="dict-empty">${t("dict.emptyChars")}</p>`;
    return;
  }
  for (const item of limited) {
    const card = document.createElement("article");
    card.className = "dict-card";
    card.innerHTML = `
      <div class="dict-card__head">
        <span class="dict-card__han">${item.han}</span>
        <span class="dict-card__meta">${item.pinyin ?? ""} · L${item.level ?? "—"}</span>
      </div>
      <dl class="dict-card__ipa">
        <div><dt>${t("dict.placeShangyu")}</dt><dd>${item.shangyu ?? "—"}</dd></div>
        <div><dt>${t("dict.placeZhuji")}</dt><dd>${item.zhuji ?? "—"}</dd></div>
        <div><dt>${t("dict.placeShengzhou")}</dt><dd>${item.shengzhou ?? "—"}</dd></div>
      </dl>
      <button type="button" class="speak-btn dict-card__play" data-dict-audio="${audioUrlFor(item.han)}">${t("dict.playShengzhou")}</button>
    `;
    root.append(card);
  }
  root.querySelectorAll<HTMLButtonElement>("[data-dict-audio]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const url = btn.dataset.dictAudio;
      if (!url) return;
      const audio = new Audio(url);
      void audio.play().catch(() => {
        const status = document.getElementById("dict-status");
        if (status) status.textContent = t("dict.audioFail");
      });
    });
  });
}

function renderPhrases(list: PhraseItem[]): void {
  const root = document.getElementById("dict-phrases");
  if (!root) return;
  root.innerHTML = "";
  const limited = list.slice(0, 40);
  if (!limited.length) {
    root.innerHTML = `<p class="dict-empty">${t("dict.emptyPhrases")}</p>`;
    return;
  }
  const locale = getLocale();
  for (const item of limited) {
    const card = document.createElement("article");
    card.className = "dict-card dict-card--phrase";
    const scene = item.scene ? `<span class="dict-card__scene">${item.scene}</span>` : "";
    const note = item.note ? `<p class="dict-card__note">${item.note}</p>` : "";
    const en = locale === "zh-Hans" || locale === "zh-Hant" ? item.en : item.en;
    card.innerHTML = `
      <div class="dict-card__head">
        <span class="dict-card__han dict-card__han--phrase">${item.zh}</span>
        ${scene}
      </div>
      <p class="dict-card__en">${en}</p>
      ${note}
    `;
    root.append(card);
  }
}

function applyQuery(): void {
  const input = document.getElementById("dict-query") as HTMLInputElement | null;
  const q = input?.value ?? "";
  const status = document.getElementById("dict-status");
  const charHits = chars.filter((c) => (c.level ?? 99) <= 4 && matchChar(c, q));
  const phraseHits = phrases.filter((p) => matchPhrase(p, q));
  renderChars(charHits);
  renderPhrases(phraseHits);
  if (status) {
    status.textContent = tf("dict.status", { chars: charHits.length, phrases: phraseHits.length });
  }
}

async function boot(): Promise<void> {
  const [ziyinRes, phraseRes] = await Promise.all([
    fetch("data/learn/ziyin.json"),
    fetch("data/dictionary/phrases.json"),
  ]);
  if (!ziyinRes.ok) throw new Error(`ziyin HTTP ${ziyinRes.status}`);
  if (!phraseRes.ok) throw new Error(`phrases HTTP ${phraseRes.status}`);
  const ziyin = (await ziyinRes.json()) as { items?: ZiyinItem[] };
  const phraseDoc = (await phraseRes.json()) as { items?: PhraseItem[] };
  chars = ziyin.items ?? [];
  phrases = phraseDoc.items ?? [];
  applyQuery();
}

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("dict-query") as HTMLInputElement | null;
  input?.addEventListener("input", () => applyQuery());
  onLocaleChange(() => applyQuery());
  void boot().catch((error) => {
    const status = document.getElementById("dict-status");
    if (status) status.textContent = error instanceof Error ? error.message : String(error);
  });
});
