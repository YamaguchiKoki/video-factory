// Tests for speaker mapping (speaker.ts).
// This module does not exist yet; tests are written TDD-first.

import { describe, expect, it } from "vitest";
import { getSpeakerId, SPEAKER_IDS } from "../speaker";

describe("SPEAKER_IDS", () => {
  it("maps Speaker A to VOICEVOX speaker id 0", () => {
    // VOICEVOX default speaker: 四国めたん(ノーマル) = 2, ずんだもん(ノーマル) = 3
    // Plan decision: A → 0, B → 1 (VOICEVOX defaults)
    expect(SPEAKER_IDS.A).toBe(0);
  });

  it("maps Speaker B to VOICEVOX speaker id 1", () => {
    expect(SPEAKER_IDS.B).toBe(1);
  });
});

describe("getSpeakerId", () => {
  it("returns 0 for speaker A", () => {
    // Arrange / Act
    const id = getSpeakerId("A");

    // Assert
    expect(id).toBe(0);
  });

  it("returns 1 for speaker B", () => {
    // Arrange / Act
    const id = getSpeakerId("B");

    // Assert
    expect(id).toBe(1);
  });

  it("returns a number for every valid speaker", () => {
    // Both A and B must map to numeric IDs
    expect(typeof getSpeakerId("A")).toBe("number");
    expect(typeof getSpeakerId("B")).toBe("number");
  });

  it("returns different IDs for A and B", () => {
    // Speakers must have distinct VOICEVOX IDs to produce different voices
    expect(getSpeakerId("A")).not.toBe(getSpeakerId("B"));
  });
});
