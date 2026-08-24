/** Single-character drill (L1–4) + Level 5 reveal flashcards; Shengzhou speaker audio only. */

import { onLocaleChange, t, tf } from "./i18n.js";

type ZiyinPlace = "shengzhou";

interface ZiyinAudio {
  shangyu?: string;
  zhuji?: string;
  shengzhou?: string;
  speaker?: string;
}

interface ZiyinItem {
  han: string;
  pinyin: string;
  shangyu: string;
  zhuji: string;
  shengzhou: string;
  level?: number;
  gloss?: string;
  tag?: string;
  audio?: ZiyinAudio;
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
  const link = document.querySelector<HTMLButtonElement>(
    `.learn-nav__link[data-learn-target="${target}"]`,
  );
  link?.click();
}

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = arr[i] as T;
    const b = arr[j] as T;
    arr[i] = b;
    arr[j] = a;
  }
}

/** Explicit path in JSON, else convention: assets/learn/ziyin-audio/shengzhou/<han>.m4a */
function resolveAudioUrl(item: ZiyinItem, place: ZiyinPlace): string | null {
  const explicit = item.audio?.[place]?.trim();
  if (explicit) return explicit;
  const han = item.han?.trim();
  if (!han) return null;
  return `assets/learn/ziyin-audio/${place}/${han}.m4a`;
}

async function audioExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD", cache: "no-cache" });
    if (res.ok) return true;
    if (res.status === 405 || res.status === 501) {
      const get = await fetch(url, { method: "GET", headers: { Range: "bytes=0-0" }, cache: "no-cache" });
      return get.ok || get.status === 206;
    }
    return false;
  } catch {
    return false;
  }
}

