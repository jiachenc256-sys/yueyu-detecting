/** Full-book tanci reader: PDF page images + per-page OCR text (+ EN/繁 translate). */
import { initA11y } from "./a11y.js";
import { getLocale, initI18n, onLocaleChange } from "./i18n.js";
const PDFJS_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.min.mjs";
const PDFJS_WORKER = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs";
const PRODUCTION_API = "https://talcne.onrender.com";
const MYMEMORY_CHUNK = 420;
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
function getApiBase() {
    return PRODUCTION_API;
}
function chunkText(text, max = MYMEMORY_CHUNK) {
    const cleaned = text.trim();
    if (!cleaned)
        return [];
    if (cleaned.length <= max)
        return [cleaned];
    const parts = [];
    let rest = cleaned;
    while (rest.length > max) {
        let cut = rest.lastIndexOf("\n", max);
        if (cut < max * 0.4)
            cut = rest.lastIndexOf("。", max);
        if (cut < max * 0.4)
            cut = rest.lastIndexOf("，", max);
        if (cut < max * 0.4)
            cut = max;
        parts.push(rest.slice(0, cut).trim());
        rest = rest.slice(cut).trim();
    }
    if (rest)
        parts.push(rest);
    return parts.filter(Boolean);
}
async function translateWithMyMemory(text, from, to) {
    const url = new URL("https://api.mymemory.translated.net/get");
    url.searchParams.set("q", text.slice(0, 450));
    url.searchParams.set("langpair", `${from}|${to}`);
    const res = await fetch(url.toString());
    if (!res.ok)
        throw new Error(`Translation HTTP ${res.status}`);
    const data = (await res.json());
    const out = data.responseData?.translatedText?.trim();
    if (!out)
        throw new Error("Empty translation");
    if (/MYMEMORY WARNING/i.test(out))
        throw new Error("Translation quota exceeded — try again later");
    return out;
}
async function translateLong(text, from, to) {
    const chunks = chunkText(text);
    const out = [];
    for (const chunk of chunks) {
        out.push(await translateWithMyMemory(chunk, from, to));
    }
    return out.join("\n").trim();
}
async function loadPdfJs() {
    if (window.pdfjsLib)
        return window.pdfjsLib;
    const mod = (await import(/* @vite-ignore */ PDFJS_URL));
    mod.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    window.pdfjsLib = mod;
    return mod;
}
async function init() {
    initA11y();
    initI18n();
    const pieceId = document.body.dataset.pieceId?.trim() || "pearl-tower-gift";
    const stage = requireEl(document.getElementById("tanci-stage"), "tanci-stage");
    const canvas = requireEl(document.getElementById("tanci-canvas"), "tanci-canvas");
    const pageLabel = requireEl(document.getElementById("tanci-page-label"), "tanci-page-label");
    const pageInput = requireEl(document.getElementById("tanci-page-input"), "tanci-page-input");
    const readingEl = requireEl(document.getElementById("tanci-reading"), "tanci-reading");
    const pageTextEl = requireEl(document.getElementById("tanci-page-text"), "tanci-page-text");
    const notesEl = requireEl(document.getElementById("tanci-notes"), "tanci-notes");
    const sourceEl = requireEl(document.getElementById("tanci-source"), "tanci-source");
    const statusEl = requireEl(document.getElementById("tanci-ocr-status"), "tanci-ocr-status");
    const prevBtn = requireEl(document.getElementById("tanci-prev"), "tanci-prev");
    const nextBtn = requireEl(document.getElementById("tanci-next"), "tanci-next");
    const ocrBtn = requireEl(document.getElementById("tanci-ocr-page"), "tanci-ocr-page");
    const titleEl = document.querySelector(".tanci-reader__title");
    const metaEl = document.querySelector(".tanci-reader__meta");
    const [metaRes, pagesRes] = await Promise.all([
        fetch(`../data/tanci/${pieceId}.json`),
        fetch(`../data/tanci/${pieceId}.pages.json`),
    ]);
    if (!metaRes.ok)
        throw new Error(`meta HTTP ${metaRes.status}`);
    if (!pagesRes.ok)
        throw new Error(`pages HTTP ${pagesRes.status}`);
    const meta = (await metaRes.json());
    const pagesFile = (await pagesRes.json());
    if (titleEl)
        titleEl.textContent = meta.title;
    document.title = `${meta.title} · 越语侦听`;
    const byN = new Map();
    for (const p of pagesFile.pages)
        byN.set(p.n, p);
    let readLang = langForLocale(getLocale());
    let page = 1;
    let pdfDoc = null;
    let rendering = false;
    let translateSeq = 0;
    function applyChrome() {
        if (metaEl)
            metaEl.textContent = readLang === "en" ? meta.titleEn : meta.title;
        sourceEl.textContent = readLang === "en" ? meta.sourceEn : meta.source;
        readingEl.textContent = meta.reading[readLang];
        notesEl.textContent = meta.notes[readLang];
    }
    function pageCopy(n) {
        const entry = byN.get(n);
        if (!entry)
            return "";
        if (readLang === "en")
            return entry.en?.trim() || "";
        if (readLang === "zhHant")
            return entry.zhHant?.trim() || entry.zh?.trim() || "";
        return entry.zh?.trim() || "";
    }
    function paintTextPanel() {
        const entry = byN.get(page);
        const text = pageCopy(page);
        pageLabel.textContent = `${page} / ${pagesFile.pageCount}`;
        pageInput.value = String(page);
        pageInput.max = String(pagesFile.pageCount);
        prevBtn.disabled = page <= 1 || rendering;
        nextBtn.disabled = page >= pagesFile.pageCount || rendering;
        if (text) {
            pageTextEl.textContent = text;
            statusEl.textContent =
                readLang === "en"
                    ? `English · page ${page}`
                    : readLang === "zhHant"
                        ? `已識別 · 第 ${page} 頁`
                        : `已识别 · 第 ${page} 页`;
            return;
        }
        const hasZh = Boolean(entry?.zh?.trim());
        if (readLang === "en" && hasZh) {
            pageTextEl.textContent = "Translating to English…";
            statusEl.textContent = `Translating · page ${page}`;
            return;
        }
        pageTextEl.textContent =
            readLang === "en"
                ? "No text for this page yet. Click “OCR this page”."
                : readLang === "zhHant"
                    ? "本頁尚無文字。可點「識別本頁」。"
                    : "本页尚无文字。可点「识别本页」。";
        const st = entry?.status || "pending";
        statusEl.textContent =
            readLang === "en" ? `Text status: ${st}` : readLang === "zhHant" ? `文字狀態：${st}` : `文字状态：${st}`;
    }
    async function ensureLangForPage(n, lang) {
        const entry = byN.get(n);
        const zh = entry?.zh?.trim();
        if (!entry || !zh)
            return;
        if (lang === "en" && !entry.en?.trim()) {
            const seq = ++translateSeq;
            statusEl.textContent = `Translating · page ${n}`;
            pageTextEl.textContent = "Translating to English…";
            try {
                const en = await translateLong(zh, "zh-CN", "en");
                if (seq !== translateSeq || page !== n || readLang !== "en")
                    return;
                entry.en = en;
                byN.set(n, entry);
                paintTextPanel();
            }
            catch (err) {
                if (seq !== translateSeq || page !== n)
                    return;
                const message = err instanceof Error ? err.message : String(err);
                pageTextEl.textContent = zh;
                statusEl.textContent = `English translation failed: ${message}`;
            }
            return;
        }
        if (lang === "zhHant" && (!entry.zhHant?.trim() || entry.zhHant.trim() === zh)) {
            try {
                const hant = await translateLong(zh, "zh-CN", "zh-TW");
                if (page !== n || readLang !== "zhHant")
                    return;
                entry.zhHant = hant || zh;
                byN.set(n, entry);
                paintTextPanel();
            }
            catch {
                /* keep zh fallback */
            }
        }
    }
    function updateText() {
        paintTextPanel();
        if (readLang === "en" || readLang === "zhHant") {
            void ensureLangForPage(page, readLang);
        }
    }
    async function renderPage(n) {
        if (!pdfDoc || rendering)
            return;
        rendering = true;
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        try {
            const pdfPage = await pdfDoc.getPage(n);
            const base = pdfPage.getViewport({ scale: 1 });
            const targetWidth = Math.min(720, canvas.parentElement?.clientWidth || 720);
            const scale = targetWidth / base.width;
            const viewport = pdfPage.getViewport({ scale });
            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);
            const ctx = canvas.getContext("2d");
            if (!ctx)
                throw new Error("canvas");
            await pdfPage.render({ canvasContext: ctx, viewport }).promise;
            page = n;
            updateText();
        }
        finally {
            rendering = false;
            updateText();
        }
    }
    async function ocrCurrentPage() {
        ocrBtn.disabled = true;
        statusEl.textContent = readLang === "en" ? "Recognizing…" : "识别中…";
        try {
            const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
            if (!blob)
                throw new Error("Could not export page image");
            const body = new FormData();
            body.append("file", blob, `page-${page}.jpg`);
            const res = await fetch(`${getApiBase()}/api/ocr`, { method: "POST", body });
            const data = (await res.json());
            if (!res.ok || data.success === false) {
                throw new Error(data.error || data.detail || `HTTP ${res.status}`);
            }
            const zh = (data.text || "").trim();
            const entry = byN.get(page) || { n: page };
            entry.zh = zh;
            entry.en = "";
            entry.zhHant = "";
            entry.status = zh ? "done" : "empty";
            byN.set(page, entry);
            updateText();
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            statusEl.textContent = (readLang === "en" ? "OCR failed: " : "识别失败：") + message;
        }
        finally {
            ocrBtn.disabled = false;
        }
    }
    document.querySelectorAll("[data-tanci-lang]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const next = btn.dataset.tanciLang;
            if (next !== "zh" && next !== "zhHant" && next !== "en")
                return;
            readLang = next;
            document.querySelectorAll("[data-tanci-lang]").forEach((b) => {
                b.setAttribute("aria-pressed", b.dataset.tanciLang === readLang ? "true" : "false");
            });
            applyChrome();
            updateText();
        });
    });
    onLocaleChange((locale) => {
        readLang = langForLocale(locale);
        document.querySelectorAll("[data-tanci-lang]").forEach((b) => {
            b.setAttribute("aria-pressed", b.dataset.tanciLang === readLang ? "true" : "false");
        });
        applyChrome();
        updateText();
    });
    prevBtn.addEventListener("click", () => {
        if (page > 1)
            void renderPage(page - 1);
    });
    nextBtn.addEventListener("click", () => {
        if (page < pagesFile.pageCount)
            void renderPage(page + 1);
    });
    pageInput.addEventListener("change", () => {
        const n = Number(pageInput.value);
        if (Number.isFinite(n) && n >= 1 && n <= pagesFile.pageCount)
            void renderPage(Math.floor(n));
        else
            updateText();
    });
    ocrBtn.addEventListener("click", () => {
        void ocrCurrentPage();
    });
    applyChrome();
    statusEl.textContent = readLang === "en" ? "Loading PDF…" : "正在加载刻本 PDF…";
    const pdfjs = await loadPdfJs();
    const pdfUrl = new URL(pagesFile.pdf, window.location.href).href;
    pdfDoc = await pdfjs.getDocument({ url: pdfUrl }).promise;
    pagesFile.pageCount = pdfDoc.numPages;
    stage.removeAttribute("hidden");
    await renderPage(1);
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