import { onLocaleChange, t, tf, getLocale } from "./i18n.js";

declare global {
  interface Window {
    __yueyuOpenDictionaryQuery?: (q: string) => void;
    __yueyuActivatePanel?: (target: string) => void;
  }
}

interface ZiyinItem {
  han: string;
  shangyu?: string;
  zhuji?: string;
  shengzhou?: string;
  pinyin?: string;
  level?: number;
  tag?: string;
}

interface BookChar {
  id: string;
  han: string;
  hanDisplay: string;
  sense?: string | null;
  rhyme: string;
  oldMale: string;
  youngMale: string;
}

interface DictChar extends BookChar {
  shangyu?: string;
  zhuji?: string;
  pinyin?: string;
  level?: number;
}

interface PhraseItem {
  id: string;
  zh: string;
  reading?: string;
  en: string;
  scene?: string;
  category?: string;
  part?: string;
  chars?: string[];
  note?: string;
  source?: string;
}

interface ArchiveHit {
  pieceId: string;
  cueId: string | number;
  title?: string;
  snippet?: string;
}

const BOOK_SCENES = [
  "",
  "astronomy",
  "time",
  "plant",
  "animal",
  "house",
  "food",
  "body",
  "ritual",
  "people",
  "work",
  "action",
  "quality",
  "number",
  "particle",
] as const;

let chars: DictChar[] = [];
let phrases: PhraseItem[] = [];
let archiveByChar: Record<string, ArchiveHit[]> = {};
let tradToHans: Record<string, string> = {};
let audioHans = new Set<string>();
let activeScene = "";
let sceneLabels: Record<string, Record<string, string>> = {};
let dictReady = false;
let pendingQuery: string | null = null;
let highlightQuery = "";

function audioUrlFor(han: string): string {
  return `assets/learn/ziyin-audio/shengzhou/${encodeURIComponent(han)}.m4a`;
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

/** Tone-insensitive pinyin: strip marks + trailing 1–5. */
function stripPinyin(s: string): string {
  return normalize(s)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ü/g, "v")
    .replace(/[1-5]/g, "");
}

function queryVariants(q: string): string[] {
  const raw = q.trim();
  if (!raw) return [];
  const out = new Set<string>([raw, normalize(raw), stripPinyin(raw)]);
  let hans = "";
  for (const ch of raw) {
    hans += tradToHans[ch] ?? ch;
  }
  if (hans !== raw) {
    out.add(hans);
    out.add(normalize(hans));
    out.add(stripPinyin(hans));
  }
  return [...out].filter(Boolean);
}

function matchChar(item: DictChar, q: string): boolean {
  if (!q) return true;
  const variants = queryVariants(q);
  const pin = stripPinyin(item.pinyin ?? "");
  return variants.some(
    (v) =>
      item.han.includes(v) ||
      item.hanDisplay.includes(v) ||
      pin.includes(stripPinyin(v)) ||
      normalize(item.rhyme).includes(normalize(v)) ||
      normalize(item.oldMale).includes(normalize(v)) ||
      normalize(item.youngMale).includes(normalize(v)) ||
      normalize(item.shangyu ?? "").includes(normalize(v)) ||
      normalize(item.zhuji ?? "").includes(normalize(v)) ||
      normalize(item.sense ?? "").includes(normalize(v)),
  );
}

function matchPhrase(item: PhraseItem, q: string): boolean {
  if (!q) return true;
  const variants = queryVariants(q);
  return variants.some(
    (v) =>
      item.zh.includes(v) ||
      normalize(item.reading ?? "").includes(normalize(v)) ||
      normalize(item.en).includes(normalize(v)) ||
      normalize(item.scene ?? "").includes(normalize(v)) ||
      normalize(item.category ?? "").includes(normalize(v)) ||
      normalize(item.note ?? "").includes(normalize(v)) ||
      (item.chars ?? []).some((c) => c.includes(v) || (tradToHans[v] && c.includes(tradToHans[v]!))),
  );
}

function relatedPhrases(han: string): PhraseItem[] {
  return phrases.filter((p) => (p.chars ?? []).includes(han) || p.zh.includes(han)).slice(0, 3);
}

