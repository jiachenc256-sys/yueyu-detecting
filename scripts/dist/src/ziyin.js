"use strict";
/** Single-character pronunciation drill (字音) for Mandarin-pinyin learners. */
function requireEl(el, name) {
    if (!el)
        throw new Error(`Missing element: ${name}`);
    return el;
}
async function initZiyin() {
    const stage = document.getElementById("ziyin-stage");
    if (!stage)
        return;
    const hanEl = requireEl(document.getElementById("ziyin-han"), "ziyin-han");
    const pinyinEl = requireEl(document.getElementById("ziyin-pinyin"), "ziyin-pinyin");
    const yueyuEl = requireEl(document.getElementById("ziyin-yueyu"), "ziyin-yueyu");
    const glossEl = requireEl(document.getElementById("ziyin-gloss"), "ziyin-gloss");
    const tagEl = requireEl(document.getElementById("ziyin-tag"), "ziyin-tag");
    const statusEl = requireEl(document.getElementById("ziyin-status"), "ziyin-status");
    const noteEl = document.getElementById("ziyin-note");
    const prevBtn = requireEl(document.getElementById("ziyin-prev"), "ziyin-prev");
    const nextBtn = requireEl(document.getElementById("ziyin-next"), "ziyin-next");
    const randomBtn = requireEl(document.getElementById("ziyin-random"), "ziyin-random");
    const audioBtn = requireEl(document.getElementById("ziyin-audio"), "ziyin-audio");
    const res = await fetch("data/learn/ziyin.json");
    if (!res.ok)
        throw new Error(`ziyin HTTP ${res.status}`);
    const data = (await res.json());
    const items = data.items.filter((it) => it.han?.trim());
    if (!items.length)
        throw new Error("ziyin list empty");
    if (noteEl && data.note)
        noteEl.textContent = data.note;
    let index = 0;
    function paint() {
        const item = items[index];
        if (!item)
            return;
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
        const hasAudio = Boolean(item.audio?.trim());
        audioBtn.disabled = !hasAudio;
        audioBtn.setAttribute("aria-disabled", hasAudio ? "false" : "true");
        if (!hasAudio) {
            audioBtn.title = "音频即将支持";
        }
        else {
            audioBtn.removeAttribute("title");
        }
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
        if (items.length < 2)
            return;
        let next = index;
        while (next === index)
            next = Math.floor(Math.random() * items.length);
        index = next;
        paint();
    });
    audioBtn.addEventListener("click", () => {
        const item = items[index];
        const src = item?.audio?.trim();
        if (!src)
            return;
        const audio = new Audio(src);
        void audio.play();
    });
    paint();
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