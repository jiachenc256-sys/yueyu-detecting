import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cueMatchesQuery,
  enBadgeLabel,
  primaryDisplayText,
  secondaryDisplayText,
} from "../src/display.js";
import type { Cue } from "../src/types.js";

const cue: Cue = {
  id: 10,
  start: 1,
  end: 2,
  rawAsr: "这破门 又该修了",
  layers: {
    zh: { text: "这破门 又该修了", status: "raw" },
    en: { text: "This broken door needs fixing again", status: "curated" },
  },
};

describe("display helpers", () => {
  it("searches across zh, en, and raw", () => {
    assert.equal(cueMatchesQuery(cue, "broken"), true);
    assert.equal(cueMatchesQuery(cue, "破门"), true);
    assert.equal(cueMatchesQuery(cue, "xyz"), false);
  });

  it("respects display mode", () => {
    assert.equal(primaryDisplayText(cue, "zh"), "这破门 又该修了");
    assert.equal(primaryDisplayText(cue, "en"), "This broken door needs fixing again");
    assert.equal(secondaryDisplayText(cue, "bilingual"), "This broken door needs fixing again");
    assert.equal(secondaryDisplayText(cue, "zh"), null);
  });

  it("labels translation authority", () => {
    assert.equal(enBadgeLabel(cue), "Curated");
    assert.equal(
      enBadgeLabel({
        ...cue,
        layers: { zh: cue.layers.zh, en: { text: "x", status: "mt" } },
      }),
      "MT — not authoritative",
    );
  });
});
