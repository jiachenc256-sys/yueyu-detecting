/**
 * Archive-linked linguistic notes (genre / register / role / listen tips).
 * Shown on Speak path ① when we have a confident archive hit — not an emotion LLM.
 */
let lingCached = null;
let lingPromise = null;
let speakersCached = null;
let speakersPromise = null;
function assetUrl(rel) {
    const path = window.location.pathname;
    const dir = path.endsWith("/") ? path : path.replace(/[^/]+$/, "");
    return new URL(rel, `${window.location.origin}${dir}`).href;
}
export async function loadPieceLinguistics() {
    if (lingCached)
        return lingCached;
    if (lingPromise)
        return lingPromise;
    lingPromise = (async () => {
        try {
            const res = await fetch(assetUrl("assets/speak/piece-linguistics.json"));
            if (!res.ok)
                throw new Error(`linguistics HTTP ${res.status}`);
            lingCached = (await res.json());
            return lingCached;
        }
        catch {
            lingCached = null;
            return null;
        }
        finally {
            lingPromise = null;
        }
    })();
    return lingPromise;
}
export async function loadCueSpeakers() {
    if (speakersCached)
        return speakersCached;
    if (speakersPromise)
        return speakersPromise;
    speakersPromise = (async () => {
        try {
            const res = await fetch(assetUrl("assets/speak/cue-speakers.json"));
            if (!res.ok)
                throw new Error(`cue-speakers HTTP ${res.status}`);
            const data = (await res.json());
            const map = new Map();
            for (const it of data.items || []) {
                map.set(it.id, it);
                map.set(`${it.pieceId}-${it.cueId}`, it);
            }
            speakersCached = map;
            return map;
        }
        catch {
            speakersCached = null;
            return null;
        }
        finally {
            speakersPromise = null;
        }
    })();
    return speakersPromise;
}
export function composeLinguisticNote(args) {
    const { pieceId, entryId, linguistics, speakers } = args;
    if (!pieceId || !linguistics?.pieces?.[pieceId])
        return null;
    const card = linguistics.pieces[pieceId];
    const sp = entryId ? speakers?.get(entryId) ?? null : null;
    const zhParts = [
        `【语言学说明】${card.genreZh}`,
        `语体：${card.registerZh}`,
        `行当 / 角色：${card.rolesZh}`,
    ];
    const enParts = [
        `Linguistic note: ${card.genreEn}`,
        `Register: ${card.registerEn}`,
        `Role line: ${card.rolesEn}`,
    ];
    if (sp) {
        zhParts.push(`本句说话人：${sp.speakerZh}`);
        enParts.push(`Speaker on this cue: ${sp.speakerEn}`);
    }
    zhParts.push(`听辨提示：${card.listenZh}`);
    enParts.push(`Listening tip: ${card.listenEn}`);
    return {
        zh: zhParts.join(" · "),
        en: enParts.join(" · "),
        speakerZh: sp?.speakerZh ?? null,
        speakerEn: sp?.speakerEn ?? null,
    };
}
//# sourceMappingURL=speak-linguistics.js.map