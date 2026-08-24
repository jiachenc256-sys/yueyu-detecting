/**
 * Prosody / delivery cues when audio is NOT in the archive.
 * Lightweight Web Audio features → emotion / 腔调·语调 radar.
 */
export const EMOTION_AXES = [
    { id: "grief", labelZh: "悲", labelEn: "Grief" },
    { id: "urgency", labelZh: "急", labelEn: "Urgency" },
    { id: "anger", labelZh: "怒", labelEn: "Anger" },
    { id: "tender", labelZh: "柔", labelEn: "Tender" },
    { id: "heroic", labelZh: "亢", labelEn: "Heroic" },
    { id: "sigh", labelZh: "叹", labelEn: "Sigh" },
];
function clamp01(n) {
    return Math.max(0, Math.min(1, n));
}
function std(xs) {
    if (xs.length < 2)
        return 0;
    const m = xs.reduce((a, b) => a + b, 0) / xs.length;
    const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length;
    return Math.sqrt(v);
}
/** Rough spectral centroid + RMS + zero-crossing pitch proxy on mono PCM. */
export function extractProsodyFeatures(samples, sampleRate) {
    const frame = Math.max(256, Math.floor(sampleRate * 0.025));
    const hop = Math.max(128, Math.floor(frame / 2));
    const rmsArr = [];
    const centArr = [];
    const pitchArr = [];
    const attackArr = [];
    const fluxArr = [];
    let prevRms = 0;
    let voicedFrames = 0;
    let frames = 0;
    for (let i = 0; i + frame < samples.length; i += hop) {
        let sumSq = 0;
        let zc = 0;
        let weighted = 0;
        let magSum = 0;
        let prev = samples[i] ?? 0;
        for (let j = 0; j < frame; j++) {
            const x = samples[i + j] ?? 0;
            sumSq += x * x;
            if ((prev >= 0 && x < 0) || (prev < 0 && x >= 0))
                zc++;
            const ax = Math.abs(x);
            weighted += ax * j;
            magSum += ax;
            prev = x;
        }
        const rms = Math.sqrt(sumSq / frame);
        rmsArr.push(rms);
        const centroid = magSum > 1e-8 ? weighted / magSum / frame : 0;
        centArr.push(centroid);
        const zcr = zc / frame;
        pitchArr.push(zcr);
        attackArr.push(Math.max(0, rms - prevRms));
        fluxArr.push(Math.abs(rms - prevRms) + Math.abs(centroid - (centArr[centArr.length - 2] ?? centroid)));
        if (rms > 0.02 && zcr > 0.02 && zcr < 0.35)
            voicedFrames++;
        frames++;
        prevRms = rms;
    }
    const rmsMean = rmsArr.length ? rmsArr.reduce((a, b) => a + b, 0) / rmsArr.length : 0;
    return {
        durationSec: samples.length / sampleRate,
        rmsMean,
        rmsStd: std(rmsArr),
        centroidMean: centArr.length ? centArr.reduce((a, b) => a + b, 0) / centArr.length : 0,
        pitchProxyMean: pitchArr.length ? pitchArr.reduce((a, b) => a + b, 0) / pitchArr.length : 0,
        pitchProxyStd: std(pitchArr),
        attackiness: attackArr.length ? attackArr.reduce((a, b) => a + b, 0) / attackArr.length : 0,
        fluxMean: fluxArr.length ? fluxArr.reduce((a, b) => a + b, 0) / fluxArr.length : 0,
        voicedRatio: frames ? voicedFrames / frames : 0,
    };
}
/** Optional piece prior nudges emotion when we know the play but lyrics missed. */
const PIECE_EMOTION_PRIOR = {
    "xianglin-sao-xinsuanhua": { grief: 0.25, sigh: 0.15, anger: 0.1 },
    "jingchai-ji": { tender: 0.15, sigh: 0.1, grief: 0.08 },
    "baitu-ji": { grief: 0.12, urgency: 0.1, sigh: 0.08 },
    "liangzhu-shibaxiangsong": { tender: 0.18, sigh: 0.12, grief: 0.08 },
    "liangzhu-shibaxiangsong-full": { tender: 0.18, sigh: 0.12, grief: 0.08 },
};
export function featuresToEmotions(f, pieceId) {
    const energy = clamp01(f.rmsMean * 8);
    const energyDyn = clamp01(f.rmsStd * 12);
    const bright = clamp01(f.centroidMean * 2.2);
    const pitch = clamp01(f.pitchProxyMean * 6);
    const pitchVar = clamp01(f.pitchProxyStd * 10);
    const attack = clamp01(f.attackiness * 20);
    const flux = clamp01(f.fluxMean * 15);
    const voiced = clamp01(f.voicedRatio);
    const sustained = clamp01(f.durationSec / 12);
    const slow = clamp01(1.2 - Math.min(f.durationSec, 20) / 20);
    const scores = {
        grief: clamp01(0.22 * energyDyn + 0.28 * pitchVar + 0.2 * sustained + 0.15 * (1 - bright) + 0.15 * flux),
        urgency: clamp01(0.3 * attack + 0.25 * energy + 0.2 * pitch + 0.15 * flux + 0.1 * (1 - sustained)),
        anger: clamp01(0.35 * energy + 0.25 * bright + 0.2 * attack + 0.1 * pitch + 0.1 * flux),
        tender: clamp01(0.35 * (1 - energy) + 0.25 * (1 - bright) + 0.2 * (1 - attack) + 0.1 * voiced + 0.1 * sustained),
        heroic: clamp01(0.3 * energy + 0.25 * pitch + 0.2 * bright + 0.15 * energyDyn + 0.1 * voiced),
        sigh: clamp01(0.3 * (1 - energy) + 0.25 * sustained + 0.2 * (1 - attack) + 0.15 * slow + 0.1 * (1 - flux)),
    };
    const prior = pieceId ? PIECE_EMOTION_PRIOR[pieceId] : undefined;
    if (prior) {
        for (const [k, v] of Object.entries(prior)) {
            const id = k;
            if (id in scores && typeof v === "number")
                scores[id] = clamp01(scores[id] + v);
        }
    }
    // Softmax-ish sharpen so radar isn't flat
    const maxS = Math.max(...Object.values(scores), 1e-6);
    for (const id of Object.keys(scores)) {
        scores[id] = clamp01(Math.pow(scores[id] / maxS, 1.15) * maxS);
    }
    const top = [...EMOTION_AXES]
        .map((a) => ({ id: a.id, s: scores[a.id] }))
        .sort((a, b) => b.s - a.s)
        .slice(0, 3)
        .map((x) => x.id);
    const label = (id) => EMOTION_AXES.find((a) => a.id === id)?.labelZh ?? id;
    const labelEn = (id) => EMOTION_AXES.find((a) => a.id === id)?.labelEn ?? id;
    const cryHint = pitchVar > 0.5 && energyDyn > 0.4 ? "，起伏大，略似哭腔/激动" : "";
    const cryHintEn = pitchVar > 0.5 && energyDyn > 0.4 ? " Contour is wide — may resemble sob-like or agitated delivery." : "";
    const summaryZh = top.length > 0
        ? `档案未命中。腔调粗估偏「${top.map(label).join(" / ")}」——能量${energy > 0.55 ? "偏强" : "偏弱"}，音色${bright > 0.55 ? "偏亮" : "偏沉"}，声线活动${voiced > 0.45 ? "较密" : "较疏"}${cryHint}。`
        : "未能从腔调中读出清晰情绪，可换更清晰、更短的片段再试。";
    const summaryEn = top.length > 0
        ? `Not in archive. Delivery leans ${top.map(labelEn).join(" / ")} — energy ${energy > 0.55 ? "strong" : "soft"}, timbre ${bright > 0.55 ? "bright" : "dark"}, voicing ${voiced > 0.45 ? "dense" : "sparse"}.${cryHintEn}`
        : "Prosody signal is weak; try a clearer, shorter clip.";
    const pct = (x) => `${Math.round(clamp01(x) * 100)}%`;
    const metricsZh = `声学粗指标（非字级语言学分析）：能量 ${pct(energy)} · 动态 ${pct(energyDyn)} · 亮度 ${pct(bright)} · 声线密 ${pct(voiced)} · 起伏 ${pct(pitchVar)} · 起势 ${pct(attack)} · 时长 ${f.durationSec.toFixed(1)}s。`;
    const metricsEn = `Acoustic cues (not full linguistic analysis): energy ${pct(energy)} · dynamics ${pct(energyDyn)} · brightness ${pct(bright)} · voicing density ${pct(voiced)} · pitch motion ${pct(pitchVar)} · attack ${pct(attack)} · length ${f.durationSec.toFixed(1)}s.`;
    return { features: f, scores, top, summaryZh, summaryEn, metricsZh, metricsEn };
}
export async function analyzeProsodyFromUrl(url, pieceId) {
    try {
        const res = await fetch(url);
        if (!res.ok)
            return null;
        const buf = await res.arrayBuffer();
        const ctx = new AudioContext();
        try {
            const audio = await ctx.decodeAudioData(buf.slice(0));
            const ch0 = audio.getChannelData(0);
            const maxSamples = Math.min(ch0.length, Math.floor(audio.sampleRate * 30));
            const slice = ch0.subarray(0, maxSamples);
            const features = extractProsodyFeatures(slice, audio.sampleRate);
            return featuresToEmotions(features, pieceId);
        }
        finally {
            await ctx.close();
        }
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=speak-prosody.js.map