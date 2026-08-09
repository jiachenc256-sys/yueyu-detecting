import { cueMatchesQuery, enBadgeLabel, primaryDisplayText, secondaryDisplayLines, } from "./display.js";
import { getLocale, initI18n, onLocaleChange } from "./i18n.js";
import { formatTime } from "./time.js";
let transcript = null;
let activeId = null;
let searchQuery = "";
let displayMode = "trilingual";
function displayModeForSiteLocale(locale) {
    if (locale === "en")
        return "en";
    if (locale === "zh-Hant")
        return "zh-Hant";
    return "zh-Hans";
}
const audio = document.getElementById("audio");
const listEl = document.getElementById("transcript-list");
const searchInput = document.getElementById("search-input");
const nowTimeEl = document.getElementById("now-time");
const nowLineEl = document.getElementById("now-line");
const cueCountEl = document.getElementById("cue-count");
const coverageEl = document.getElementById("coverage-stats");
const modeButtons = document.querySelectorAll("[data-display-mode]");
function requireEl(el, name) {
    if (!el)
        throw new Error(`Missing element: ${name}`);
    return el;
}
function findActiveCue(time) {
    if (!transcript)
        return null;
    return transcript.cues.find((cue) => time >= cue.start && time < cue.end) ?? null;
}
function setActiveCue(id, scroll = true) {
    const list = requireEl(listEl, "transcript-list");
    const changed = activeId !== id;
    activeId = id;
    list.querySelectorAll(".transcript-line").forEach((el) => {
        const isActive = Number(el.dataset.id) === id;
        el.classList.toggle("transcript-line--active", isActive);
        el.setAttribute("aria-current", isActive ? "true" : "false");
        if (isActive && scroll && changed) {
            el.scrollIntoView({ block: "center", behavior: "smooth" });
        }
    });
    const cue = transcript?.cues.find((c) => c.id === id);
    if (nowLineEl) {
        nowLineEl.textContent = cue ? primaryDisplayText(cue, displayMode) : "—";
    }
}
/** Jump to a cue time and play — waits for seek so mid-piece clicks work. */
async function seekAndPlay(audioEl, seconds) {
    const duration = Number.isFinite(audioEl.duration) ? audioEl.duration : Number.POSITIVE_INFINITY;
    const target = Math.min(Math.max(0, seconds), Math.max(0, duration - 0.05));
    if (audioEl.readyState < HTMLMediaElement.HAVE_METADATA) {
        await new Promise((resolve, reject) => {
            const onLoaded = () => {
                cleanup();
                resolve();
            };
            const onError = () => {
                cleanup();
                reject(new Error("Audio failed to load"));
            };
            const cleanup = () => {
                audioEl.removeEventListener("loadedmetadata", onLoaded);
                audioEl.removeEventListener("error", onError);
            };
            audioEl.addEventListener("loadedmetadata", onLoaded, { once: true });
            audioEl.addEventListener("error", onError, { once: true });
            audioEl.load();
        });
    }
    if (Math.abs(audioEl.currentTime - target) > 0.05) {
        await new Promise((resolve) => {
            let done = false;
            let timer = 0;
            const finish = () => {
                if (done)
                    return;
                done = true;
                audioEl.removeEventListener("seeked", onSeeked);
                window.clearTimeout(timer);
                resolve();
            };
            const onSeeked = () => finish();
            audioEl.addEventListener("seeked", onSeeked);
            const media = audioEl;
            try {
                if (typeof media.fastSeek === "function")
                    media.fastSeek(target);
                else
                    audioEl.currentTime = target;
            }
            catch {
                audioEl.currentTime = target;
            }
            timer = window.setTimeout(() => {
                if (Math.abs(audioEl.currentTime - target) > 0.35) {
                    try {
                        audioEl.currentTime = target;
                    }
                    catch {
                        /* ignore */
                    }
                }
                finish();
            }, 500);
        });
    }
    if (nowTimeEl)
        nowTimeEl.textContent = formatTime(audioEl.currentTime);
    try {
        await audioEl.play();
    }
    catch {
        // Autoplay may be blocked until a second gesture; seek still applied.
    }
}
function renderTranscript() {
    if (!transcript)
        return;
    const list = requireEl(listEl, "transcript-list");
    const audioEl = requireEl(audio, "audio");
    list.innerHTML = "";
    for (const cue of transcript.cues) {
        const matches = cueMatchesQuery(cue, searchQuery);
        const li = document.createElement("li");
        li.className = "transcript-line";
        if (!matches)
            li.classList.add("transcript-line--hidden");
        li.dataset.id = String(cue.id);
        li.setAttribute("role", "button");
        li.tabIndex = 0;
        const time = document.createElement("time");
        time.className = "transcript-line__time";
        time.textContent = formatTime(cue.start);
        time.dateTime = `${cue.start}s`;
        const body = document.createElement("div");
        body.className = "transcript-line__body";
        const text = document.createElement("span");
        text.className = "transcript-line__text";
        text.textContent = primaryDisplayText(cue, displayMode);
        body.appendChild(text);
        for (const line of secondaryDisplayLines(cue, displayMode)) {
            const extra = document.createElement("span");
            extra.className = "transcript-line__en";
            extra.textContent = line;
            body.appendChild(extra);
        }
        const showBadge = displayMode === "en" || displayMode === "trilingual";
        const badge = enBadgeLabel(cue);
        if (badge && showBadge) {
            const mark = document.createElement("span");
            mark.className = `transcript-line__badge transcript-line__badge--${cue.layers.en?.status ?? "mt"}`;
            mark.textContent = badge;
            body.appendChild(mark);
        }
        if (displayMode !== "en" &&
            cue.rawAsr &&
            cue.rawAsr !== cue.layers.zh.text &&
            (cue.layers.zh.status === "corrected" || cue.layers.zh.status === "reviewed")) {
            const raw = document.createElement("span");
            raw.className = "transcript-line__raw";
            raw.textContent = cue.rawAsr;
            raw.title = "Original ASR";
            body.appendChild(raw);
        }
        li.appendChild(time);
        li.appendChild(body);
        const jumpToCue = () => {
            setActiveCue(cue.id, false);
            void seekAndPlay(audioEl, cue.start);
        };
        li.addEventListener("click", jumpToCue);
        time.title = `Jump to ${formatTime(cue.start)} and play`;
        time.addEventListener("click", (event) => {
            event.stopPropagation();
            jumpToCue();
        });
        li.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                jumpToCue();
            }
        });
        list.appendChild(li);
    }
}
function onTimeUpdate() {
    const audioEl = requireEl(audio, "audio");
    if (nowTimeEl)
        nowTimeEl.textContent = formatTime(audioEl.currentTime);
    const cue = findActiveCue(audioEl.currentTime);
    if (cue)
        setActiveCue(cue.id);
}
function setDisplayMode(mode) {
    displayMode = mode;
    modeButtons.forEach((btn) => {
        const active = btn.dataset.displayMode === mode;
        btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
    renderTranscript();
    if (activeId !== null)
        setActiveCue(activeId, false);
}
function normalizeMode(raw) {
    if (!raw)
        return null;
    if (raw === "zh")
        return "zh-Hans";
    if (raw === "bilingual")
        return "trilingual";
    if (raw === "zh-Hans" || raw === "zh-Hant" || raw === "en" || raw === "trilingual")
        return raw;
    return null;
}
async function init() {
    initI18n();
    const list = requireEl(listEl, "transcript-list");
    const audioEl = requireEl(audio, "audio");
    const search = requireEl(searchInput, "search-input");
    const pieceId = document.body.dataset.pieceId?.trim() ||
        document.documentElement.dataset.pieceId?.trim() ||
        "longmen-kezhai";
    const response = await fetch(`../data/transcripts/${pieceId}.json`);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    transcript = (await response.json());
    if (cueCountEl) {
        cueCountEl.textContent = `${transcript.cueCount.toLocaleString()} lines · ${transcript.correctedCount} zh corrected`;
    }
    if (coverageEl) {
        const { enCurated, enMt, enAny, zh, zhHant } = transcript.coverage;
        const hant = zhHant ?? 0;
        coverageEl.textContent = `简 ${zh} · 繁 ${hant} · EN ${enAny} (curated ${enCurated}, MT ${enMt})`;
    }
    modeButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            const mode = normalizeMode(btn.dataset.displayMode);
            if (mode)
                setDisplayMode(mode);
        });
    });
    renderTranscript();
    setDisplayMode(displayModeForSiteLocale(getLocale()));
    onLocaleChange((locale) => setDisplayMode(displayModeForSiteLocale(locale)));
    audioEl.addEventListener("timeupdate", onTimeUpdate);
    search.addEventListener("input", (event) => {
        searchQuery = event.target.value;
        renderTranscript();
        if (activeId !== null)
            setActiveCue(activeId, false);
    });
}
init().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    if (listEl) {
        listEl.innerHTML = `<li class="transcript-line transcript-line--error">Failed to load transcript: ${message}</li>`;
    }
});
//# sourceMappingURL=viewer.js.map