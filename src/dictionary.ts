import { onLocaleChange, t, tf } from "./i18n.js";

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

interface ArchiveHit {
  pieceId: string;
  cueId: string | number;
  title?: string;
  snippet?: string;
}

let chars: ZiyinItem[] = [];
let phrases: PhraseItem[] = [];
let archiveByChar: Record<string, ArchiveHit[]> = {};

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

function relatedPhrases(han: string): PhraseItem[] {
  return phrases.filter((p) => (p.chars ?? []).includes(han) || p.zh.includes(han)).slice(0, 3);
}

function archiveHits(han: string): ArchiveHit[] {
  return (archiveByChar[han] ?? []).slice(0, 3);
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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
    const related = relatedPhrases(item.han);
    const hits = archiveHits(item.han);
    const relatedHtml = related.length
      ? `<div class="dict-card__related">
          <p class="dict-card__related-label">${t("dict.relatedPhrases")} · ${tf("dict.phraseCount", { n: related.length })}</p>
          <ul>${related
            .map(
              (p) =>
                `<li><button type="button" class="dict-link" data-dict-fill="${escapeHtml(p.zh)}">${escapeHtml(p.zh)}</button> <span class="dict-card__en-inline">${escapeHtml(p.en)}</span></li>`,
            )
            .join("")}</ul>
        </div>`
      : "";
    const archiveHtml = hits.length
      ? `<div class="dict-card__archive">
          <p class="dict-card__related-label">${t("dict.archiveExamples")} · ${tf("dict.archiveCount", { n: hits.length })}</p>
          <ul>${hits
            .map((h) => {
              const href = `pieces/${encodeURIComponent(h.pieceId)}.html#cue-${encodeURIComponent(String(h.cueId))}`;
              const label = escapeHtml(h.title || h.pieceId);
              const snip = escapeHtml(h.snippet || "");
              return `<li><a class="dict-link" href="${href}">${label}</a>${snip ? `<span class="dict-card__snip">「${snip}」</span>` : ""}</li>`;
            })
            .join("")}</ul>
        </div>`
      : "";
    card.innerHTML = `
      <div class="dict-card__head">
        <span class="dict-card__han">${escapeHtml(item.han)}</span>
        <span class="dict-card__meta">${escapeHtml(item.pinyin ?? "")} · L${item.level ?? "—"}</span>
      </div>
      <dl class="dict-card__ipa">
        <div><dt>${t("dict.placeShangyu")}</dt><dd>${escapeHtml(item.shangyu ?? "—")}</dd></div>
        <div><dt>${t("dict.placeZhuji")}</dt><dd>${escapeHtml(item.zhuji ?? "—")}</dd></div>
        <div><dt>${t("dict.placeShengzhou")}</dt><dd>${escapeHtml(item.shengzhou ?? "—")}</dd></div>
      </dl>
      <button type="button" class="speak-btn dict-card__play" data-dict-audio="${audioUrlFor(item.han)}">${t("dict.playShengzhou")}</button>
      ${relatedHtml}
      ${archiveHtml}
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
  root.querySelectorAll<HTMLButtonElement>("[data-dict-fill]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = document.getElementById("dict-query") as HTMLInputElement | null;
      if (!input) return;
      input.value = btn.dataset.dictFill ?? "";
      applyQuery();
      input.focus();
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
  for (const item of limited) {
    const card = document.createElement("article");
    card.className = "dict-card dict-card--phrase";
    const scene = item.scene ? `<span class="dict-card__scene">${escapeHtml(item.scene)}</span>` : "";
    const note = item.note ? `<p class="dict-card__note">${escapeHtml(item.note)}</p>` : "";
    const charLinks = (item.chars ?? [])
      .slice(0, 8)
      .map((c) => `<button type="button" class="dict-link dict-link--char" data-dict-fill="${escapeHtml(c)}">${escapeHtml(c)}</button>`)
      .join(" ");
    card.innerHTML = `
      <div class="dict-card__head">
        <span class="dict-card__han dict-card__han--phrase">${escapeHtml(item.zh)}</span>
        ${scene}
      </div>
      <p class="dict-card__en">${escapeHtml(item.en)}</p>
      ${note}
      ${charLinks ? `<p class="dict-card__chars">${charLinks}</p>` : ""}
    `;
    root.append(card);
  }
  root.querySelectorAll<HTMLButtonElement>("[data-dict-fill]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = document.getElementById("dict-query") as HTMLInputElement | null;
      if (!input) return;
      input.value = btn.dataset.dictFill ?? "";
      applyQuery();
      input.focus();
    });
  });
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
  const [ziyinRes, phraseRes, archiveRes] = await Promise.all([
    fetch("data/learn/ziyin.json"),
    fetch("data/dictionary/phrases.json"),
    fetch("data/dictionary/char-archive-index.json"),
  ]);
  if (!ziyinRes.ok) throw new Error(`ziyin HTTP ${ziyinRes.status}`);
  if (!phraseRes.ok) throw new Error(`phrases HTTP ${phraseRes.status}`);
  const ziyin = (await ziyinRes.json()) as { items?: ZiyinItem[] };
  const phraseDoc = (await phraseRes.json()) as { items?: PhraseItem[] };
  chars = ziyin.items ?? [];
  phrases = phraseDoc.items ?? [];
  if (archiveRes.ok) {
    const archiveDoc = (await archiveRes.json()) as { chars?: Record<string, ArchiveHit[]> };
    archiveByChar = archiveDoc.chars ?? {};
  }
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
