/** Single-character drill (L1–4) + Level 5 reveal flashcards; Shengzhou speaker audio only. */
import { onLocaleChange, t, tf } from "./i18n.js";
function requireEl(el, name) {
    if (!el)
        throw new Error(`Missing element: ${name}`);
    return el;
}
function openLearnSection(target) {
    const link = document.querySelector(`.learn-nav__link[data-learn-target="${target}"]`);
    link?.click();
}
function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        const a = arr[i];
        const b = arr[j];
        arr[i] = b;
        arr[j] = a;
    }
}
/** Explicit path in JSON, else convention: assets/learn/ziyin-audio/shengzhou/<han>.m4a */
function resolveAudioUrl(item, place) {
    const explicit = item.audio?.[place]?.trim();
    if (explicit)
        return explicit;
    const han = item.han?.trim();
    if (!han)
        return null;
    return `assets/learn/ziyin-audio/${place}/${han}.m4a`;
}
async function audioExists(url) {
    try {
        const res = await fetch(url, { method: "HEAD", cache: "no-cache" });
        if (res.ok)
            return true;
        if (res.status === 405 || res.status === 501) {
            const get = await fetch(url, { method: "GET", headers: { Range: "bytes=0-0" }, cache: "no-cache" });
            return get.ok || get.status === 206;
        }
        return false;
    }
    catch {
        return false;
    }
}
async function initZiyin() {
    const stage = document.getElementById("ziyin-stage");
    if (!stage)
        return;
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
    const knowBtn = document.getElementById("ziyin-know");
    const unknownBtn = document.getElementById("ziyin-unknown");
    const reviewWrongBtn = document.getElementById("ziyin-review-wrong");
    const reviewDueBtn = document.getElementById("ziyin-review-due");
    const clearProgressBtn = document.getElementById("ziyin-clear-progress");
    const statusEl = requireEl(document.getElementById("ziyin-status"), "ziyin-status");
    const audioStatusEl = document.getElementById("ziyin-audio-status");
    const noteEl = document.getElementById("ziyin-note");
    const levelNameEl = document.getElementById("ziyin-level-name");
    const levelButtons = Array.from(document.querySelectorAll("[data-ziyin-level]"));
    const prevBtn = requireEl(document.getElementById("ziyin-prev"), "ziyin-prev");
    const nextBtn = requireEl(document.getElementById("ziyin-next"), "ziyin-next");
    const randomBtn = requireEl(document.getElementById("ziyin-random"), "ziyin-random");
    const shuffleBtn = document.getElementById("ziyin-shuffle");
    const startBtn = document.getElementById("learn-start-fayin");
    const listenBtns = [
        document.getElementById("ziyin-listen-shengzhou"),
        document.getElementById("ziyin-flash-listen"),
    ].filter(Boolean);
    const res = await fetch("data/learn/ziyin.json?v=20260812f");
    if (!res.ok)
        throw new Error(`ziyin HTTP ${res.status}`);
    const data = (await res.json());
    const allItems = data.items.filter((it) => it.han?.trim());
    if (!allItems.length)
        throw new Error("ziyin list empty");
    const PROGRESS_KEY = "yueyu-ziyin-flash-progress-v1";
    const MODE_KEY = "yueyu-ziyin-learn-mode-v1";
    const DAILY_KEY = "yueyu-ziyin-daily-known-v1";
    const QUEST_PASS = 0.8;
    const DAILY_SOFT_CAP = 30;
    const GATE_EMOJI = ["🗺️", "🌿", "⚡", "🔀", "📜"];
    let reviewWrongOnly = false;
    let reviewDueOnly = false;
    let learnMode = "classic";
    let questGate = null;
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
    const questBackBtn = document.getElementById("ziyin-quest-back");
    const questExportBtn = document.getElementById("ziyin-quest-export");
    const questImportBtn = document.getElementById("ziyin-quest-import");
    const questImportFile = document.getElementById("ziyin-quest-import-file");
    const switchToQuestBtn = document.getElementById("ziyin-switch-to-quest");
    const questFocusEl = document.getElementById("ziyin-quest-focus");
    const questFocusTitleEl = document.getElementById("ziyin-quest-focus-title");
    const questFocusTaskEl = document.getElementById("ziyin-quest-focus-task");
    const questFocusEnterBtn = document.getElementById("ziyin-quest-focus-enter");
    const questFocusNextBtn = document.getElementById("ziyin-quest-focus-next");
    const questFocusProgressEl = document.getElementById("ziyin-quest-focus-progress");
    const questSessionNextBtn = document.getElementById("ziyin-quest-session-next");
    const questDailyFill = document.getElementById("ziyin-quest-daily-fill");
    const celebrateEl = document.getElementById("ziyin-quest-celebrate");
    const celebrateKickerEl = document.getElementById("ziyin-quest-celebrate-kicker");
    const celebrateTitleEl = document.getElementById("ziyin-quest-celebrate-title");
    const celebrateBodyEl = document.getElementById("ziyin-quest-celebrate-body");
    const celebrateNextBtn = document.getElementById("ziyin-quest-celebrate-next");
    const celebrateCloseBtn = document.getElementById("ziyin-quest-celebrate-close");
    const modeButtons = Array.from(document.querySelectorAll("[data-learn-mode]"));
    let celebrateTimer = null;
    let questFocusGate = null;
    function loadProgress() {
        try {
            const raw = localStorage.getItem(PROGRESS_KEY);
            if (!raw)
                return { known: [], unknown: [], due: {}, box: {} };
            const parsed = JSON.parse(raw);
            return {
                known: Array.isArray(parsed.known) ? parsed.known.map(String) : [],
                unknown: Array.isArray(parsed.unknown) ? parsed.unknown.map(String) : [],
                due: parsed.due && typeof parsed.due === "object" ? parsed.due : {},
                box: parsed.box && typeof parsed.box === "object" ? parsed.box : {},
            };
        }
        catch {
            return { known: [], unknown: [], due: {}, box: {} };
        }
    }
    function saveProgress(state) {
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(state));
    }
    function todayKey() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
    function loadDaily() {
        try {
            const raw = localStorage.getItem(DAILY_KEY);
            if (!raw)
                return { day: todayKey(), newKnown: 0 };
            const parsed = JSON.parse(raw);
            if (parsed.day !== todayKey())
                return { day: todayKey(), newKnown: 0 };
            return { day: parsed.day, newKnown: Number(parsed.newKnown) || 0 };
        }
        catch {
            return { day: todayKey(), newKnown: 0 };
        }
    }
    function saveDaily(state) {
        localStorage.setItem(DAILY_KEY, JSON.stringify(state));
    }
    function loadLearnMode() {
        try {
            const raw = localStorage.getItem(MODE_KEY);
            return raw === "quest" ? "quest" : "classic";
        }
        catch {
            return "classic";
        }
    }
    function saveLearnMode(mode) {
        localStorage.setItem(MODE_KEY, mode);
    }
    let progress = loadProgress();
    let daily = loadDaily();
    learnMode = loadLearnMode();
    /** L5 UI = flash of L1–4 (Shengzhou audio). Orphan JSON `level:5` rows are ignored until recorded. */
    function reviewBaseItems() {
        return allItems.filter((it) => {
            const lv = it.level ?? 1;
            return lv >= 1 && lv <= 4;
        });
    }
    function itemsForLevel(lv) {
        return allItems.filter((it) => (it.level ?? 1) === lv);
    }
    function gateItems(gate) {
        if (gate === 5)
            return reviewBaseItems();
        return itemsForLevel(gate);
    }
    function gateStats(gate) {
        const poolItems = gateItems(gate);
        const total = poolItems.length || 1;
        const knownSet = new Set(progress.known);
        const known = poolItems.filter((it) => knownSet.has(it.han)).length;
        const ratio = known / total;
        return { total: poolItems.length, known, ratio, pct: Math.floor(ratio * 100) };
    }
    function isGateCleared(gate) {
        return gateStats(gate).ratio >= QUEST_PASS;
    }
    function isGateUnlocked(gate) {
        if (gate <= 1)
            return true;
        return isGateCleared(gate - 1);
    }
    function allGatesCleared() {
        return [1, 2, 3, 4, 5].every((g) => isGateCleared(g));
    }
    function dueHans(now = Date.now()) {
        return Object.entries(progress.due)
            .filter(([, ts]) => typeof ts === "number" && ts <= now)
            .map(([han]) => han);
    }
    function scheduleKnown(han) {
        const prev = progress.box[han] ?? 0;
        const nextBox = Math.min(prev + 1, BOX_DAYS.length - 1);
        progress.box[han] = nextBox;
        progress.due[han] = Date.now() + (BOX_DAYS[nextBox] ?? 1) * DAY_MS;
    }
    function scheduleUnknown(han) {
        progress.box[han] = 0;
        progress.due[han] = Date.now();
    }
    function updateDailyUi() {
        daily = loadDaily();
        if (!questDailyEl)
            return;
        const over = daily.newKnown >= DAILY_SOFT_CAP;
        questDailyEl.hidden = false;
        questDailyEl.textContent = over
            ? tf("learn.quest.dailySoft", { n: daily.newKnown, cap: DAILY_SOFT_CAP })
            : tf("learn.quest.dailyGoal", { n: daily.newKnown, cap: DAILY_SOFT_CAP });
        if (questDailyFill) {
            const pct = Math.min(100, Math.round((daily.newKnown / DAILY_SOFT_CAP) * 100));
            questDailyFill.style.width = `${pct}%`;
        }
    }
    function hideQuestCelebrate() {
        if (celebrateEl)
            celebrateEl.hidden = true;
        if (celebrateNextBtn) {
            celebrateNextBtn.hidden = true;
            delete celebrateNextBtn.dataset.nextGate;
        }
    }
    function showQuestCelebrate(kind, gate, next) {
        if (!celebrateEl)
            return;
        if (celebrateKickerEl) {
            celebrateKickerEl.textContent =
                kind === "master" ? t("learn.quest.celebrateMasterKicker") : t("learn.quest.celebrateGateKicker");
        }
        if (celebrateTitleEl) {
            celebrateTitleEl.textContent =
                kind === "master"
                    ? t("learn.quest.masterTitle")
                    : tf("learn.quest.gateTitle", { n: gate, name: levelLabel(gate) });
        }
        let body = kind === "master"
            ? t("learn.quest.celebrateMasterBody")
            : tf("learn.quest.passToast", { badge: t(`learn.quest.badge${gate}`) });
        try {
            if (!localStorage.getItem(EXPORT_NUDGE_KEY)) {
                body = `${body}\n\n${t("learn.quest.exportNudge")}`;
                localStorage.setItem(EXPORT_NUDGE_KEY, "1");
            }
        }
        catch {
            /* ignore */
        }
        if (celebrateBodyEl)
            celebrateBodyEl.textContent = body;
        if (celebrateNextBtn) {
            const showNext = kind === "gate" && next != null;
            celebrateNextBtn.hidden = !showNext;
            if (showNext)
                celebrateNextBtn.dataset.nextGate = String(next);
        }
        celebrateEl.hidden = false;
        celebrateCloseBtn?.focus();
    }
    function nextPlayableGate(after = 0) {
        for (let g = Math.max(1, after + 1); g <= 5; g += 1) {
            if (isGateUnlocked(g) && !isGateCleared(g))
                return g;
        }
        for (let g = 1; g <= 5; g += 1) {
            if (isGateUnlocked(g) && !isGateCleared(g))
                return g;
        }
        return null;
    }
    function recommendedGate() {
        return nextPlayableGate(0) ?? 1;
    }
    function updateQuestFocusUi() {
        if (!questFocusEl)
            return;
        if (learnMode !== "quest" || questGate != null || questFocusGate == null) {
            questFocusEl.hidden = true;
            return;
        }
        const gate = questFocusGate;
        const unlocked = isGateUnlocked(gate);
        questFocusEl.hidden = false;
        if (questFocusTitleEl) {
            questFocusTitleEl.textContent = tf("learn.quest.gateTitle", {
                n: gate,
                name: levelLabel(gate),
            });
        }
        if (questFocusTaskEl)
            questFocusTaskEl.textContent = t(`learn.quest.gate${gate}.task`);
        const stats = gateStats(gate);
        if (questFocusProgressEl) {
            questFocusProgressEl.textContent = tf("learn.quest.gateProgress", {
                n: gate,
                known: stats.known,
                total: stats.total,
                pct: stats.pct,
            });
        }
        if (questFocusEnterBtn) {
            questFocusEnterBtn.hidden = !unlocked;
            questFocusEnterBtn.disabled = !unlocked;
        }
        const next = nextPlayableGate(gate);
        if (questFocusNextBtn) {
            const showNext = unlocked && isGateCleared(gate) && next != null;
            questFocusNextBtn.hidden = !showNext;
            if (showNext)
                questFocusNextBtn.dataset.nextGate = String(next);
        }
        questGatesEl?.querySelectorAll(".ziyin-quest__gate").forEach((el) => {
            const g = Number(el.dataset.gate);
            el.classList.toggle("is-focused", g === gate);
        });
    }
    function setQuestFocus(gate) {
        if (gate < 1 || gate > 5)
            return;
        questFocusGate = gate;
        updateQuestFocusUi();
    }
    function updateQuestSessionUi(celebrate = false) {
        if (questGate == null)
            return;
        const stats = gateStats(questGate);
        if (questTaskEl)
            questTaskEl.textContent = t(`learn.quest.gate${questGate}.task`);
        if (questGateProgressEl) {
            questGateProgressEl.textContent = tf("learn.quest.gateProgress", {
                n: questGate,
                known: stats.known,
                total: stats.total,
                pct: stats.pct,
            });
        }
        if (questBarFill)
            questBarFill.style.width = `${Math.min(100, stats.pct)}%`;
        const next = nextPlayableGate(questGate);
        if (questPassEl) {
            if (isGateCleared(questGate)) {
                questPassEl.hidden = false;
                questPassEl.textContent =
                    questGate === 5 && allGatesCleared()
                        ? t("learn.quest.passFinal")
                        : tf("learn.quest.passToast", { badge: t(`learn.quest.badge${questGate}`) });
                if (celebrate) {
                    questPassEl.classList.remove("is-celebrating");
                    void questPassEl.offsetWidth;
                    questPassEl.classList.add("is-celebrating");
                    if (celebrateTimer != null)
                        window.clearTimeout(celebrateTimer);
                    celebrateTimer = window.setTimeout(() => {
                        questPassEl?.classList.remove("is-celebrating");
                        celebrateTimer = null;
                    }, 1600);
                }
            }
            else {
                questPassEl.hidden = true;
                questPassEl.textContent = "";
                questPassEl.classList.remove("is-celebrating");
            }
        }
        if (questSessionNextBtn) {
            const showNext = isGateCleared(questGate) && next != null;
            questSessionNextBtn.hidden = !showNext;
            if (showNext)
                questSessionNextBtn.dataset.nextGate = String(next);
        }
    }
    function renderQuestMap() {
        if (!questGatesEl)
            return;
        questGatesEl.replaceChildren();
        questGatesEl.classList.add("ziyin-quest__path");
        if (questMasterEl)
            questMasterEl.hidden = !allGatesCleared();
        updateDailyUi();
        const recommended = recommendedGate();
        if (questFocusGate == null || !isGateUnlocked(questFocusGate)) {
            questFocusGate = recommended;
        }
        for (const gate of [1, 2, 3, 4, 5]) {
            const unlocked = isGateUnlocked(gate);
            const cleared = isGateCleared(gate);
            const stats = gateStats(gate);
            const state = !unlocked ? "locked" : cleared ? "cleared" : "open";
            const li = document.createElement("li");
            li.className = "ziyin-quest__gate";
            li.dataset.gate = String(gate);
            li.dataset.state = state;
            if (gate === recommended && state === "open")
                li.dataset.recommended = "true";
            const node = document.createElement("button");
            node.type = "button";
            node.className = "ziyin-quest__node";
            node.disabled = !unlocked;
            node.addEventListener("click", () => setQuestFocus(gate));
            node.setAttribute("aria-label", tf("learn.quest.gateTitle", { n: gate, name: levelLabel(gate) }));
            node.setAttribute("aria-pressed", questFocusGate === gate ? "true" : "false");
            const mark = document.createElement("span");
            mark.className = "ziyin-quest__node-mark";
            mark.setAttribute("aria-hidden", "true");
            if (!unlocked)
                mark.textContent = "🔒";
            else if (cleared)
                mark.textContent = "✅";
            else
                mark.textContent = "🟡";
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
            questGatesEl.append(li);
        }
        updateQuestFocusUi();
    }
    function updateProgressUi() {
        const total = reviewBaseItems().length;
        const knownCount = progress.known.filter((han) => reviewBaseItems().some((it) => it.han === han)).length;
        const unknownCount = progress.unknown.filter((han) => reviewBaseItems().some((it) => it.han === han)).length;
        const dueCount = dueHans().filter((han) => reviewBaseItems().some((it) => it.han === han)).length;
        if (flashProgressEl) {
            if (learnMode === "quest" && questGate != null) {
                const stats = gateStats(questGate);
                flashProgressEl.textContent = tf("learn.quest.gateProgress", {
                    n: questGate,
                    known: stats.known,
                    total: stats.total,
                    pct: stats.pct,
                });
            }
            else {
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
        if (clearProgressBtn)
            clearProgressBtn.hidden = learnMode === "quest";
        if (flashGradeEl)
            flashGradeEl.hidden = !isFlashMode();
        if (learnMode === "quest") {
            updateQuestSessionUi();
            if (questGate == null)
                renderQuestMap();
        }
        updateChunkUi();
    }
    function markCard(kind) {
        const item = pool[index];
        if (!item || !isFlashMode())
            return;
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
        }
        else {
            progress.unknown.push(han);
            scheduleUnknown(han);
        }
        saveProgress(progress);
        updateProgressUi();
        if (learnMode === "quest" && questGate != null) {
            const nowCleared = isGateCleared(questGate);
            updateQuestSessionUi(!wasCleared && nowCleared);
            if (!wasCleared && nowCleared) {
                const next = nextPlayableGate(questGate);
                if (questGate === 5 && allGatesCleared())
                    showQuestCelebrate("master", questGate, null);
                else
                    showQuestCelebrate("gate", questGate, next);
            }
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
    if (noteEl && data.note)
        noteEl.textContent = data.note;
    const levelsMeta = data.levels ?? [];
    const syllabusListEl = document.getElementById("ziyin-syllabus-list");
    const syllabusTotalEl = document.getElementById("ziyin-syllabus-total");
    function renderSyllabus() {
        if (!syllabusListEl)
            return;
        const l14 = allItems.filter((it) => {
            const lv = it.level ?? 1;
            return lv >= 1 && lv <= 4;
        });
        if (syllabusTotalEl) {
            syllabusTotalEl.textContent = tf("learn.syllabus.total", { n: l14.length });
        }
        const descKey = (lv) => `learn.syllabus.l${lv}desc`;
        syllabusListEl.replaceChildren();
        for (const lv of [1, 2, 3, 4, 5]) {
            const hans = lv === 5
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
            }
            else {
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
    const CHUNK_SIZE = 100;
    const CHUNK_KEY = "yueyu-ziyin-gate5-chunk-v1";
    const EXPORT_NUDGE_KEY = "yueyu-ziyin-export-nudge-v1";
    let gate5Chunk = 0;
    function loadGate5Chunk() {
        try {
            const n = Number(localStorage.getItem(CHUNK_KEY));
            return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
        }
        catch {
            return 0;
        }
    }
    function saveGate5Chunk(n) {
        localStorage.setItem(CHUNK_KEY, String(n));
    }
    function gate5ChunkCount() {
        return Math.max(1, Math.ceil(reviewBaseItems().length / CHUNK_SIZE));
    }
    function clampGate5Chunk(n) {
        return Math.max(0, Math.min(gate5ChunkCount() - 1, n));
    }
    function itemsForGate5Chunk(chunk) {
        const base = reviewBaseItems();
        const start = chunk * CHUNK_SIZE;
        return base.slice(start, start + CHUNK_SIZE);
    }
    function chunkStats(chunk) {
        const items = itemsForGate5Chunk(chunk);
        const knownSet = new Set(progress.known);
        const known = items.filter((it) => knownSet.has(it.han)).length;
        const size = items.length || 1;
        return { known, size: items.length, pct: Math.floor((known / size) * 100) };
    }
    function preferredGate5Chunk() {
        const total = gate5ChunkCount();
        for (let i = 0; i < total; i += 1) {
            if (chunkStats(i).pct < Math.floor(QUEST_PASS * 100))
                return i;
        }
        return clampGate5Chunk(loadGate5Chunk());
    }
    function usesGate5Chunks() {
        if (reviewWrongOnly || reviewDueOnly)
            return false;
        if (learnMode === "quest")
            return questGate === 5;
        return level === 5;
    }
    function buildFlashPool() {
        if (learnMode === "quest" && questGate != null) {
            if (questGate === 5) {
                gate5Chunk = clampGate5Chunk(gate5Chunk);
                return itemsForGate5Chunk(gate5Chunk).slice();
            }
            return gateItems(questGate).slice();
        }
        const base = reviewBaseItems();
        if (reviewWrongOnly) {
            const wrong = new Set(progress.unknown);
            const filtered = base.filter((it) => wrong.has(it.han));
            return filtered.length ? filtered : base.slice();
        }
        if (reviewDueOnly) {
            const due = new Set(dueHans());
            const filtered = base.filter((it) => due.has(it.han));
            return filtered.length ? filtered : base.slice();
        }
        if (level === 5) {
            gate5Chunk = clampGate5Chunk(gate5Chunk);
            return itemsForGate5Chunk(gate5Chunk).slice();
        }
        return base.slice();
    }
    function updateChunkUi() {
        const questChrome = document.getElementById("ziyin-chunk-chrome");
        const classicChromeChunk = document.getElementById("ziyin-chunk-chrome-classic");
        const questStatus = document.getElementById("ziyin-chunk-status");
        const classicStatus = document.getElementById("ziyin-chunk-status-classic");
        const show = usesGate5Chunks() && isFlashMode();
        if (questChrome)
            questChrome.hidden = !(show && learnMode === "quest");
        if (classicChromeChunk)
            classicChromeChunk.hidden = !(show && learnMode === "classic");
        if (!show)
            return;
        const stats = chunkStats(gate5Chunk);
        const text = tf("learn.quest.chunkStatus", {
            current: gate5Chunk + 1,
            total: gate5ChunkCount(),
            known: stats.known,
            size: stats.size,
        });
        if (questStatus)
            questStatus.textContent = `${text} · ${t("learn.quest.chunkHint")}`;
        if (classicStatus)
            classicStatus.textContent = text;
        const atStart = gate5Chunk <= 0;
        const atEnd = gate5Chunk >= gate5ChunkCount() - 1;
        for (const id of ["ziyin-chunk-prev", "ziyin-chunk-prev-classic"]) {
            const btn = document.getElementById(id);
            if (btn)
                btn.disabled = atStart;
        }
        for (const id of ["ziyin-chunk-next", "ziyin-chunk-next-classic"]) {
            const btn = document.getElementById(id);
            if (btn)
                btn.disabled = atEnd;
        }
    }
    function setGate5Chunk(next, reload = true) {
        gate5Chunk = clampGate5Chunk(next);
        saveGate5Chunk(gate5Chunk);
        if (!reload) {
            updateChunkUi();
            return;
        }
        if (learnMode === "quest" && questGate === 5) {
            pool = itemsForGate5Chunk(gate5Chunk).slice();
            shuffleInPlace(pool);
            index = 0;
            updateChunkUi();
            updateProgressUi();
            paint();
            return;
        }
        if (learnMode === "classic" && level === 5) {
            setLevel(5, true);
        }
    }
    let level = 1;
    let pool = allItems.filter((it) => (it.level ?? 1) === level);
    if (!pool.length)
        pool = allItems;
    let index = 0;
    let flipped = false;
    let paintToken = 0;
    const player = new Audio();
    player.preload = "none";
    gate5Chunk = clampGate5Chunk(loadGate5Chunk());
    function isFlashMode() {
        if (learnMode === "quest")
            return questGate != null;
        return level === 5;
    }
    function levelLabel(lv) {
        const meta = levelsMeta.find((m) => m.id === lv);
        const lang = document.documentElement.lang || "zh-Hans";
        if (!meta)
            return `第${lv}阶`;
        if (lang === "en")
            return meta.nameEn ?? meta.name;
        if (lang === "zh-Hant")
            return meta.nameHant ?? meta.name;
        return meta.name;
    }
    function setAudioHint(key, detail = "") {
        if (!audioStatusEl)
            return;
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
        };
        const table = messages[key];
        audioStatusEl.textContent =
            (lang === "zh-Hant" ? table["zh-Hant"] : lang === "en" ? table.en : table["zh-Hans"]) || table.en;
    }
    function setFlipped(next) {
        flipped = next;
        flashCard.classList.toggle("is-flipped", flipped);
        flashCard.setAttribute("aria-pressed", flipped ? "true" : "false");
    }
    function syncModeUi() {
        const flash = isFlashMode();
        const inQuestMap = learnMode === "quest" && questGate == null;
        const inQuestSession = learnMode === "quest" && questGate != null;
        if (classicChrome)
            classicChrome.hidden = learnMode === "quest";
        if (questMapEl)
            questMapEl.hidden = !inQuestMap;
        if (questSessionEl)
            questSessionEl.hidden = !inQuestSession;
        stage.hidden = inQuestMap;
        stage.classList.toggle("ziyin-stage--quest", inQuestSession);
        stage.classList.toggle("ziyin-stage--flash", flash);
        drillEl.hidden = flash;
        flashEl.hidden = !flash;
        if (modeNoteEl)
            modeNoteEl.hidden = !flash || learnMode === "quest";
        if (shuffleBtn)
            shuffleBtn.hidden = !flash;
        randomBtn.hidden = flash;
        if (flashGradeEl)
            flashGradeEl.hidden = !flash;
        if (!flash) {
            setFlipped(false);
            reviewWrongOnly = false;
        }
        modeButtons.forEach((btn) => {
            btn.setAttribute("aria-pressed", btn.dataset.learnMode === learnMode ? "true" : "false");
        });
        const classicStageHint = document.getElementById("ziyin-classic-stage-hint");
        if (classicStageHint)
            classicStageHint.hidden = learnMode !== "classic" || inQuestMap;
        updateProgressUi();
        updateChunkUi();
    }
    function setLearnMode(mode) {
        learnMode = mode;
        saveLearnMode(mode);
        questGate = null;
        reviewWrongOnly = false;
        reviewDueOnly = false;
        if (mode === "classic") {
            setLevel(level >= 1 && level <= 5 ? level : 1, true);
        }
        else {
            syncModeUi();
            renderQuestMap();
        }
    }
    function enterQuestGate(gate) {
        if (!isGateUnlocked(gate))
            return;
        questGate = gate;
        level = gate;
        reviewWrongOnly = false;
        reviewDueOnly = false;
        if (gate === 5) {
            gate5Chunk = preferredGate5Chunk();
            saveGate5Chunk(gate5Chunk);
        }
        pool = buildFlashPool();
        if (!pool.length)
            pool = reviewBaseItems().slice();
        shuffleInPlace(pool);
        index = 0;
        if (levelNameEl)
            levelNameEl.textContent = levelLabel(gate);
        syncModeUi();
        updateChunkUi();
        paint();
        stage.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    function leaveQuestGate() {
        const previous = questGate;
        questGate = null;
        questFocusGate = previous != null ? nextPlayableGate(previous - 1) ?? previous : recommendedGate();
        syncModeUi();
        renderQuestMap();
        questMapEl?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    async function refreshListenButtons(item) {
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
        if (token !== paintToken)
            return;
        for (const btn of listenBtns) {
            btn.disabled = !ok;
            btn.dataset.audioUrl = ok ? url : "";
        }
        if (!ok)
            setAudioHint("missing");
        else
            setAudioHint(isFlashMode() ? "flashHint" : "hint");
    }
    function paint() {
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
        if (glossEl)
            glossEl.textContent = gloss || "—";
        if (glossRow)
            glossRow.hidden = !gloss;
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
        if (shuffleBtn)
            shuffleBtn.disabled = pool.length <= 1;
        void refreshListenButtons(item);
    }
    function setLevel(next, resetIndex = true) {
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
            if (learnMode === "classic" && next === 5 && !reviewWrongOnly && !reviewDueOnly) {
                gate5Chunk = preferredGate5Chunk();
                saveGate5Chunk(gate5Chunk);
            }
            pool = buildFlashPool();
            if (reviewWrongOnly && !pool.length)
                reviewWrongOnly = false;
            if (reviewDueOnly && !pool.length)
                reviewDueOnly = false;
            if (!pool.length)
                pool = reviewBaseItems().slice();
        }
        else {
            pool = allItems.filter((it) => (it.level ?? 1) === level);
        }
        if (!pool.length)
            pool = allItems.slice();
        else
            pool = pool.slice();
        if (isFlashMode())
            shuffleInPlace(pool);
        if (resetIndex)
            index = 0;
        else
            index = Math.min(index, Math.max(0, pool.length - 1));
        levelButtons.forEach((btn) => {
            const lv = Number(btn.dataset.ziyinLevel);
            btn.setAttribute("aria-pressed", lv === level ? "true" : "false");
        });
        if (levelNameEl)
            levelNameEl.textContent = levelLabel(level);
        syncModeUi();
        updateChunkUi();
        paint();
    }
    /** Deep-link / Pathways helper. */
    function openZiyinLevel(lv) {
        setLearnMode("classic");
        openLearnSection("fayin");
        setLevel(lv, true);
        stage.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    function openQuest(gate) {
        openLearnSection("fayin");
        setLearnMode("quest");
        if (gate != null && isGateUnlocked(gate))
            enterQuestGate(gate);
        else
            questMapEl?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    window.__yueyuOpenZiyinLevel = openZiyinLevel;
    window.__yueyuOpenQuest = openQuest;
    async function playShengzhou(fromBtn) {
        const item = pool[index];
        if (!item)
            return;
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
        }
        catch {
            setAudioHint("error");
            for (const btn of listenBtns)
                btn.disabled = true;
        }
    }
    levelButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            if (learnMode !== "classic")
                return;
            const lv = Number(btn.dataset.ziyinLevel);
            if (!Number.isFinite(lv))
                return;
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
    questFocusEnterBtn?.addEventListener("click", () => {
        if (questFocusGate != null)
            enterQuestGate(questFocusGate);
    });
    questFocusNextBtn?.addEventListener("click", () => {
        const next = Number(questFocusNextBtn.dataset.nextGate);
        if (Number.isFinite(next))
            enterQuestGate(next);
    });
    questSessionNextBtn?.addEventListener("click", () => {
        const next = Number(questSessionNextBtn.dataset.nextGate);
        if (Number.isFinite(next)) {
            hideQuestCelebrate();
            enterQuestGate(next);
        }
    });
    celebrateCloseBtn?.addEventListener("click", () => hideQuestCelebrate());
    celebrateNextBtn?.addEventListener("click", () => {
        const next = Number(celebrateNextBtn.dataset.nextGate);
        hideQuestCelebrate();
        if (Number.isFinite(next))
            enterQuestGate(next);
    });
    celebrateEl?.addEventListener("click", (event) => {
        if (event.target === celebrateEl)
            hideQuestCelebrate();
    });
    const bindChunkNav = (prevId, nextId) => {
        document.getElementById(prevId)?.addEventListener("click", () => setGate5Chunk(gate5Chunk - 1));
        document.getElementById(nextId)?.addEventListener("click", () => setGate5Chunk(gate5Chunk + 1));
    };
    bindChunkNav("ziyin-chunk-prev", "ziyin-chunk-next");
    bindChunkNav("ziyin-chunk-prev-classic", "ziyin-chunk-next-classic");
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
        if (!file)
            return;
        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            const next = parsed.progress;
            if (!next || !Array.isArray(next.known))
                throw new Error("bad");
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
        }
        catch {
            if (questDailyEl) {
                questDailyEl.hidden = false;
                questDailyEl.textContent = t("learn.quest.importFail");
            }
        }
    });
    prevBtn.addEventListener("click", () => {
        if (!pool.length)
            return;
        index = (index - 1 + pool.length) % pool.length;
        paint();
    });
    nextBtn.addEventListener("click", () => {
        if (!pool.length)
            return;
        index = (index + 1) % pool.length;
        paint();
    });
    randomBtn.addEventListener("click", () => {
        if (pool.length < 2)
            return;
        let next = index;
        while (next === index)
            next = Math.floor(Math.random() * pool.length);
        index = next;
        paint();
    });
    shuffleBtn?.addEventListener("click", () => {
        if (pool.length < 2)
            return;
        const previous = pool[index];
        shuffleInPlace(pool);
        // Start at the top of the new deck so the learner sees a new route immediately.
        index = 0;
        if (previous && pool[0] === previous) {
            // Extremely rare after a full shuffle, but avoid a no-op first card.
            const swapWith = 1 + Math.floor(Math.random() * (pool.length - 1));
            const a = pool[0];
            const b = pool[swapWith];
            pool[0] = b;
            pool[swapWith] = a;
        }
        paint();
    });
    knowBtn?.addEventListener("click", () => markCard("known"));
    unknownBtn?.addEventListener("click", () => markCard("unknown"));
    reviewWrongBtn?.addEventListener("click", () => {
        reviewWrongOnly = !reviewWrongOnly;
        if (reviewWrongOnly)
            reviewDueOnly = false;
        setLevel(5, true);
    });
    reviewDueBtn?.addEventListener("click", () => {
        reviewDueOnly = !reviewDueOnly;
        if (reviewDueOnly)
            reviewWrongOnly = false;
        setLevel(5, true);
    });
    clearProgressBtn?.addEventListener("click", () => {
        progress = { known: [], unknown: [], due: {}, box: {} };
        saveProgress(progress);
        reviewWrongOnly = false;
        reviewDueOnly = false;
        updateProgressUi();
        if (isFlashMode())
            setLevel(learnMode === "quest" && questGate != null ? questGate : 5, true);
        if (learnMode === "quest")
            renderQuestMap();
    });
    flashCard.addEventListener("click", (event) => {
        const target = event.target;
        if (target?.closest("button"))
            return;
        setFlipped(!flipped);
    });
    flashCard.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ")
            return;
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
    document.getElementById("learn-open-ipa")?.addEventListener("click", () => {
        openLearnSection("ipa");
    });
    document.getElementById("learn-ipa-to-pinyin")?.addEventListener("click", () => {
        openLearnSection("pinyin");
    });
    document.getElementById("learn-ipa-to-fayin")?.addEventListener("click", () => {
        openLearnSection("fayin");
        setLearnMode("classic");
        setLevel(1, true);
        stage.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    document.getElementById("dict-open-ipa-primer")?.addEventListener("click", () => {
        history.replaceState(null, "", "#learn-ipa");
        document.querySelector(`.site-nav [data-panel-target="learn"]`)?.click();
        openLearnSection("ipa");
    });
    const observer = new MutationObserver(() => {
        if (levelNameEl)
            levelNameEl.textContent = levelLabel(level);
        statusEl.textContent = pool.length
            ? `${index + 1} / ${pool.length} · ${levelLabel(level)}`
            : `0 / 0 · ${levelLabel(level)}`;
        setAudioHint(isFlashMode() ? "flashHint" : "hint");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    onLocaleChange(() => {
        renderSyllabus();
        updateProgressUi();
        if (learnMode === "quest" && questGate == null)
            renderQuestMap();
        else if (learnMode === "quest")
            updateQuestSessionUi();
        updateQuestFocusUi();
        updateChunkUi();
    });
    renderSyllabus();
    updateProgressUi();
    if (learnMode === "quest") {
        setLearnMode("quest");
    }
    else {
        setLevel(1, true);
    }
    if (learnMode === "classic")
        stage.removeAttribute("hidden");
}
document.addEventListener("DOMContentLoaded", () => {
    void initZiyin().catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        const status = document.getElementById("ziyin-status");
        if (status)
            status.textContent = `加载失败：${message}`;
    });
});
//# sourceMappingURL=ziyin.js.map