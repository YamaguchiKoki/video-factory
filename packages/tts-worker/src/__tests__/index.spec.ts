// Integration tests for the main pipeline handler (index.ts).
// This module does not exist yet; tests are written TDD-first.
//
// Design contract:
//   handler(event: unknown): Promise<EnrichedScript>
//   - Reads script from S3 → TTS each line → concatenates WAVs → uploads → returns EnrichedScript
//   - Throws on validation errors, missing env vars, or pipeline errors

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { err, errAsync, ok, okAsync } from "neverthrow";

// All external side-effects are mocked so no network or AWS calls occur.
vi.mock("../voicevox", () => ({
  audioQuery: vi.fn(),
  synthesis: vi.fn(),
}));

vi.mock("../s3", () => ({
  getScriptFromS3: vi.fn(),
  uploadWavToS3: vi.fn(),
  buildOutputWavKey: vi.fn(),
}));

vi.mock("../wav", () => ({
  getWavDurationSec: vi.fn(),
  concatenateWavs: vi.fn(),
}));

vi.mock("../speaker", () => ({
  getSpeakerId: vi.fn(),
  SPEAKER_IDS: { A: 0, B: 1 },
}));

import { handler } from "../index";
import { audioQuery, synthesis } from "../voicevox";
import { buildOutputWavKey, getScriptFromS3, uploadWavToS3 } from "../s3";
import { concatenateWavs, getWavDurationSec } from "../wav";
import { getSpeakerId } from "../speaker";
import type { Script } from "../schema";

// ============================================
// Minimal valid script fixture (1 line per section element)
// ============================================

const MINIMAL_SCRIPT = {
  title: "テストラジオ 2026年3月21日号",
  newsItems: [
    { id: "news-1", title: "ニュース1" },
    { id: "news-2", title: "ニュース2" },
    { id: "news-3", title: "ニュース3" },
  ],
  sections: [
    {
      type: "intro" as const,
      greeting: [{ speaker: "A", text: "こんにちは" }],
      newsOverview: [{ speaker: "B", text: "今日のニュース" }],
    },
    {
      type: "discussion" as const,
      newsId: "news-1",
      blocks: [
        { phase: "summary" as const, lines: [{ speaker: "A", text: "概要1" }] },
        {
          phase: "background" as const,
          lines: [{ speaker: "B", text: "背景1" }],
        },
        {
          phase: "deepDive" as const,
          lines: [{ speaker: "A", text: "深掘り1" }],
        },
      ],
    },
    {
      type: "discussion" as const,
      newsId: "news-2",
      blocks: [
        { phase: "summary" as const, lines: [{ speaker: "A", text: "概要2" }] },
        {
          phase: "background" as const,
          lines: [{ speaker: "B", text: "背景2" }],
        },
        {
          phase: "deepDive" as const,
          lines: [{ speaker: "A", text: "深掘り2" }],
        },
      ],
    },
    {
      type: "discussion" as const,
      newsId: "news-3",
      blocks: [
        { phase: "summary" as const, lines: [{ speaker: "A", text: "概要3" }] },
        {
          phase: "background" as const,
          lines: [{ speaker: "B", text: "背景3" }],
        },
        {
          phase: "deepDive" as const,
          lines: [{ speaker: "A", text: "深掘り3" }],
        },
      ],
    },
    {
      type: "outro" as const,
      recap: [{ speaker: "A", text: "まとめ" }],
      closing: [{ speaker: "B", text: "さようなら" }],
    },
  ],
};

const VALID_EVENT = { scriptS3Key: "scripts/2026-03-21.json" };
const MOCK_QUERY_OBJ = { speedScale: 1.0, pitchScale: 0.0 };
const MOCK_WAV = new ArrayBuffer(100);
const MOCK_COMBINED_WAV = new ArrayBuffer(1000);
const MOCK_OUTPUT_KEY = "audio/2026-03-21/テストラジオ 2026年3月21日号.wav";

// ============================================
// Setup / Teardown
// ============================================

beforeEach(() => {
  vi.clearAllMocks();
  process.env["S3_BUCKET"] = "test-bucket";

  // Default happy-path mock implementations
  vi.mocked(getScriptFromS3).mockReturnValue(okAsync(MINIMAL_SCRIPT as unknown as Script));
  vi.mocked(audioQuery).mockReturnValue(okAsync(MOCK_QUERY_OBJ));
  vi.mocked(synthesis).mockReturnValue(okAsync(MOCK_WAV));
  vi.mocked(getWavDurationSec).mockReturnValue(ok(1.5));
  vi.mocked(concatenateWavs).mockReturnValue(ok(MOCK_COMBINED_WAV));
  vi.mocked(buildOutputWavKey).mockReturnValue(MOCK_OUTPUT_KEY);
  vi.mocked(uploadWavToS3).mockReturnValue(okAsync(undefined));
  vi.mocked(getSpeakerId).mockImplementation((speaker: "A" | "B") =>
    speaker === "A" ? 0 : 1,
  );
});

afterEach(() => {
  delete process.env["S3_BUCKET"];
});

// ============================================
// handler — success cases
// ============================================

