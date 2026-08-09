import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatTime, parseSrtTime } from "../src/time.js";

describe("parseSrtTime", () => {
  it("parses HH:MM:SS,mmm", () => {
    assert.equal(parseSrtTime("00:00:06,239"), 6.239);
    assert.equal(parseSrtTime("01:02:03,004"), 3723.004);
  });

  it("rejects invalid input", () => {
    assert.throws(() => parseSrtTime("6.239"), /Invalid SRT timestamp/);
  });
});

describe("formatTime", () => {
  it("formats mm:ss", () => {
    assert.equal(formatTime(0), "0:00");
    assert.equal(formatTime(65), "1:05");
    assert.equal(formatTime(130 * 60 + 53), "130:53");
  });
});