function archiveHits(han: string): ArchiveHit[] {
  return (archiveByChar[han] ?? []).slice(0, 5);
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function sceneLabel(scene: string): string {
  if (!scene) return t("dict.sceneAll");
  const loc = getLocale();
  const fromMap = sceneLabels[loc]?.[scene] ?? sceneLabels["zh-Hans"]?.[scene];
  if (fromMap) return fromMap;
  const key = `dict.scene.${scene}`;
  const labeled = t(key);
  return labeled === key ? scene : labeled;
}

function availableScenes(): string[] {
  const present = new Set(phrases.map((p) => p.scene).filter(Boolean) as string[]);
  return BOOK_SCENES.filter((s) => s === "" || present.has(s));
}

function renderSceneChips(): void {
  const root = document.getElementById("dict-scene-filters");
  if (!root) return;
  root.innerHTML = "";
  for (const scene of availableScenes()) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dict-scene-chip";
    btn.dataset.dictScene = scene;
    btn.setAttribute("aria-pressed", scene === activeScene ? "true" : "false");
    btn.textContent = sceneLabel(scene);
    btn.addEventListener("click", () => {
      activeScene = scene;
      renderSceneChips();
      applyQuery();
    });
    root.append(btn);
  }
}

function renderChars(list: DictChar[]): void {
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
    const exact = Boolean(highlightQuery) && (item.han === highlightQuery || item.hanDisplay === highlightQuery);
    card.className = exact ? "dict-card dict-card--focus" : "dict-card";
    if (exact) card.dataset.dictFocus = "1";
    const related = relatedPhrases(item.han);
    const hits = archiveHits(item.han);
    const hasAudio = audioHans.has(item.han);
    const relatedHtml = related.length
      ? `<div class="dict-card__related">
          <p class="dict-card__related-label">${t("dict.relatedPhrases")} · ${tf("dict.phraseCount", { n: related.length })}</p>
          <ul>${related
            .map(
              (p) =>
                `<li><button type="button" class="dict-link" data-dict-fill="${escapeHtml(p.zh)}">${escapeHtml(p.zh)}</button></li>`,
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
    const playBtn = hasAudio
      ? `<button type="button" class="speak-btn dict-card__play" data-dict-audio="${audioUrlFor(item.han)}">${t("dict.playShengzhou")}</button>`
      : `<button type="button" class="speak-btn dict-card__play" disabled title="${escapeHtml(t("dict.audioMissing"))}">${t("dict.audioMissing")}</button>`;
    const metaBits = [item.pinyin, item.rhyme].filter(Boolean).join(" · ");
    card.innerHTML = `
      <div class="dict-card__head">
        <span class="dict-card__han">${escapeHtml(item.hanDisplay || item.han)}</span>
        <span class="dict-card__meta">${escapeHtml(metaBits)}</span>
      </div>
      <dl class="dict-card__ipa">
        <div><dt>${t("dict.oldMale")}</dt><dd>${escapeHtml(item.oldMale || "—")}</dd></div>
        <div><dt>${t("dict.youngMale")}</dt><dd>${escapeHtml(item.youngMale || "—")}</dd></div>
        <div><dt>${t("dict.placeShangyu")}</dt><dd>${escapeHtml(item.shangyu ?? "—")}</dd></div>
        <div><dt>${t("dict.placeZhuji")}</dt><dd>${escapeHtml(item.zhuji ?? "—")}</dd></div>
      </dl>
      ${playBtn}
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
  bindFillLinks(root);
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
    const exact = Boolean(highlightQuery) && item.zh === highlightQuery;
    card.className = exact ? "dict-card dict-card--phrase dict-card--focus" : "dict-card dict-card--phrase";
    if (exact) card.dataset.dictFocus = "1";
    const scene = item.scene
      ? `<span class="dict-card__scene">${escapeHtml(sceneLabel(item.scene))}</span>`
      : "";
    const reading = item.reading
      ? `<p class="dict-card__reading">${escapeHtml(item.reading)}</p>`
      : "";
    const en = item.en ? `<p class="dict-card__en">${escapeHtml(item.en)}</p>` : "";
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
      ${reading}
      ${en}
      ${note}
      ${charLinks ? `<p class="dict-card__chars">${charLinks}</p>` : ""}
    `;
    root.append(card);
  }
  bindFillLinks(root);
}

function bindFillLinks(root: HTMLElement): void {
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

function applyQuery(opts?: { scrollFocus?: boolean }): void {
  const input = document.getElementById("dict-query") as HTMLInputElement | null;
  const q = input?.value ?? "";
  const prefer = highlightQuery || q.trim();
  const status = document.getElementById("dict-status");
  const charHits = chars.filter((c) => matchChar(c, q));
  const phraseHits = phrases.filter((p) => {
    if (activeScene && p.scene !== activeScene) return false;
    return matchPhrase(p, q);
  });
  if (prefer) {
    charHits.sort(
      (a, b) =>
        Number(b.han === prefer || b.hanDisplay === prefer) - Number(a.han === prefer || a.hanDisplay === prefer),
    );
    phraseHits.sort((a, b) => Number(b.zh === prefer) - Number(a.zh === prefer));
  }
  renderChars(charHits);
  renderPhrases(phraseHits);
  if (status) {
    status.textContent = tf("dict.status", { chars: charHits.length, phrases: phraseHits.length });
  }
  if (opts?.scrollFocus) {
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(".dict-card--focus")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  }
}

/** Open dictionary panel search for a headword / phrase (e.g. from IPA primer links). */
export function openDictionaryQuery(q: string): void {
  const query = q.trim();
  if (!query) return;
  highlightQuery = query;
  pendingQuery = query;
  activeScene = "";

  const input = document.getElementById("dict-query") as HTMLInputElement | null;
  if (input) input.value = query;

  history.replaceState(null, "", `#dict-q-${encodeURIComponent(query)}`);
  // Dictionary is no longer in the top nav — use shared panel activator.
  if (typeof window.__yueyuActivatePanel === "function") {
    window.__yueyuActivatePanel("dictionary");
  } else {
    document.querySelectorAll<HTMLElement>("[data-panel]").forEach((panel) => {
      panel.setAttribute("aria-hidden", panel.dataset.panel === "dictionary" ? "false" : "true");
    });
    document.querySelectorAll<HTMLElement>(".site-nav [data-panel-target]").forEach((b) => {
      if (b.dataset.panelTarget === "language") b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
  }

  if (!dictReady) return;
  pendingQuery = null;
  renderSceneChips();
  applyQuery({ scrollFocus: true });
}

function bindPrimerDictLinks(): void {
  document.querySelectorAll<HTMLElement>("[data-dict-open]").forEach((el) => {
    if (el.dataset.dictOpenBound === "1") return;
    el.dataset.dictOpenBound = "1";
    el.addEventListener("click", (event) => {
      event.preventDefault();
      const q = el.dataset.dictOpen ?? "";
      openDictionaryQuery(q);
    });
  });
}

let ipaAudio: HTMLAudioElement | null = null;

function playIpaChar(han: string, btn?: HTMLButtonElement): void {
  const ch = han.trim();
  if (!ch) return;
  if (!audioHans.has(ch)) {
    const status = document.getElementById("dict-status");
    // Prefer a brief flash on the button title; status only if on dictionary.
    if (btn) btn.title = t("learn.ipa.listenFail");
    return;
  }
  if (ipaAudio) {
    ipaAudio.pause();
    ipaAudio = null;
  }
  const audio = new Audio(audioUrlFor(ch));
  ipaAudio = audio;
  void audio.play().catch(() => {
    if (btn) btn.title = t("learn.ipa.listenFail");
  });
}

function bindIpaAudioButtons(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-ipa-audio]").forEach((btn) => {
    if (btn.dataset.ipaAudioBound === "1") return;
    btn.dataset.ipaAudioBound = "1";
    // Disable if we already know the index and clip is missing (after boot).
    const han = btn.dataset.ipaAudio ?? "";
    if (dictReady && han && !audioHans.has(han)) {
      btn.disabled = true;
      btn.title = t("learn.ipa.listenFail");
    }
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      playIpaChar(btn.dataset.ipaAudio ?? "", btn);
    });
  });
}

