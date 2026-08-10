/** Woodblock image + text reader for tanci archive pieces (no audio timeline). */
import { initA11y } from "./a11y.js";
import { getLocale, initI18n, onLocaleChange } from "./i18n.js";
function langForLocale(locale) {
    if (locale === "en")
        return "en";
    if (locale === "zh-Hant")
        return "zhHant";
    return "zh";
}
function requireEl(el, name) {
    if (!el)
        throw new Error(`Missing element: ${name}`);
    return el;
}
async function init() {
    initA11y();
    initI18n();
    const pieceId = document.body.dataset.pieceId?.trim() || "pearl-tower-gift";
    const stage = requireEl(document.getElementById("tanci-stage"), "tanci-stage");
    const thumbs = requireEl(document.getElementById("tanci-thumbs"), "tanci-thumbs");
    const figure = requireEl(document.getElementById("tanci-figure"), "tanci-figure");
    const caption = requireEl(document.getElementById("tanci-caption"), "tanci-caption");
    const readingEl = requireEl(document.getElementById("tanci-reading"), "tanci-reading");
    const notesEl = requireEl(document.getElementById("tanci-notes"), "tanci-notes");
    const sourceEl = requireEl(document.getElementById("tanci-source"), "tanci-source");
    const titleEl = document.querySelector(".tanci-reader__title");
    const metaEl = document.querySelector(".tanci-reader__meta");
    const response = await fetch(`../data/tanci/${pieceId}.json`);
    if (!response.ok)
        throw new Error(`HTTP ${response.status}`);
    const piece = (await response.json());
    if (titleEl)
        titleEl.textContent = piece.title;
    document.title = `${piece.title} · 越语侦听`;
    let active = 0;
    let readLang = langForLocale(getLocale());
    function labelFor(img) {
        return readLang === "en" ? img.labelEn : img.labelZh;
    }
    function applyCopy() {
        if (metaEl)
            metaEl.textContent = readLang === "en" ? piece.titleEn : piece.title;
        sourceEl.textContent = readLang === "en" ? piece.sourceEn : piece.source;
        readingEl.textContent = piece.reading[readLang];
        notesEl.textContent = piece.notes[readLang];
        const current = piece.images[active];
        if (current)
            caption.textContent = labelFor(current);
    }
    function show(index) {
        const img = piece.images[index];
        if (!img)
            return;
        active = index;
        figure.src = img.src;
        figure.alt = labelFor(img);
        caption.textContent = labelFor(img);
        thumbs.querySelectorAll("[data-tanci-thumb]").forEach((btn, i) => {
            btn.setAttribute("aria-pressed", i === index ? "true" : "false");
        });
    }
    thumbs.innerHTML = "";
    piece.images.forEach((img, i) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "tanci-thumb";
        btn.dataset.tanciThumb = img.id;
        btn.setAttribute("aria-pressed", i === 0 ? "true" : "false");
        const thumb = document.createElement("img");
        thumb.src = img.src;
        thumb.alt = "";
        thumb.loading = "lazy";
        const span = document.createElement("span");
        span.textContent = labelFor(img);
        btn.append(thumb, span);
        btn.addEventListener("click", () => show(i));
        thumbs.appendChild(btn);
    });
    document.querySelectorAll("[data-tanci-lang]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const next = btn.dataset.tanciLang;
            if (next !== "zh" && next !== "zhHant" && next !== "en")
                return;
            readLang = next;
            document.querySelectorAll("[data-tanci-lang]").forEach((b) => {
                b.setAttribute("aria-pressed", b.dataset.tanciLang === readLang ? "true" : "false");
            });
            // refresh thumb labels
            thumbs.querySelectorAll("[data-tanci-thumb]").forEach((b, i) => {
                const span = b.querySelector("span");
                if (span && piece.images[i])
                    span.textContent = labelFor(piece.images[i]);
            });
            applyCopy();
        });
    });
    onLocaleChange((locale) => {
        readLang = langForLocale(locale);
        document.querySelectorAll("[data-tanci-lang]").forEach((b) => {
            b.setAttribute("aria-pressed", b.dataset.tanciLang === readLang ? "true" : "false");
        });
        thumbs.querySelectorAll("[data-tanci-thumb]").forEach((b, i) => {
            const span = b.querySelector("span");
            if (span && piece.images[i])
                span.textContent = labelFor(piece.images[i]);
        });
        applyCopy();
    });
    applyCopy();
    show(0);
    stage.removeAttribute("hidden");
}
init().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    const stage = document.getElementById("tanci-stage");
    if (stage) {
        stage.hidden = false;
        stage.innerHTML = `<p class="tanci-reader__error">Failed to load tanci piece: ${message}</p>`;
    }
});
//# sourceMappingURL=tanci-reader.js.map