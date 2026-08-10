/** Single-character pronunciation drill (字音) for Mandarin-pinyin learners. */

interface ZiyinItem {
  han: string;
  pinyin: string;
  yueyu: string;
  gloss?: string;
  tag?: string;
}

interface ZiyinFile {
  schemaVersion: string;
  script: string;
  note?: string;
  items: ZiyinItem[];
}

function requireEl<T extends Element>(el: T | null, name: string): T {
  if (!el) throw new Error(`Missing element: ${name}`);
  return el;
}

async function initZiyin(): Promise<void> {
  const stage = document.getElementById("ziyin-stage");
  if (!stage) return;

  const hanEl = requireEl(document.getElementById("ziyin-han"), "ziyin-han");
  const pinyinEl = requireEl(document.getElementById("ziyin-pinyin"), "ziyin-pinyin");
  const yueyuEl = requireEl(document.getElementById("ziyin-yueyu"), "ziyin-yueyu");
  const glossEl = requireEl(document.getElementById("ziyin-gloss"), "ziyin-gloss");
  const tagEl = requireEl(document.getElementById("ziyin-tag"), "ziyin-tag");
  const statusEl = requireEl(document.getElementById("ziyin-status"), "ziyin-status");
  const noteEl = document.getElementById("ziyin-note");
  const prevBtn = requireEl(document.getElementById("ziyin-prev"), "ziyin-prev") as HTMLButtonElement;
  const nextBtn = requireEl(document.getElementById("ziyin-next"), "ziyin-next") as HTMLButtonElement;
  const randomBtn = requireEl(document.getElementById("ziyin-random"), "ziyin-random") as HTMLButtonElement;

  // Bust CDN/browser cache when the curated list changes (keep in sync with index.html ?v=).
  const res = await fetch("data/learn/ziyin.json?v=20260810v");
  if (!res.ok) throw new Error(`ziyin HTTP ${res.status}`);
  const data = (await res.json()) as ZiyinFile;
  const items = data.items.filter((it) => it.han?.trim());
  if (!items.length) throw new Error("ziyin list empty");

  if (noteEl && data.note) noteEl.textContent = data.note;

  let index = 0;

  function paint(): void {
    const item = items[index];
    if (!item) return;
    hanEl.textContent = item.han;
    pinyinEl.textContent = item.pinyin;
    yueyuEl.textContent = item.yueyu;
    glossEl.textContent = item.gloss?.trim() || "—";
    tagEl.textContent = item.tag?.trim() || "";
    tagEl.hidden = !item.tag?.trim();
    statusEl.textContent = `${index + 1} / ${items.length}`;
    prevBtn.disabled = items.length <= 1;
    nextBtn.disabled = items.length <= 1;
    randomBtn.disabled = items.length <= 1;
  }

  prevBtn.addEventListener("click", () => {
    index = (index - 1 + items.length) % items.length;
    paint();
  });
  nextBtn.addEventListener("click", () => {
    index = (index + 1) % items.length;
    paint();
  });
  randomBtn.addEventListener("click", () => {
    if (items.length < 2) return;
    let next = index;
    while (next === index) next = Math.floor(Math.random() * items.length);
    index = next;
    paint();
  });

  paint();
  stage.removeAttribute("hidden");
}

document.addEventListener("DOMContentLoaded", () => {
  void initZiyin().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    const status = document.getElementById("ziyin-status");
    if (status) status.textContent = `加载失败：${message}`;
  });
});