function refreshIpaAudioAvailability(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-ipa-audio]").forEach((btn) => {
    const han = btn.dataset.ipaAudio ?? "";
    if (!han) return;
    const ok = audioHans.has(han);
    btn.disabled = !ok;
    btn.title = ok ? `${t("learn.ipa.listen")}「${han}」` : t("learn.ipa.listenFail");
  });
}

function mergeBookChars(book: BookChar[], ziyin: ZiyinItem[]): DictChar[] {
  const byHan = new Map<string, ZiyinItem>();
  for (const z of ziyin) {
    if (!byHan.has(z.han)) byHan.set(z.han, z);
  }
  return book.map((b) => {
    const z = byHan.get(b.han);
    const out: DictChar = { ...b };
    if (z?.shangyu) out.shangyu = z.shangyu;
    if (z?.zhuji) out.zhuji = z.zhuji;
    if (z?.pinyin) out.pinyin = z.pinyin;
    if (z?.level !== undefined) out.level = z.level;
    return out;
  });
}

async function boot(): Promise<void> {
  const [bookCharRes, phraseRes, ziyinRes, archiveRes, tradRes, audioRes, sceneRes] = await Promise.all([
    fetch("data/dictionary/shengzhou-chars.json"),
    fetch("data/dictionary/shengzhou-phrases.json"),
    fetch("data/learn/ziyin.json"),
    fetch("data/dictionary/char-archive-index.json"),
    fetch("data/dictionary/trad-to-hans.json"),
    fetch("data/dictionary/shengzhou-audio-hans.json"),
    fetch("data/dictionary/shengzhou-phrase-scenes.json"),
  ]);
  if (!bookCharRes.ok) throw new Error(`shengzhou-chars HTTP ${bookCharRes.status}`);
  if (!phraseRes.ok) throw new Error(`shengzhou-phrases HTTP ${phraseRes.status}`);

  const bookDoc = (await bookCharRes.json()) as { items?: BookChar[] };
  const phraseDoc = (await phraseRes.json()) as { items?: PhraseItem[] };
  const ziyin = ziyinRes.ok ? ((await ziyinRes.json()) as { items?: ZiyinItem[] }) : { items: [] };
  chars = mergeBookChars(bookDoc.items ?? [], ziyin.items ?? []);
  phrases = phraseDoc.items ?? [];

  if (sceneRes.ok) {
    const sceneDoc = (await sceneRes.json()) as { labels?: Record<string, Record<string, string>> };
    sceneLabels = sceneDoc.labels ?? {};
  }
  if (archiveRes.ok) {
    const archiveDoc = (await archiveRes.json()) as { chars?: Record<string, ArchiveHit[]> };
    archiveByChar = archiveDoc.chars ?? {};
  }
  if (tradRes.ok) {
    const tradDoc = (await tradRes.json()) as { map?: Record<string, string> };
    tradToHans = tradDoc.map ?? {};
  }
  if (audioRes.ok) {
    const audioDoc = (await audioRes.json()) as { hans?: string[] };
    audioHans = new Set(audioDoc.hans ?? []);
  }
  renderSceneChips();
  dictReady = true;
  refreshIpaAudioAvailability();
  if (pendingQuery) {
    const q = pendingQuery;
    pendingQuery = null;
    highlightQuery = q;
    const input = document.getElementById("dict-query") as HTMLInputElement | null;
    if (input) input.value = q;
    applyQuery({ scrollFocus: true });
  } else {
    applyQuery();
  }
}

window.__yueyuOpenDictionaryQuery = openDictionaryQuery;

document.addEventListener("DOMContentLoaded", () => {
  bindPrimerDictLinks();
  bindIpaAudioButtons();
  const input = document.getElementById("dict-query") as HTMLInputElement | null;
  input?.addEventListener("input", () => {
    highlightQuery = "";
    applyQuery();
  });
  onLocaleChange(() => {
    renderSceneChips();
    applyQuery();
    bindPrimerDictLinks();
    bindIpaAudioButtons();
    refreshIpaAudioAvailability();
  });
  void boot().catch((error) => {
    const status = document.getElementById("dict-status");
    if (status) status.textContent = error instanceof Error ? error.message : String(error);
  });
});
