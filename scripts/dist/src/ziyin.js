/** Single-character drill (L1–4) + Level 5 reveal flashcards; Shengzhou speaker audio only. */
import { onLocaleChange, t, tf } from "./i18n.js";
function requireEl(el, name) {
    if (!el)
        throw new Error(`Missing element: ${name}`);
    return el;
}
function openLearnSection(target) {
    const link = document.querySelector(`[data-learn-target="${target}"]`);
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
    const res = await fetch("data/learn/ziyin.json?v=20260812e");
    if (!res.ok)
        throw new Error(`ziyin HTTP ${res.status}`);
    const data = (await res.json());
    const allItems = data.items.filter((it) => it.han?.trim());
    if (!allItems.length)
        throw new Error("ziyin list empty");
    if (noteEl && data.note)
        noteEl.textContent = data.note;
    const levelsMeta = data.levels ?? [];
    const syllabusListEl = document.getElementById("ziyin-syllabus-list");
    const syllabusTotalEl = document.getElementById("ziyin-syllabus-total");
    function itemsForLevel(lv) {
        return allItems.filter((it) => (it.level ?? 1) === lv);
    }
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
    let level = 1;
    let pool = allItems.filter((it) => (it.level ?? 1) === level);
    if (!pool.length)
        pool = allItems;
    let index = 0;
    let flipped = false;
    let paintToken = 0;
    const player = new Audio();
    player.preload = "none";
    function isFlashMode() {
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
        drillEl.hidden = flash;
        flashEl.hidden = !flash;
        if (modeNoteEl)
            modeNoteEl.hidden = !flash;
        if (shuffleBtn)
            shuffleBtn.hidden = !flash;
        randomBtn.hidden = flash;
        stage.classList.toggle("ziyin-stage--flash", flash);
        if (!flash)
            setFlipped(false);
    }
    async function refreshListenButtons(item) {
        const token = ++paintToken;
        for (const btn of listenBtns) {
            btn.disabled = true;
            btn.dataset.audioUrl = "";
        }
        const url = resolveAudioUrl(item, "shengzhou");
        if (!url) {
            setAudioHint(isFlashMode() ? "flashHint" : "hint");
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
        const credit = item.audio?.speaker?.trim();
        if (speakerEl) {
            speakerEl.textContent = credit || "";
            speakerEl.hidden = !credit;
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
        setAudioHint(isFlashMode() ? "flashHint" : "hint");
    }
    function setLevel(next, resetIndex = true) {
        level = next;
        if (isFlashMode()) {
            // Level 5 = shuffled review of Levels 1–4 (with existing Shengzhou clips).
            pool = allItems.filter((it) => {
                const lv = it.level ?? 1;
                return lv >= 1 && lv <= 4;
            });
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
        paint();
    }
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
            const lv = Number(btn.dataset.ziyinLevel);
            if (!Number.isFinite(lv))
                return;
            setLevel(lv, true);
        });
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
        setLevel(1, true);
        stage.scrollIntoView({ behavior: "smooth", block: "start" });
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
    });
    renderSyllabus();
    setLevel(1, true);
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