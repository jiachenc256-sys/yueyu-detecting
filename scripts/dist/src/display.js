export function cueMatchesQuery(cue, query) {
    const q = query.trim().toLowerCase();
    if (!q)
        return true;
    const zh = cue.layers.zh.text.toLowerCase();
    const zhHant = cue.layers.zhHant?.text.toLowerCase() ?? "";
    const en = cue.layers.en?.text.toLowerCase() ?? "";
    const raw = cue.rawAsr?.toLowerCase() ?? "";
    return zh.includes(q) || zhHant.includes(q) || en.includes(q) || raw.includes(q);
}
export function primaryDisplayText(cue, mode) {
    if (mode === "en") {
        return cue.layers.en?.text ?? cue.layers.zh.text;
    }
    if (mode === "zh-Hant") {
        return cue.layers.zhHant?.text ?? cue.layers.zh.text;
    }
    // zh-Hans + trilingual primary line
    return cue.layers.zh.text;
}
/** Extra lines under the primary (繁 and/or EN depending on mode). */
export function secondaryDisplayLines(cue, mode) {
    if (mode === "trilingual") {
        const lines = [];
        const hant = cue.layers.zhHant?.text?.trim();
        const en = cue.layers.en?.text?.trim();
        if (hant)
            lines.push(hant);
        if (en)
            lines.push(en);
        return lines;
    }
    return [];
}
/** @deprecated Prefer secondaryDisplayLines; kept for older tests calling bilingual-style EN under 简. */
export function secondaryDisplayText(cue, mode) {
    if (mode === "trilingual") {
        return cue.layers.en?.text ?? null;
    }
    return null;
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