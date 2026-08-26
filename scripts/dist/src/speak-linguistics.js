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
function genericCard(pieceId, title) {
    const label = title || pieceId.replace(/-/g, " ");
    return {
        genreZh: `戏曲档案 · ${label}`,
        genreEn: `Archive piece · ${label}`,
        registerZh: "唱念语体随场次变化；先跟档案句，再听字。",
        registerEn: "Register varies by scene; follow the archive line before chasing characters.",
        rolesZh: "行当随本出而定",
        rolesEn: "Role line depends on this piece",
        listenZh: "命中后用候选句与场景卡跟读；字级不稳属唱腔域常态。",
        listenEn: "After a hit, follow the candidate line and scene card; imperfect matches are normal in sung domain.",
    };
}
export function composeLinguisticNote(args) {
    const { pieceId, entryId, title, linguistics, speakers } = args;
    if (!pieceId)
        return null;
    const card = linguistics?.pieces?.[pieceId] ?? genericCard(pieceId, title);
    const sp = entryId ? speakers?.get(entryId) ?? null : null;
    const rowsZh = [
        { label: "体裁", body: card.genreZh },
        { label: "语体", body: card.registerZh },
        { label: "行当 / 角色", body: card.rolesZh },
    ];
    const rowsEn = [
        { label: "Genre", body: card.genreEn },
        { label: "Register", body: card.registerEn },
        { label: "Role line", body: card.rolesEn },
    ];
    if (sp) {
        rowsZh.push({ label: "本句说话人", body: sp.speakerZh });
        rowsEn.push({ label: "Speaker", body: sp.speakerEn });
    }
    rowsZh.push({ label: "听辨提示", body: card.listenZh });
    rowsEn.push({ label: "Listening tip", body: card.listenEn });
    return {
        zh: rowsZh.map((r) => `${r.label}：${r.body}`).join(" · "),
        en: rowsEn.map((r) => `${r.label}: ${r.body}`).join(" · "),
        speakerZh: sp?.speakerZh ?? null,
        speakerEn: sp?.speakerEn ?? null,
        rowsZh,
        rowsEn,
    };
}
//# sourceMappingURL=speak-linguistics.js.map