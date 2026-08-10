"use strict";
/** Single-character pronunciation drill (字音) for Mandarin-pinyin learners. */
function requireEl(el, name) {
    if (!el)
        throw new Error(`Missing element: ${name}`);
    return el;
}
function canUseSpeech() {
    return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}
function pickZhVoice() {
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find((v) => /^zh-CN/i.test(v.lang) && /Google|Tingting|Xiaoxiao|Yaoyao|Huihui/i.test(v.name)) ??
        voices.find((v) => /^zh-CN/i.test(v.lang)) ??
        voices.find((v) => /^zh/i.test(v.lang));
    return preferred ?? null;
}
function speakMandarin(text) {
    if (!canUseSpeech() || !text.trim())
        return false;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text.trim());
    utter.lang = "zh-CN";
    utter.rate = 0.85;
    const voice = pickZhVoice();
    if (voice)
        utter.voice = voice;
    window.speechSynthesis.speak(utter);
    return true;
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
    // Chrome loads voices asynchronously.
    if (canUseSpeech()) {
        window.speechSynthesis.getVoices();
        window.speechSynthesis.addEventListener("voiceschanged", () => {
            window.speechSynthesis.getVoices();
        });
    }
    let index = 0;
    let playing = null;
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
        const hasFile = Boolean(item.audio?.trim());
        const hasTts = canUseSpeech();
        const canPlay = hasFile || hasTts;
        audioBtn.disabled = !canPlay;
        audioBtn.setAttribute("aria-disabled", canPlay ? "false" : "true");
        if (!canPlay) {
            audioBtn.title = "此浏览器不支持语音朗读";
        }
        else if (hasFile) {
            audioBtn.title = "播放录音";
        }
        else {
            audioBtn.title = "浏览器朗读普通话读音";
        }
    }
    function playCurrent() {
        const item = items[index];
        if (!item)
            return;
        const src = item.audio?.trim();
        if (src) {
            if (canUseSpeech())
                window.speechSynthesis.cancel();
            if (playing) {
                playing.pause();
                playing = null;
            }
            const audio = new Audio(src);
            playing = audio;
            void audio.play().catch(() => {
                speakMandarin(item.han);
            });
            return;
        }
        if (!speakMandarin(item.han)) {
            statusEl.textContent = "此浏览器暂不支持朗读";
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
        playCurrent();
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