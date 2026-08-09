/** Parse SRT timestamp `HH:MM:SS,mmm` to seconds. */
export function parseSrtTime(ts) {
    const match = /^(\d{2}):(\d{2}):(\d{2}),(\d{3})$/.exec(ts.trim());
    if (!match) {
        throw new Error(`Invalid SRT timestamp: ${ts}`);
    }
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);
    const millis = Number(match[4]);
    return hours * 3600 + minutes * 60 + seconds + millis / 1000;
}
/** Format seconds as `m:ss` for the viewer UI. */
export function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0)
        return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
}
//# sourceMappingURL=time.js.map