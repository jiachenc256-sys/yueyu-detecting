import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeLayers, preferEnLayer } from "../src/merge.js";
import type { LegacyPiece, TranslationFile } from "../src/types.js";

describe("preferEnLayer", () => {
  it("ranks curated above mt and draft", () => {
    const mt = preferEnLayer({ text: "a", status: "mt" }, { text: "b", status: "draft" });
    assert.equal(mt.status, "draft");
    const curated = preferEnLayer(mt, { text: "c", status: "curated" });
    assert.equal(curated.status, "curated");
    assert.equal(curated.text, "c");
  });

  it("keeps current when incoming is weaker", () => {
    const kept = preferEnLayer({ text: "curated", status: "curated" }, { text: "mt", status: "mt" });
    assert.equal(kept.text, "curated");
  });
});

describe("mergeLayers", () => {
  const base: LegacyPiece = {
    id: "demo",
    title: "演示",
    titleEn: "Demo",
    audio: "assets/audio/demo.m4a",
    cueCount: 2,
    correctedCount: 1,
    cues: [
      {
        id: 1,
        start: 0,
        end: 1,
        raw: "眼响",
        text: "眼睛",
        corrected: true,
      },
      {
        id: 2,
        start: 1,
        end: 2,
        raw: "你好",
        text: "你好",
      },
    ],
  };

  const curated: TranslationFile = {
    pieceId: "demo",
    language: "en",
    schemaVersion: "1.0.0",
    entries: [{ id: 1, text: "eyes", status: "curated", source: "test" }],
  };

  const mt: TranslationFile = {
    pieceId: "demo",
    language: "en",
    schemaVersion: "1.0.0",
    entries: [
      { id: 1, text: "eye-sound", status: "mt", source: "mt-test" },
      { id: 2, text: "hello", status: "mt", source: "mt-test" },
    ],
  };

  it("applies curated over mt for the same cue", () => {
    const piece = mergeLayers(base, curated, mt);
    assert.equal(piece.schemaVersion, "1.0.0");
    assert.equal(piece.cues[0]?.layers.en?.status, "curated");
    assert.equal(piece.cues[0]?.layers.en?.text, "eyes");
    assert.equal(piece.cues[1]?.layers.en?.status, "mt");
    assert.equal(piece.coverage.enCurated, 1);
    assert.equal(piece.coverage.enMt, 1);
    assert.equal(piece.coverage.enAny, 2);
  });

  it("preserves raw ASR and zh correction status", () => {
    const piece = mergeLayers(base, curated, mt);
    assert.equal(piece.cues[0]?.rawAsr, "眼响");
    assert.equal(piece.cues[0]?.layers.zh.status, "corrected");
    assert.equal(piece.cues[1]?.layers.zh.status, "raw");
  });
});
