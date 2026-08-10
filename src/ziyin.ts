/** Single-character drill: Mandarin pinyin + 上虞 / 诸暨 / 嵊州, by level. */

interface ZiyinItem {
  han: string;
  pinyin: string;
  shangyu: string;
  zhuji: string;
  shengzhou: string;
  level?: number;
  gloss?: string;
  tag?: string;
}

interface ZiyinLevelMeta {
  id: number;
  name: string;
  nameHant?: string;
  nameEn?: string;
}

interface ZiyinFile {
  schemaVersion: string;
  script: string;
  note?: string;
  levels?: ZiyinLevelMeta[];
  items: ZiyinItem[];
}

function requireEl<T extends Element>(el: T | null, name: string): T {
  if (!el) throw new Error(`Missing element: ${name}`);
  return el;
}

function openLearnSection(target: string): void {
  const link = document.querySelector<HTMLButtonElement>(`[data-learn-target="${target}"]`);
  link?.click();
}

async function initZiyin(): Promise<void> {
  const stage = document.getElementById("ziyin-stage");
  if (!stage) return;

  const hanEl = requireEl(document.getElementById("ziyin-han"), "ziyin-han");
  const pinyinEl = requireEl(document.getElementById("ziyin-pinyin"), "ziyin-pinyin");
  const shangyuEl = requireEl(document.getElementById("ziyin-shangyu"), "ziyin-shangyu");
  const zhujiEl = requireEl(document.getElementById("ziyin-zhuji"), "ziyin-zhuji");
  const shengzhouEl = requireEl(document.getElementById("ziyin-shengzhou"), "ziyin-shengzhou");
  const glossEl = document.getElementById("ziyin-gloss");
  const glossRow = document.getElementById("ziyin-gloss-row");
  const tagEl = requireEl(document.getElementById("ziyin-tag"), "ziyin-tag");
  const statusEl = requireEl(document.getElementById("ziyin-status"), "ziyin-status");
  const noteEl = document.getElementById("ziyin-note");
  const levelNameEl = document.getElementById("ziyin-level-name");
  const levelButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-ziyin-level]"));
  const prevBtn = requireEl(document.getElementById("ziyin-prev"), "ziyin-prev") as HTMLButtonElement;
  const nextBtn = requireEl(document.getElementById("ziyin-next"), "ziyin-next") as HTMLButtonElement;
  const randomBtn = requireEl(document.getElementById("ziyin-random"), "ziyin-random") as HTMLButtonElement;
  const startBtn = document.getElementById("learn-start-fayin") as HTMLButtonElement | null;

  const res = await fetch("data/learn/ziyin.json?v=20260811a");
  if (!res.ok) throw new Error(`ziyin HTTP ${res.status}`);
  const data = (await res.json()) as ZiyinFile;
  const allItems = data.items.filter((it) => it.han?.trim());
  if (!allItems.length) throw new Error("ziyin list empty");

  if (noteEl && data.note) noteEl.textContent = data.note;

  const levelsMeta = data.levels ?? [];
  let level = 1;
  let pool = allItems.filter((it) => (it.level ?? 1) === level);
  if (!pool.length) pool = allItems;
  let index = 0;

  function levelLabel(lv: number): string {
    const meta = levelsMeta.find((m) => m.id === lv);
    const lang = document.documentElement.lang || "zh-Hans";
    if (!meta) return `第${lv}阶`;
    if (lang === "en") return meta.nameEn ?? meta.name;
    if (lang === "zh-Hant") return meta.nameHant ?? meta.name;
    return meta.name;
  }

  function setLevel(next: number, resetIndex = true): void {
    level = next;
    pool = allItems.filter((it) => (it.level ?? 1) === level);
    if (!pool.length) pool = allItems;
    if (resetIndex) index = 0;
    else index = Math.min(index, Math.max(0, pool.length - 1));
    levelButtons.forEach((btn) => {
      const lv = Number(btn.dataset.ziyinLevel);
      btn.setAttribute("aria-pressed", lv === level ? "true" : "false");
    });
    if (levelNameEl) levelNameEl.textContent = levelLabel(level);
    paint();
  }

  function paint(): void {
    const item = pool[index];
    if (!item) {
      statusEl.textContent = `0 / 0 · ${levelLabel(level)}`;
      return;
    }
    hanEl.textContent = item.han;
    pinyinEl.textContent = item.pinyin;
    shangyuEl.textContent = item.shangyu;
    zhujiEl.textContent = item.zhuji;
    shengzhouEl.textContent = item.shengzhou;
    const gloss = item.gloss?.trim();
    if (glossEl) glossEl.textContent = gloss || "—";
    if (glossRow) glossRow.hidden = !gloss;
    tagEl.textContent = item.tag?.trim() || levelLabel(level);
    tagEl.hidden = false;
    statusEl.textContent = `${index + 1} / ${pool.length} · ${levelLabel(level)}`;
    prevBtn.disabled = pool.length <= 1;
    nextBtn.disabled = pool.length <= 1;
    randomBtn.disabled = pool.length <= 1;
  }

  levelButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const lv = Number(btn.dataset.ziyinLevel);
      if (!Number.isFinite(lv)) return;
      setLevel(lv, true);
    });
  });

  prevBtn.addEventListener("click", () => {
    if (!pool.length) return;
    index = (index - 1 + pool.length) % pool.length;
    paint();
  });
  nextBtn.addEventListener("click", () => {
    if (!pool.length) return;
    index = (index + 1) % pool.length;
    paint();
  });
  randomBtn.addEventListener("click", () => {
    if (pool.length < 2) return;
    let next = index;
    while (next === index) next = Math.floor(Math.random() * pool.length);
    index = next;
    paint();
  });

  startBtn?.addEventListener("click", () => {
    openLearnSection("fayin");
    setLevel(1, true);
    stage.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // Locale switch may change level name language.
  const observer = new MutationObserver(() => {
    if (levelNameEl) levelNameEl.textContent = levelLabel(level);
    statusEl.textContent = pool.length
      ? `${index + 1} / ${pool.length} · ${levelLabel(level)}`
      : `0 / 0 · ${levelLabel(level)}`;
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

  setLevel(1, true);
  stage.removeAttribute("hidden");
}

document.addEventListener("DOMContentLoaded", () => {
  void initZiyin().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    const status = document.getElementById("ziyin-status");
    if (status) status.textContent = `加载失败：${message}`;
  });
});
