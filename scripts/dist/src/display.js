export function cueMatchesQuery(cue, query) {
    const q = query.trim().toLowerCase();
    if (!q)
        return true;
    const zh = cue.layers.zh.text.toLowerCase();
    const en = cue.layers.en?.text.toLowerCase() ?? "";
    const raw = cue.rawAsr?.toLowerCase() ?? "";
    return zh.includes(q) || en.includes(q) || raw.includes(q);
}
export function primaryDisplayText(cue, mode) {
    if (mode === "en") {
        return cue.layers.en?.text ?? cue.layers.zh.text;
    }
    return cue.layers.zh.text;
}
export function secondaryDisplayText(cue, mode) {
    if (mode !== "bilingual")
        return null;
    return cue.layers.en?.text ?? null;
}
export function enBadgeLabel(cue) {
    const status = cue.layers.en?.status;
    if (!status)
        return null;
    if (status === "curated")
        return "Curated";
    if (status === "draft")
        return "Draft";
    return "MT — not authoritative";
}
//# sourceMappingURL=display.js.map