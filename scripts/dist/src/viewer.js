import { cueMatchesQuery, enBadgeLabel, primaryDisplayText, secondaryDisplayText } from "./display.js";
import { formatTime } from "./time.js";
let transcript = null;
let activeId = null;
let searchQuery = "";
let displayMode = "bilingual";
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
    if (activeId === id)
        return;
    activeId = id;
    const list = requireEl(listEl, "transcript-list");
    list.querySelectorAll(".transcript-line").forEach((el) => {
        const isActive = Number(el.dataset.id) === id;
        el.classList.toggle("transcript-line--active", isActive);
        el.setAttribute("aria-current", isActive ? "true" : "false");
        if (isActive && scroll) {
            el.scrollIntoView({ block: "center", behavior: "smooth" });
        }
    });
    const cue = transcript?.cues.find((c) => c.id === id);
    if (nowLineEl) {
        nowLineEl.textContent = cue ? primaryDisplayText(cue, displayMode) : "—";
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
        const secondary = secondaryDisplayText(cue, displayMode);
        if (secondary) {
            const en = document.createElement("span");
            en.className = "transcript-line__en";
            en.textContent = secondary;
            body.appendChild(en);
        }
        const badge = enBadgeLabel(cue);
        if (badge && (displayMode === "en" || displayMode === "bilingual")) {
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
        li.addEventListener("click", () => {
            audioEl.currentTime = cue.start + 0.05;
            void audioEl.play();
            setActiveCue(cue.id, false);
        });
        li.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                li.click();
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
async function init() {
    const list = requireEl(listEl, "transcript-list");
    const audioEl = requireEl(audio, "audio");
    const search = requireEl(searchInput, "search-input");
    const response = await fetch("../data/transcripts/longmen-kezhai.json");
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    transcript = (await response.json());
    if (cueCountEl) {
        cueCountEl.textContent = `${transcript.cueCount.toLocaleString()} lines · ${transcript.correctedCount} zh corrected`;
    }
    if (coverageEl) {
        const { enCurated, enMt, enAny, zh } = transcript.coverage;
        coverageEl.textContent = `EN coverage: ${enAny}/${zh} (curated ${enCurated}, MT ${enMt})`;
    }
    modeButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            const mode = btn.dataset.displayMode;
            if (mode)
                setDisplayMode(mode);
        });
    });
    renderTranscript();
    setDisplayMode(displayMode);
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