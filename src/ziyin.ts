/** Single-character drill: Mandarin pinyin + 上虞 / 诸暨 / 嵊州 (语保工程). */

interface ZiyinItem {
  han: string;
  pinyin: string;
  shangyu: string;
  zhuji: string;
  shengzhou: string;
  gloss?: string;
  tag?: string;
}

interface ZiyinFile {
  schemaVersion: string;
  script: string;
  note?: string;
  source?: string;
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
  const shangyuEl = requireEl(document.getElementById("ziyin-shangyu"), "ziyin-shangyu");
  const zhujiEl = requireEl(document.getElementById("ziyin-zhuji"), "ziyin-zhuji");
  const shengzhouEl = requireEl(document.getElementById("ziyin-shengzhou"), "ziyin-shengzhou");
  const glossEl = document.getElementById("ziyin-gloss");
  const glossRow = document.getElementById("ziyin-gloss-row");
  const tagEl = requireEl(document.getElementById("ziyin-tag"), "ziyin-tag");
  const statusEl = requireEl(document.getElementById("ziyin-status"), "ziyin-status");
  const noteEl = document.getElementById("ziyin-note");
  const sourceEl = document.getElementById("ziyin-source");
  const prevBtn = requireEl(document.getElementById("ziyin-prev"), "ziyin-prev") as HTMLButtonElement;
  const nextBtn = requireEl(document.getElementById("ziyin-next"), "ziyin-next") as HTMLButtonElement;
  const randomBtn = requireEl(document.getElementById("ziyin-random"), "ziyin-random") as HTMLButtonElement;

  const res = await fetch("data/learn/ziyin.json?v=20260810w");
  if (!res.ok) throw new Error(`ziyin HTTP ${res.status}`);
  const data = (await res.json()) as ZiyinFile;
  const items = data.items.filter((it) => it.han?.trim());
  if (!items.length) throw new Error("ziyin list empty");

  if (noteEl && data.note) noteEl.textContent = data.note;
  if (sourceEl && data.source) sourceEl.textContent = data.source;

  let index = 0;

  function paint(): void {
    const item = items[index];
    if (!item) return;
    hanEl.textContent = item.han;
    pinyinEl.textContent = item.pinyin;
    shangyuEl.textContent = item.shangyu;
    zhujiEl.textContent = item.zhuji;
    shengzhouEl.textContent = item.shengzhou;
    const gloss = item.gloss?.trim();
    if (glossEl) glossEl.textContent = gloss || "—";
    if (glossRow) glossRow.hidden = !gloss;
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