describe("handler — success", () => {
  it("returns an EnrichedScript with the correct title", async () => {
    // Act
    const result = await handler(VALID_EVENT);

    // Assert
    expect(result.title).toBe(MINIMAL_SCRIPT.title);
  });

  it("returns an EnrichedScript with outputWavS3Key set to the uploaded key", async () => {
    // Act
    const result = await handler(VALID_EVENT);

    // Assert
    expect(result.outputWavS3Key).toBe(MOCK_OUTPUT_KEY);
  });

  it("returns an EnrichedScript with totalDurationSec equal to sum of all line durations", async () => {
    // Arrange — MINIMAL_SCRIPT has 13 lines total, each mocked at 1.5 s → 19.5 s
    // (intro: 2, discussion×3: 3 blocks × 1 line × 3 = 9, outro: 2 → total 13)

    // Act
    const result = await handler(VALID_EVENT);

    // Assert
    expect(result.totalDurationSec).toBeCloseTo(13 * 1.5, 5);
  });

  it("returns an EnrichedScript with 5 sections in the correct order", async () => {
    // Act
    const result = await handler(VALID_EVENT);

    // Assert
    expect(result.sections).toHaveLength(5);
    expect(result.sections[0]?.type).toBe("intro");
    expect(result.sections[1]?.type).toBe("discussion");
    expect(result.sections[2]?.type).toBe("discussion");
    expect(result.sections[3]?.type).toBe("discussion");
    expect(result.sections[4]?.type).toBe("outro");
  });

  it("calls getScriptFromS3 with the bucket and key from the event", async () => {
    // Act
    await handler(VALID_EVENT);

    // Assert
    expect(vi.mocked(getScriptFromS3)).toHaveBeenCalledWith(
      "test-bucket",
      "scripts/2026-03-21.json",
    );
  });

  it("calls uploadWavToS3 with the combined WAV buffer", async () => {
    // Act
    await handler(VALID_EVENT);

    // Assert
    expect(vi.mocked(uploadWavToS3)).toHaveBeenCalledWith(
      "test-bucket",
      MOCK_OUTPUT_KEY,
      MOCK_COMBINED_WAV,
    );
  });

  it("calls audioQuery once per line in the script", async () => {
    // Arrange — MINIMAL_SCRIPT has 13 lines

    // Act
    await handler(VALID_EVENT);

    // Assert
    expect(vi.mocked(audioQuery)).toHaveBeenCalledTimes(13);
  });

  it("calls synthesis once per line in the script", async () => {
    // Act
    await handler(VALID_EVENT);

    // Assert
    expect(vi.mocked(synthesis)).toHaveBeenCalledTimes(13);
  });

  it("calls buildOutputWavKey with the date extracted from the S3 key", async () => {
    // Act
    await handler(VALID_EVENT);

    // Assert — "scripts/2026-03-21.json" → date "2026-03-21"
    expect(vi.mocked(buildOutputWavKey)).toHaveBeenCalledWith(
      "2026-03-21",
      MINIMAL_SCRIPT.title,
    );
  });
});

// ============================================
// handler — input validation errors
// ============================================

describe("handler — input validation", () => {
  it("throws when event is missing scriptS3Key", async () => {
    // Arrange
    const invalidEvent = {};

    // Act + Assert
    await expect(handler(invalidEvent)).rejects.toThrow();
  });

  it("throws when event is null", async () => {
    // Act + Assert
    await expect(handler(null)).rejects.toThrow();
  });

  it("throws when scriptS3Key is not a string", async () => {
    // Arrange
    const invalidEvent = { scriptS3Key: 123 };

    // Act + Assert
    await expect(handler(invalidEvent)).rejects.toThrow();
  });
});

// ============================================
// handler — environment variable errors
// ============================================

describe("handler — environment variable errors", () => {
  it("throws when S3_BUCKET env var is not set", async () => {
    // Arrange
    delete process.env["S3_BUCKET"];

    // Act + Assert
    await expect(handler(VALID_EVENT)).rejects.toThrow();
  });
});

// ============================================
// handler — pipeline errors
// ============================================

describe("handler — pipeline errors", () => {
  it("throws when getScriptFromS3 returns an error", async () => {
    // Arrange
    vi.mocked(getScriptFromS3).mockReturnValue(
      errAsync({ type: "GET_OBJECT_ERROR" as const, message: "NoSuchKey" }),
    );

    // Act + Assert
    await expect(handler(VALID_EVENT)).rejects.toThrow();
  });

  it("throws when audioQuery returns an error", async () => {
    // Arrange — first audioQuery call fails
    vi.mocked(audioQuery).mockReturnValueOnce(
      errAsync({
        type: "AUDIO_QUERY_ERROR" as const,
        message: "VOICEVOX unreachable",
      }),
    );

    // Act + Assert
    await expect(handler(VALID_EVENT)).rejects.toThrow();
  });

  it("throws when synthesis returns an error", async () => {
    // Arrange — first synthesis call fails
    vi.mocked(synthesis).mockReturnValueOnce(
      errAsync({
        type: "SYNTHESIS_ERROR" as const,
        message: "Synthesis failed",
      }),
    );

    // Act + Assert
    await expect(handler(VALID_EVENT)).rejects.toThrow();
  });

  it("throws when getWavDurationSec returns an error", async () => {
    // Arrange — first WAV duration parse fails
    vi.mocked(getWavDurationSec).mockReturnValueOnce(
      err({ type: "INVALID_HEADER" as const, message: "Invalid WAV header" }),
    );

    // Act + Assert
    await expect(handler(VALID_EVENT)).rejects.toThrow();
  });

  it("throws when concatenateWavs returns an error", async () => {
    // Arrange
    vi.mocked(concatenateWavs).mockReturnValue(
      err({ type: "EMPTY_INPUT" as const, message: "No WAV buffers" }),
    );

    // Act + Assert
    await expect(handler(VALID_EVENT)).rejects.toThrow();
  });

  it("throws when uploadWavToS3 returns an error", async () => {
    // Arrange
    vi.mocked(uploadWavToS3).mockReturnValue(
      errAsync({ type: "PUT_OBJECT_ERROR" as const, message: "Upload failed" }),
    );

    // Act + Assert
    await expect(handler(VALID_EVENT)).rejects.toThrow();
  });
});
