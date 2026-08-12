"use strict";
/** Single-character drill: Mandarin pinyin + 上虞 / 诸暨 / 嵊州 IPA; speaker audio for Shengzhou only. */
function requireEl(el, name) {
    if (!el)
        throw new Error(`Missing element: ${name}`);
    return el;
}
function openLearnSection(target) {
    const link = document.querySelector(`[data-learn-target="${target}"]`);
    link?.click();
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
        // Some static hosts reject HEAD — try a tiny ranged GET
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
    const hanEl = requireEl(document.getElementById("ziyin-han"), "ziyin-han");
    const pinyinEl = requireEl(document.getElementById("ziyin-pinyin"), "ziyin-pinyin");
    const shangyuEl = requireEl(document.getElementById("ziyin-shangyu"), "ziyin-shangyu");
    const zhujiEl = requireEl(document.getElementById("ziyin-zhuji"), "ziyin-zhuji");
    const shengzhouEl = requireEl(document.getElementById("ziyin-shengzhou"), "ziyin-shengzhou");
    const glossEl = document.getElementById("ziyin-gloss");
    const glossRow = document.getElementById("ziyin-gloss-row");
    const speakerEl = document.getElementById("ziyin-speaker");
    const tagEl = requireEl(document.getElementById("ziyin-tag"), "ziyin-tag");
    const statusEl = requireEl(document.getElementById("ziyin-status"), "ziyin-status");
    const audioStatusEl = document.getElementById("ziyin-audio-status");
    const noteEl = document.getElementById("ziyin-note");
    const levelNameEl = document.getElementById("ziyin-level-name");
    const levelButtons = Array.from(document.querySelectorAll("[data-ziyin-level]"));
    const prevBtn = requireEl(document.getElementById("ziyin-prev"), "ziyin-prev");
    const nextBtn = requireEl(document.getElementById("ziyin-next"), "ziyin-next");
    const randomBtn = requireEl(document.getElementById("ziyin-random"), "ziyin-random");
    const startBtn = document.getElementById("learn-start-fayin");
    const listenBtn = document.getElementById("ziyin-listen-shengzhou");
    const res = await fetch("data/learn/ziyin.json?v=20260812a");
    if (!res.ok)
        throw new Error(`ziyin HTTP ${res.status}`);
    const data = (await res.json());
    const allItems = data.items.filter((it) => it.han?.trim());
    if (!allItems.length)
        throw new Error("ziyin list empty");
    if (noteEl && data.note)
        noteEl.textContent = data.note;
    const levelsMeta = data.levels ?? [];
    let level = 1;
    let pool = allItems.filter((it) => (it.level ?? 1) === level);
    if (!pool.length)
        pool = allItems;
    let index = 0;
    let paintToken = 0;
    const player = new Audio();
    player.preload = "none";
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
    async function refreshListenButton(item) {
        if (!listenBtn)
            return;
        const token = ++paintToken;
        listenBtn.disabled = true;
        listenBtn.dataset.audioUrl = "";
        const url = resolveAudioUrl(item, "shengzhou");
        if (!url) {
            setAudioHint("hint");
            return;
        }
        const ok = await audioExists(url);
        if (token !== paintToken)
            return;
        listenBtn.disabled = !ok;
        listenBtn.dataset.audioUrl = ok ? url : "";
        if (!ok)
            setAudioHint("hint");
    }
    function paint() {
        const item = pool[index];
        if (!item) {
            statusEl.textContent = `0 / 0 · ${levelLabel(level)}`;
            return;
        }
        player.pause();
        hanEl.textContent = item.han;
        pinyinEl.textContent = item.pinyin;
        shangyuEl.textContent = item.shangyu;
        zhujiEl.textContent = item.zhuji;
        shengzhouEl.textContent = item.shengzhou;
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
        void refreshListenButton(item);
    }
    function setLevel(next, resetIndex = true) {
        level = next;
        pool = allItems.filter((it) => (it.level ?? 1) === level);
        if (!pool.length)
            pool = allItems;
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
        paint();
    }
    async function playShengzhou() {
        const item = pool[index];
        if (!item)
            return;
        const url = listenBtn?.dataset.audioUrl || resolveAudioUrl(item, "shengzhou");
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
            if (listenBtn)
                listenBtn.disabled = true;
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
    listenBtn?.addEventListener("click", () => {
        void playShengzhou();
    });
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
        setAudioHint("hint");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
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