async function initZiyin(): Promise<void> {
  const stage = document.getElementById("ziyin-stage");
  if (!stage) return;

  const drillEl = requireEl(document.getElementById("ziyin-drill"), "ziyin-drill");
  const flashEl = requireEl(document.getElementById("ziyin-flash"), "ziyin-flash");
  const flashCard = requireEl(document.getElementById("ziyin-flash-card"), "ziyin-flash-card");
  const modeNoteEl = document.getElementById("ziyin-mode-note");

  const hanEl = requireEl(document.getElementById("ziyin-han"), "ziyin-han");
  const pinyinEl = requireEl(document.getElementById("ziyin-pinyin"), "ziyin-pinyin");
  const shangyuEl = requireEl(document.getElementById("ziyin-shangyu"), "ziyin-shangyu");
  const zhujiEl = requireEl(document.getElementById("ziyin-zhuji"), "ziyin-zhuji");
  const shengzhouEl = requireEl(document.getElementById("ziyin-shengzhou"), "ziyin-shengzhou");
  const glossEl = document.getElementById("ziyin-gloss");
  const glossRow = document.getElementById("ziyin-gloss-row");
  const speakerEl = document.getElementById("ziyin-speaker");
  const tagEl = requireEl(document.getElementById("ziyin-tag"), "ziyin-tag");

  const flashHanEl = requireEl(document.getElementById("ziyin-flash-han"), "ziyin-flash-han");
  const flashHanBackEl = requireEl(document.getElementById("ziyin-flash-han-back"), "ziyin-flash-han-back");
  const flashPinyinEl = requireEl(document.getElementById("ziyin-flash-pinyin"), "ziyin-flash-pinyin");
  const flashShengzhouEl = requireEl(document.getElementById("ziyin-flash-shengzhou"), "ziyin-flash-shengzhou");
  const flashProgressEl = document.getElementById("ziyin-flash-progress");
  const flashGradeEl = document.getElementById("ziyin-flash-grade");
  const knowBtn = document.getElementById("ziyin-know") as HTMLButtonElement | null;
  const unknownBtn = document.getElementById("ziyin-unknown") as HTMLButtonElement | null;
  const reviewWrongBtn = document.getElementById("ziyin-review-wrong") as HTMLButtonElement | null;
  const reviewDueBtn = document.getElementById("ziyin-review-due") as HTMLButtonElement | null;
  const clearProgressBtn = document.getElementById("ziyin-clear-progress") as HTMLButtonElement | null;

  const statusEl = requireEl(document.getElementById("ziyin-status"), "ziyin-status");
  const audioStatusEl = document.getElementById("ziyin-audio-status");
  const noteEl = document.getElementById("ziyin-note");
  const levelNameEl = document.getElementById("ziyin-level-name");
  const levelButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-ziyin-level]"));
  const prevBtn = requireEl(document.getElementById("ziyin-prev"), "ziyin-prev") as HTMLButtonElement;
  const nextBtn = requireEl(document.getElementById("ziyin-next"), "ziyin-next") as HTMLButtonElement;
  const randomBtn = requireEl(document.getElementById("ziyin-random"), "ziyin-random") as HTMLButtonElement;
  const shuffleBtn = document.getElementById("ziyin-shuffle") as HTMLButtonElement | null;
  const startBtn = document.getElementById("learn-start-fayin") as HTMLButtonElement | null;
  const listenBtns = [
    document.getElementById("ziyin-listen-shengzhou") as HTMLButtonElement | null,
    document.getElementById("ziyin-flash-listen") as HTMLButtonElement | null,
  ].filter(Boolean) as HTMLButtonElement[];

  const res = await fetch("data/learn/ziyin.json?v=20260812f");
  if (!res.ok) throw new Error(`ziyin HTTP ${res.status}`);
  const data = (await res.json()) as ZiyinFile;
  const allItems = data.items.filter((it) => it.han?.trim());
  if (!allItems.length) throw new Error("ziyin list empty");

  const PROGRESS_KEY = "yueyu-ziyin-flash-progress-v1";
  const MODE_KEY = "yueyu-ziyin-learn-mode-v1";
  const DAILY_KEY = "yueyu-ziyin-daily-known-v1";
  const QUEST_PASS = 0.8;
  const DAILY_SOFT_CAP = 30;
  const GATE_EMOJI = ["🗺️", "🌿", "⚡", "🔀", "📜"] as const;

  type ProgressState = {
    known: string[];
    unknown: string[];
    due: Record<string, number>;
    box: Record<string, number>;
  };
  type LearnMode = "classic" | "quest";
  type DailyState = { day: string; newKnown: number };

  let reviewWrongOnly = false;
  let reviewDueOnly = false;
  let learnMode: LearnMode = "classic";
  let questGate: number | null = null;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const BOX_DAYS = [1, 3, 7, 14];

  const classicChrome = document.getElementById("ziyin-classic-chrome");
  const questMapEl = document.getElementById("ziyin-quest-map");
  const questGatesEl = document.getElementById("ziyin-quest-gates");
  const questSessionEl = document.getElementById("ziyin-quest-session");
  const questTaskEl = document.getElementById("ziyin-quest-task");
  const questBarFill = document.getElementById("ziyin-quest-bar-fill");
  const questGateProgressEl = document.getElementById("ziyin-quest-gate-progress");
  const questPassEl = document.getElementById("ziyin-quest-pass");
  const questMasterEl = document.getElementById("ziyin-quest-master");
  const questDailyEl = document.getElementById("ziyin-quest-daily");
  const questBackBtn = document.getElementById("ziyin-quest-back") as HTMLButtonElement | null;
  const questExportBtn = document.getElementById("ziyin-quest-export") as HTMLButtonElement | null;
  const questImportBtn = document.getElementById("ziyin-quest-import") as HTMLButtonElement | null;
  const questImportFile = document.getElementById("ziyin-quest-import-file") as HTMLInputElement | null;
  const switchToQuestBtn = document.getElementById("ziyin-switch-to-quest") as HTMLButtonElement | null;
  const modeButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-learn-mode]"));
  let celebrateTimer: number | null = null;

  function loadProgress(): ProgressState {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      if (!raw) return { known: [], unknown: [], due: {}, box: {} };
      const parsed = JSON.parse(raw) as ProgressState & { due?: Record<string, number>; box?: Record<string, number> };
      return {
        known: Array.isArray(parsed.known) ? parsed.known.map(String) : [],
        unknown: Array.isArray(parsed.unknown) ? parsed.unknown.map(String) : [],
        due: parsed.due && typeof parsed.due === "object" ? parsed.due : {},
        box: parsed.box && typeof parsed.box === "object" ? parsed.box : {},
      };
    } catch {
      return { known: [], unknown: [], due: {}, box: {} };
    }
  }

  function saveProgress(state: ProgressState): void {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(state));
  }

  function todayKey(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function loadDaily(): DailyState {
    try {
      const raw = localStorage.getItem(DAILY_KEY);
      if (!raw) return { day: todayKey(), newKnown: 0 };
      const parsed = JSON.parse(raw) as DailyState;
      if (parsed.day !== todayKey()) return { day: todayKey(), newKnown: 0 };
      return { day: parsed.day, newKnown: Number(parsed.newKnown) || 0 };
    } catch {
      return { day: todayKey(), newKnown: 0 };
    }
  }

  function saveDaily(state: DailyState): void {
    localStorage.setItem(DAILY_KEY, JSON.stringify(state));
  }

  function loadLearnMode(): LearnMode {
    try {
      const raw = localStorage.getItem(MODE_KEY);
      return raw === "quest" ? "quest" : "classic";
    } catch {
      return "classic";
    }
  }

  function saveLearnMode(mode: LearnMode): void {
    localStorage.setItem(MODE_KEY, mode);
  }

  let progress = loadProgress();
  let daily = loadDaily();
  learnMode = loadLearnMode();

  /** L5 UI = flash of L1–4 (Shengzhou audio). Orphan JSON `level:5` rows are ignored until recorded. */
  function reviewBaseItems(): ZiyinItem[] {
    return allItems.filter((it) => {
      const lv = it.level ?? 1;
      return lv >= 1 && lv <= 4;
    });
  }

  function itemsForLevel(lv: number): ZiyinItem[] {
    return allItems.filter((it) => (it.level ?? 1) === lv);
  }

  function gateItems(gate: number): ZiyinItem[] {
    if (gate === 5) return reviewBaseItems();
    return itemsForLevel(gate);
  }

  function gateStats(gate: number): { total: number; known: number; ratio: number; pct: number } {
    const poolItems = gateItems(gate);
    const total = poolItems.length || 1;
    const knownSet = new Set(progress.known);
    const known = poolItems.filter((it) => knownSet.has(it.han)).length;
    const ratio = known / total;
    return { total: poolItems.length, known, ratio, pct: Math.floor(ratio * 100) };
  }

  function isGateCleared(gate: number): boolean {
    return gateStats(gate).ratio >= QUEST_PASS;
  }

  function isGateUnlocked(gate: number): boolean {
    if (gate <= 1) return true;
    return isGateCleared(gate - 1);
  }

  function allGatesCleared(): boolean {
    return [1, 2, 3, 4, 5].every((g) => isGateCleared(g));
  }

  function dueHans(now = Date.now()): string[] {
    return Object.entries(progress.due)
      .filter(([, ts]) => typeof ts === "number" && ts <= now)
      .map(([han]) => han);
  }

  function scheduleKnown(han: string): void {
    const prev = progress.box[han] ?? 0;
    const nextBox = Math.min(prev + 1, BOX_DAYS.length - 1);
    progress.box[han] = nextBox;
    progress.due[han] = Date.now() + (BOX_DAYS[nextBox] ?? 1) * DAY_MS;
  }

  function scheduleUnknown(han: string): void {
    progress.box[han] = 0;
    progress.due[han] = Date.now();
  }

  function updateDailyUi(): void {
    if (!questDailyEl) return;
    if (daily.newKnown >= DAILY_SOFT_CAP) {
      questDailyEl.hidden = false;
      questDailyEl.textContent = tf("learn.quest.dailySoft", { n: daily.newKnown });
    } else {
      questDailyEl.hidden = true;
      questDailyEl.textContent = "";
    }
  }

  function updateQuestSessionUi(celebrate = false): void {
    if (questGate == null) return;
    const stats = gateStats(questGate);
    if (questTaskEl) questTaskEl.textContent = t(`learn.quest.gate${questGate}.task`);
    if (questGateProgressEl) {
      questGateProgressEl.textContent = tf("learn.quest.gateProgress", {
        known: stats.known,
        total: stats.total,
        pct: stats.pct,
      });
    }
    if (questBarFill) questBarFill.style.width = `${Math.min(100, stats.pct)}%`;
    if (questPassEl) {
      if (isGateCleared(questGate)) {
        questPassEl.hidden = false;
        questPassEl.textContent =
          questGate === 5 && allGatesCleared()
            ? t("learn.quest.passFinal")
            : tf("learn.quest.passToast", { badge: t(`learn.quest.badge${questGate}`) });
        if (celebrate) {
          questPassEl.classList.remove("is-celebrating");
          // Restart CSS animation
          void questPassEl.offsetWidth;
          questPassEl.classList.add("is-celebrating");
          if (celebrateTimer != null) window.clearTimeout(celebrateTimer);
          celebrateTimer = window.setTimeout(() => {
            questPassEl?.classList.remove("is-celebrating");
            celebrateTimer = null;
          }, 1600);
        }
      } else {
        questPassEl.hidden = true;
        questPassEl.textContent = "";
        questPassEl.classList.remove("is-celebrating");
      }
    }
  }

  function renderQuestMap(): void {
    if (!questGatesEl) return;
    questGatesEl.replaceChildren();
    questGatesEl.classList.add("ziyin-quest__path");
    if (questMasterEl) questMasterEl.hidden = !allGatesCleared();
    updateDailyUi();

    for (const gate of [1, 2, 3, 4, 5]) {
      const unlocked = isGateUnlocked(gate);
      const cleared = isGateCleared(gate);
      const stats = gateStats(gate);
      const state = !unlocked ? "locked" : cleared ? "cleared" : "open";
      const li = document.createElement("li");
      li.className = "ziyin-quest__gate";
      li.dataset.gate = String(gate);
      li.dataset.state = state;

      const node = document.createElement(unlocked ? "button" : "div");
      node.className = "ziyin-quest__node";
      if (unlocked) {
        (node as HTMLButtonElement).type = "button";
        node.addEventListener("click", () => enterQuestGate(gate));
      }
      node.setAttribute(
        "aria-label",
        tf("learn.quest.gateTitle", { n: gate, name: levelLabel(gate) }),
      );
      const mark = document.createElement("span");
      mark.className = "ziyin-quest__node-mark";
      mark.setAttribute("aria-hidden", "true");
      if (!unlocked) mark.textContent = "🔒";
      else if (cleared) mark.textContent = "✓";
      else mark.textContent = String(gate);
      node.append(mark);

      const name = document.createElement("p");
      name.className = "ziyin-quest__gate-name";
      name.textContent = tf("learn.quest.gateTitle", { n: gate, name: levelLabel(gate) });

      const emoji = document.createElement("p");
      emoji.className = "ziyin-quest__gate-emoji";
      emoji.setAttribute("aria-hidden", "true");
      emoji.textContent = GATE_EMOJI[gate - 1] ?? "";

      const status = document.createElement("p");
      status.className = "ziyin-quest__gate-status";
      status.dataset.state = state;
      status.textContent = !unlocked
        ? t("learn.quest.locked")
        : cleared
          ? t("learn.quest.cleared")
          : t("learn.quest.inProgress");

      const meta = document.createElement("p");
      meta.className = "ziyin-quest__gate-meta";
      meta.textContent = `${stats.known}/${stats.total} · ${stats.pct}%`;

      const bar = document.createElement("div");
      bar.className = "ziyin-quest__gate-bar";
      bar.setAttribute("aria-hidden", "true");
      const fill = document.createElement("span");
      fill.style.width = `${Math.min(100, stats.pct)}%`;
      bar.append(fill);

      li.append(node, emoji, name, status, meta, bar);

      if (unlocked) {
        const enter = document.createElement("button");
        enter.type = "button";
        enter.className = "ziyin-quest__enter";
        enter.textContent = t("learn.quest.enter");
        enter.addEventListener("click", () => enterQuestGate(gate));
        li.append(enter);
      }

      questGatesEl.append(li);
    }
  }

  function updateProgressUi(): void {
    const total = reviewBaseItems().length;
    const knownCount = progress.known.filter((han) =>
      reviewBaseItems().some((it) => it.han === han),
    ).length;
    const unknownCount = progress.unknown.filter((han) =>
      reviewBaseItems().some((it) => it.han === han),
    ).length;
    const dueCount = dueHans().filter((han) =>
      reviewBaseItems().some((it) => it.han === han),
    ).length;
    if (flashProgressEl) {
      if (learnMode === "quest" && questGate != null) {
        const stats = gateStats(questGate);
        flashProgressEl.textContent = tf("learn.quest.gateProgress", {
          known: stats.known,
          total: stats.total,
          pct: stats.pct,
        });
      } else {
        flashProgressEl.textContent = tf("learn.ziyin.progress", {
          known: knownCount,
          total,
          wrong: unknownCount,
          due: dueCount,
        });
      }
    }
    if (reviewWrongBtn) {
      const hideReview = learnMode === "quest";
      reviewWrongBtn.hidden = hideReview || unknownCount === 0;
      reviewWrongBtn.setAttribute("aria-pressed", reviewWrongOnly ? "true" : "false");
    }
    if (reviewDueBtn) {
      const hideReview = learnMode === "quest";
      reviewDueBtn.hidden = hideReview || dueCount === 0;
      reviewDueBtn.setAttribute("aria-pressed", reviewDueOnly ? "true" : "false");
    }
    if (clearProgressBtn) clearProgressBtn.hidden = learnMode === "quest";
    if (flashGradeEl) flashGradeEl.hidden = !isFlashMode();
    if (learnMode === "quest") {
      updateQuestSessionUi();
      if (questGate == null) renderQuestMap();
    }
  }

  function markCard(kind: "known" | "unknown"): void {
    const item = pool[index];
    if (!item || !isFlashMode()) return;
    const han = item.han;
    const wasKnown = progress.known.includes(han);
    const wasCleared = learnMode === "quest" && questGate != null && isGateCleared(questGate);
    progress.known = progress.known.filter((h) => h !== han);
    progress.unknown = progress.unknown.filter((h) => h !== han);
    if (kind === "known") {
      progress.known.push(han);
      scheduleKnown(han);
      if (!wasKnown) {
        daily = loadDaily();
        daily.newKnown += 1;
        saveDaily(daily);
        updateDailyUi();
      }
    } else {
      progress.unknown.push(han);
      scheduleUnknown(han);
    }
    saveProgress(progress);
    updateProgressUi();
    if (learnMode === "quest" && questGate != null) {
      const nowCleared = isGateCleared(questGate);
      updateQuestSessionUi(!wasCleared && nowCleared);
    }

    if (reviewWrongOnly || reviewDueOnly) {
      pool = pool.filter((it) => it.han !== han);
      if (!pool.length) {
        reviewWrongOnly = false;
        reviewDueOnly = false;
        setLevel(5, true);
        return;
      }
      index = Math.min(index, pool.length - 1);
      paint();
      return;
    }

    index = (index + 1) % pool.length;
    paint();
  }
  if (noteEl && data.note) noteEl.textContent = data.note;

  const levelsMeta = data.levels ?? [];
  const syllabusListEl = document.getElementById("ziyin-syllabus-list");
  const syllabusTotalEl = document.getElementById("ziyin-syllabus-total");

  function renderSyllabus(): void {
    if (!syllabusListEl) return;
    const l14 = allItems.filter((it) => {
      const lv = it.level ?? 1;
      return lv >= 1 && lv <= 4;
    });
    if (syllabusTotalEl) {
      syllabusTotalEl.textContent = tf("learn.syllabus.total", { n: l14.length });
    }

    const descKey = (lv: number) => `learn.syllabus.l${lv}desc`;
    syllabusListEl.replaceChildren();

    for (const lv of [1, 2, 3, 4, 5]) {
      const hans =
        lv === 5
          ? l14.map((it) => it.han)
          : itemsForLevel(lv).map((it) => it.han);
      const article = document.createElement("article");
      article.className = "ziyin-syllabus__item";

      const head = document.createElement("div");
      head.className = "ziyin-syllabus__head";
      const title = document.createElement("h4");
      title.className = "ziyin-syllabus__level";
      title.textContent = `${lv}. ${levelLabel(lv)}`;
      const count = document.createElement("span");
      count.className = "ziyin-syllabus__count";
      count.textContent = tf("learn.syllabus.count", { n: hans.length });
      head.append(title, count);

      const desc = document.createElement("p");
      desc.className = "ziyin-syllabus__desc";
      desc.textContent = t(descKey(lv));

      article.append(head, desc);

      if (lv === 5) {
        const note = document.createElement("p");
        note.className = "ziyin-syllabus__note";
        note.textContent = t("learn.syllabus.l5wordsNote");
        article.append(note);
      } else {
        const details = document.createElement("details");
        const summary = document.createElement("summary");
        summary.textContent = t("learn.syllabus.showWords");
        details.addEventListener("toggle", () => {
          summary.textContent = details.open
            ? t("learn.syllabus.hideWords")
            : t("learn.syllabus.showWords");
        });
        const words = document.createElement("p");
        words.className = "ziyin-syllabus__words";
        words.lang = "zh-Hans";
        words.textContent = hans.join("");
        details.append(summary, words);
        article.append(details);
      }

      syllabusListEl.append(article);
    }
  }

  let level = 1;
  let pool = allItems.filter((it) => (it.level ?? 1) === level);
  if (!pool.length) pool = allItems;
  let index = 0;
  let flipped = false;
  let paintToken = 0;
  const player = new Audio();
  player.preload = "none";

  function isFlashMode(): boolean {
    if (learnMode === "quest") return questGate != null;
    return level === 5;
  }

  function levelLabel(lv: number): string {
    const meta = levelsMeta.find((m) => m.id === lv);
    const lang = document.documentElement.lang || "zh-Hans";
    if (!meta) return `第${lv}阶`;
    if (lang === "en") return meta.nameEn ?? meta.name;
    if (lang === "zh-Hant") return meta.nameHant ?? meta.name;
    return meta.name;
  }

  function setAudioHint(key: "hint" | "flashHint" | "missing" | "playing" | "error", detail = ""): void {
    if (!audioStatusEl) return;
    const lang = document.documentElement.lang || "zh-Hans";
    const messages = {
      hint: {
        "zh-Hans": "点击「听嵊州」可听真人发音。上虞、诸暨仅显示音标对照。",
        "zh-Hant": "點擊「聽嵊州」可聽真人發音。上虞、諸暨僅顯示音標對照。",
        en: "Tap Hear Shengzhou for a speaker clip. Shangyu and Zhuji show IPA for reference only.",
      },
      flashHint: {
        "zh-Hans": "先看正面汉字，点卡片揭晓拼音，再点「听嵊州」自检。",
        "zh-Hant": "先看正面漢字，點卡片揭曉拼音，再點「聽嵊州」自檢。",
        en: "See the character first, tap to reveal pinyin, then Hear Shengzhou to self-check.",
      },
      missing: {
        "zh-Hans": "此字暂无嵊州录音。",
        "zh-Hant": "此字暫無嵊州錄音。",
        en: "No Shengzhou recording for this character yet.",
      },
      playing: {
        "zh-Hans": `正在播放${detail}…`,
        "zh-Hant": `正在播放${detail}…`,
        en: `Playing ${detail}…`,
      },
      error: {
        "zh-Hans": "播放失败。请检查录音文件。",
        "zh-Hant": "播放失敗。請檢查錄音檔。",
        en: "Could not play this clip. Check the audio file.",
      },
    } as const;
    const table = messages[key];
    audioStatusEl.textContent =
      (lang === "zh-Hant" ? table["zh-Hant"] : lang === "en" ? table.en : table["zh-Hans"]) || table.en;
  }

  function setFlipped(next: boolean): void {
    flipped = next;
    flashCard.classList.toggle("is-flipped", flipped);
    flashCard.setAttribute("aria-pressed", flipped ? "true" : "false");
  }

  function syncModeUi(): void {
    const flash = isFlashMode();
    const inQuestMap = learnMode === "quest" && questGate == null;
    const inQuestSession = learnMode === "quest" && questGate != null;

    if (classicChrome) classicChrome.hidden = learnMode === "quest";
    if (questMapEl) questMapEl.hidden = !inQuestMap;
    if (questSessionEl) questSessionEl.hidden = !inQuestSession;
    stage!.hidden = inQuestMap;
    stage!.classList.toggle("ziyin-stage--quest", inQuestSession);
    stage!.classList.toggle("ziyin-stage--flash", flash);

    drillEl.hidden = flash;
    flashEl.hidden = !flash;
    if (modeNoteEl) modeNoteEl.hidden = !flash || learnMode === "quest";
    if (shuffleBtn) shuffleBtn.hidden = !flash;
    randomBtn.hidden = flash;
    if (flashGradeEl) flashGradeEl.hidden = !flash;
    if (!flash) {
      setFlipped(false);
      reviewWrongOnly = false;
    }
    modeButtons.forEach((btn) => {
      btn.setAttribute("aria-pressed", btn.dataset.learnMode === learnMode ? "true" : "false");
    });
    const classicStageHint = document.getElementById("ziyin-classic-stage-hint");
    if (classicStageHint) classicStageHint.hidden = learnMode !== "classic" || inQuestMap;
    updateProgressUi();
  }

  function setLearnMode(mode: LearnMode): void {
    learnMode = mode;
    saveLearnMode(mode);
    questGate = null;
    reviewWrongOnly = false;
    reviewDueOnly = false;
    if (mode === "classic") {
      setLevel(level >= 1 && level <= 5 ? level : 1, true);
    } else {
      syncModeUi();
      renderQuestMap();
    }
  }

  function enterQuestGate(gate: number): void {
    if (!isGateUnlocked(gate)) return;
    questGate = gate;
    level = gate;
    reviewWrongOnly = false;
    reviewDueOnly = false;
    pool = gateItems(gate).slice();
    if (!pool.length) pool = reviewBaseItems().slice();
    shuffleInPlace(pool);
    index = 0;
    if (levelNameEl) levelNameEl.textContent = levelLabel(gate);
    syncModeUi();
    paint();
    stage!.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function leaveQuestGate(): void {
    questGate = null;
    syncModeUi();
    renderQuestMap();
    questMapEl?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function refreshListenButtons(item: ZiyinItem): Promise<void> {
    const token = ++paintToken;
    for (const btn of listenBtns) {
      btn.disabled = true;
      btn.dataset.audioUrl = "";
    }
    const url = resolveAudioUrl(item, "shengzhou");
    if (!url) {
      setAudioHint("missing");
      return;
    }
    const ok = await audioExists(url);
    if (token !== paintToken) return;
    for (const btn of listenBtns) {
      btn.disabled = !ok;
      btn.dataset.audioUrl = ok ? url : "";
    }
    if (!ok) setAudioHint("missing");
    else setAudioHint(isFlashMode() ? "flashHint" : "hint");
  }

  function paint(): void {
    const item = pool[index];
    if (!item) {
      statusEl.textContent = `0 / 0 · ${levelLabel(level)}`;
      return;
    }
    player.pause();
    setFlipped(false);

    hanEl.textContent = item.han;
    pinyinEl.textContent = item.pinyin;
    shangyuEl.textContent = item.shangyu;
    zhujiEl.textContent = item.zhuji;
    shengzhouEl.textContent = item.shengzhou;

    flashHanEl.textContent = item.han;
    flashHanBackEl.textContent = item.han;
    flashPinyinEl.textContent = item.pinyin;
    flashShengzhouEl.textContent = item.shengzhou;

    const gloss = item.gloss?.trim();
    if (glossEl) glossEl.textContent = gloss || "—";
    if (glossRow) glossRow.hidden = !gloss;
    // No on-site speaker credit (product choice).
    if (speakerEl) {
      speakerEl.textContent = "";
      speakerEl.hidden = true;
    }
    tagEl.textContent = item.tag?.trim() || levelLabel(level);
    tagEl.hidden = false;
    statusEl.textContent = `${index + 1} / ${pool.length} · ${levelLabel(level)}`;
    prevBtn.disabled = pool.length <= 1;
    nextBtn.disabled = pool.length <= 1;
    randomBtn.disabled = pool.length <= 1;
    if (shuffleBtn) shuffleBtn.disabled = pool.length <= 1;
    void refreshListenButtons(item);
  }

  function setLevel(next: number, resetIndex = true): void {
    if (learnMode === "quest") {
      // Classic level chips are hidden in quest; ignore accidental calls unless entering a gate.
      if (questGate == null) {
        syncModeUi();
        return;
      }
      next = questGate;
    }
    level = next;
    if (isFlashMode()) {
      if (learnMode === "quest" && questGate != null) {
        pool = gateItems(questGate).slice();
      } else {
        const base = reviewBaseItems();
        if (reviewWrongOnly) {
          const wrong = new Set(progress.unknown);
          pool = base.filter((it) => wrong.has(it.han));
          if (!pool.length) {
            reviewWrongOnly = false;
            pool = base.slice();
          }
        } else if (reviewDueOnly) {
          const due = new Set(dueHans());
          pool = base.filter((it) => due.has(it.han));
          if (!pool.length) {
            reviewDueOnly = false;
            pool = base.slice();
          }
        } else {
          pool = base.slice();
        }
      }
    } else {
      pool = allItems.filter((it) => (it.level ?? 1) === level);
    }
    if (!pool.length) pool = allItems.slice();
    else pool = pool.slice();
    if (isFlashMode()) shuffleInPlace(pool);
    if (resetIndex) index = 0;
    else index = Math.min(index, Math.max(0, pool.length - 1));
    levelButtons.forEach((btn) => {
      const lv = Number(btn.dataset.ziyinLevel);
      btn.setAttribute("aria-pressed", lv === level ? "true" : "false");
    });
    if (levelNameEl) levelNameEl.textContent = levelLabel(level);
    syncModeUi();
    paint();
  }

  /** Deep-link / Pathways helper. */
  function openZiyinLevel(lv: number): void {
    setLearnMode("classic");
    openLearnSection("fayin");
    setLevel(lv, true);
    stage!.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function openQuest(gate?: number): void {
    openLearnSection("fayin");
    setLearnMode("quest");
    if (gate != null && isGateUnlocked(gate)) enterQuestGate(gate);
    else questMapEl?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  (window as Window & {
    __yueyuOpenZiyinLevel?: (lv: number) => void;
    __yueyuOpenQuest?: (gate?: number) => void;
  }).__yueyuOpenZiyinLevel = openZiyinLevel;
  (window as Window & { __yueyuOpenQuest?: (gate?: number) => void }).__yueyuOpenQuest = openQuest;

  async function playShengzhou(fromBtn?: HTMLButtonElement): Promise<void> {
    const item = pool[index];
    if (!item) return;
    const url = fromBtn?.dataset.audioUrl || listenBtns.find((b) => b.dataset.audioUrl)?.dataset.audioUrl || resolveAudioUrl(item, "shengzhou");
    if (!url) {
      setAudioHint("missing");
      return;
    }
    try {
      player.pause();
      player.src = url;
      setAudioHint("playing", "嵊州 Shengzhou");
      await player.play();
    } catch {
      setAudioHint("error");
      for (const btn of listenBtns) btn.disabled = true;
    }
  }

  levelButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (learnMode !== "classic") return;
      const lv = Number(btn.dataset.ziyinLevel);
      if (!Number.isFinite(lv)) return;
      setLevel(lv, true);
    });
  });

  modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.learnMode === "quest" ? "quest" : "classic";
      setLearnMode(mode);
    });
  });

  switchToQuestBtn?.addEventListener("click", () => setLearnMode("quest"));
  document.getElementById("ziyin-switch-to-quest-stage")?.addEventListener("click", () => setLearnMode("quest"));
  document.getElementById("learn-open-quest")?.addEventListener("click", () => {
    openLearnSection("fayin");
    setLearnMode("quest");
    questMapEl?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  questBackBtn?.addEventListener("click", () => leaveQuestGate());

  questExportBtn?.addEventListener("click", () => {
    const payload = {
      v: 1,
      exportedAt: new Date().toISOString(),
      progress,
      daily: loadDaily(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `yueyu-learn-progress-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  questImportBtn?.addEventListener("click", () => questImportFile?.click());
  questImportFile?.addEventListener("change", async () => {
    const file = questImportFile.files?.[0];
    questImportFile.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { progress?: ProgressState };
      const next = parsed.progress;
      if (!next || !Array.isArray(next.known)) throw new Error("bad");
      progress = {
        known: next.known.map(String),
        unknown: Array.isArray(next.unknown) ? next.unknown.map(String) : [],
        due: next.due && typeof next.due === "object" ? next.due : {},
        box: next.box && typeof next.box === "object" ? next.box : {},
      };
      saveProgress(progress);
      updateProgressUi();
      renderQuestMap();
      if (questDailyEl) {
        questDailyEl.hidden = false;
        questDailyEl.textContent = t("learn.quest.importOk");
      }
    } catch {
      if (questDailyEl) {
        questDailyEl.hidden = false;
        questDailyEl.textContent = t("learn.quest.importFail");
      }
    }
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
  shuffleBtn?.addEventListener("click", () => {
    if (pool.length < 2) return;
    const previous = pool[index];
    shuffleInPlace(pool);
    // Start at the top of the new deck so the learner sees a new route immediately.
    index = 0;
    if (previous && pool[0] === previous) {
      // Extremely rare after a full shuffle, but avoid a no-op first card.
      const swapWith = 1 + Math.floor(Math.random() * (pool.length - 1));
      const a = pool[0] as ZiyinItem;
      const b = pool[swapWith] as ZiyinItem;
      pool[0] = b;
      pool[swapWith] = a;
    }
    paint();
  });

  knowBtn?.addEventListener("click", () => markCard("known"));
  unknownBtn?.addEventListener("click", () => markCard("unknown"));
  reviewWrongBtn?.addEventListener("click", () => {
    reviewWrongOnly = !reviewWrongOnly;
    if (reviewWrongOnly) reviewDueOnly = false;
    setLevel(5, true);
  });
  reviewDueBtn?.addEventListener("click", () => {
    reviewDueOnly = !reviewDueOnly;
    if (reviewDueOnly) reviewWrongOnly = false;
    setLevel(5, true);
  });
  clearProgressBtn?.addEventListener("click", () => {
    progress = { known: [], unknown: [], due: {}, box: {} };
    saveProgress(progress);
    reviewWrongOnly = false;
    reviewDueOnly = false;
    updateProgressUi();
    if (isFlashMode()) setLevel(learnMode === "quest" && questGate != null ? questGate : 5, true);
    if (learnMode === "quest") renderQuestMap();
  });

  flashCard.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("button")) return;
    setFlipped(!flipped);
  });
  flashCard.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    setFlipped(!flipped);
  });

  for (const btn of listenBtns) {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      void playShengzhou(btn);
    });
  }

  startBtn?.addEventListener("click", () => {
    openLearnSection("fayin");
    setLearnMode("classic");
    setLevel(1, true);
    stage.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.getElementById("learn-start-from-guide")?.addEventListener("click", () => {
    openLearnSection("fayin");
    setLearnMode("classic");
    setLevel(1, true);
    stage.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.getElementById("learn-open-pinyin")?.addEventListener("click", () => {
    openLearnSection("pinyin");
  });

  const observer = new MutationObserver(() => {
    if (levelNameEl) levelNameEl.textContent = levelLabel(level);
    statusEl.textContent = pool.length
      ? `${index + 1} / ${pool.length} · ${levelLabel(level)}`
      : `0 / 0 · ${levelLabel(level)}`;
    setAudioHint(isFlashMode() ? "flashHint" : "hint");
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

  onLocaleChange(() => {
    renderSyllabus();
    updateProgressUi();
    if (learnMode === "quest" && questGate == null) renderQuestMap();
    else if (learnMode === "quest") updateQuestSessionUi();
  });

  renderSyllabus();
  updateProgressUi();
  if (learnMode === "quest") {
    setLearnMode("quest");
  } else {
    setLevel(1, true);
  }
  if (learnMode === "classic") stage.removeAttribute("hidden");
}

document.addEventListener("DOMContentLoaded", () => {
  void initZiyin().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    const status = document.getElementById("ziyin-status");
    if (status) status.textContent = `加载失败：${message}`;
  });
});
