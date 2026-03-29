// Tests for the TTS pipeline (pipeline.ts).
//
// Design contract:
//   runPipeline(storage: StorageDeps, scriptKey: string): ResultAsync<EnrichedScript, PipelineError>
//   PipelineError = VoicevoxError | S3Error | WavError

import { err, errAsync, ok, okAsync } from "neverthrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// All external side-effects are mocked so no network or AWS calls occur.
vi.mock("../voicevox", () => ({
  audioQuery: vi.fn(),
  synthesis: vi.fn(),
}));

vi.mock("../wav", () => ({
  getWavDurationSec: vi.fn(),
  concatenateWavs: vi.fn(),
}));

vi.mock("../speaker", () => ({
  getSpeakerId: vi.fn(),
  SPEAKER_IDS: { A: 0, B: 1 },
}));

import { runPipeline } from "../pipeline";
import type { Script } from "../schema";
import { getSpeakerId } from "../speaker";
import type { StorageDeps } from "../storage";
import { audioQuery, synthesis } from "../voicevox";
import { concatenateWavs, getWavDurationSec } from "../wav";

// ============================================
// Minimal valid script fixture
// 13 lines total:
//   intro:         greeting(1) + newsOverview(1)             =  2
//   discussion×3:  3 discussions × 3 blocks × 1 line each   =  9
//   outro:         recap(1) + closing(1)                     =  2
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

const MOCK_QUERY_OBJ = { speedScale: 1.0, pitchScale: 0.0 };
const MOCK_WAV = new ArrayBuffer(100);
const MOCK_COMBINED_WAV = new ArrayBuffer(1000);
const MOCK_OUTPUT_KEY = "audio/2026-03-21/テストラジオ 2026年3月21日号.wav";

const createMockStorage = (): StorageDeps => ({
  getScript: vi
    .fn()
    .mockReturnValue(okAsync(MINIMAL_SCRIPT as unknown as Script)),
  uploadWav: vi.fn().mockReturnValue(okAsync(undefined)),
  uploadEnrichedScript: vi.fn().mockReturnValue(okAsync(undefined)),
  buildOutputKey: vi.fn().mockReturnValue(MOCK_OUTPUT_KEY),
});

// ============================================
// Setup / Teardown
// ============================================

let mockStorage: StorageDeps;

beforeEach(() => {
  vi.clearAllMocks();

  mockStorage = createMockStorage();

  vi.mocked(audioQuery).mockReturnValue(okAsync(MOCK_QUERY_OBJ));
  vi.mocked(synthesis).mockReturnValue(okAsync(MOCK_WAV));
  vi.mocked(getWavDurationSec).mockReturnValue(ok(1.5));
  vi.mocked(concatenateWavs).mockReturnValue(ok(MOCK_COMBINED_WAV));
  vi.mocked(getSpeakerId).mockImplementation((speaker: "A" | "B") =>
    speaker === "A" ? 0 : 1,
  );
});

afterEach(() => {
  vi.clearAllMocks();
});

// ============================================
// runPipeline — success cases
// ============================================

describe("runPipeline — success", () => {
  it("returns Ok with an EnrichedScript", async () => {
    const result = await runPipeline(mockStorage, "scripts/2026-03-21.json");
    expect(result.isOk()).toBe(true);
  });

  it("returns Ok with the correct title from the script", async () => {
    const result = await runPipeline(mockStorage, "scripts/2026-03-21.json");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.title).toBe(MINIMAL_SCRIPT.title);
    }
  });

  it("returns Ok with totalDurationSec equal to the sum of all line durations", async () => {
    const result = await runPipeline(mockStorage, "scripts/2026-03-21.json");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.totalDurationSec).toBeCloseTo(13 * 1.5, 5);
    }
  });

  it("returns Ok with outputWavS3Key set to the value returned by buildOutputKey", async () => {
    const result = await runPipeline(mockStorage, "scripts/2026-03-21.json");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.outputWavS3Key).toBe(MOCK_OUTPUT_KEY);
    }
  });

  it("returns Ok with 5 sections in the correct type order", async () => {
    const result = await runPipeline(mockStorage, "scripts/2026-03-21.json");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.sections).toHaveLength(5);
      expect(result.value.sections[0]?.type).toBe("intro");
      expect(result.value.sections[1]?.type).toBe("discussion");
      expect(result.value.sections[2]?.type).toBe("discussion");
      expect(result.value.sections[3]?.type).toBe("discussion");
      expect(result.value.sections[4]?.type).toBe("outro");
    }
  });

  it("preserves newsItems from the original script", async () => {
    const result = await runPipeline(mockStorage, "scripts/2026-03-21.json");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.newsItems).toEqual(MINIMAL_SCRIPT.newsItems);
    }
  });

  it("calls storage.getScript with the provided key", async () => {
    await runPipeline(mockStorage, "scripts/2026-03-21.json");
    expect(mockStorage.getScript).toHaveBeenCalledWith(
      "scripts/2026-03-21.json",
    );
  });

  it("calls storage.uploadWav with the output key and combined WAV buffer", async () => {
    await runPipeline(mockStorage, "scripts/2026-03-21.json");
    expect(mockStorage.uploadWav).toHaveBeenCalledWith(
      MOCK_OUTPUT_KEY,
      MOCK_COMBINED_WAV,
    );
  });

  it("calls audioQuery once per line in the script (13 lines total)", async () => {
    await runPipeline(mockStorage, "scripts/2026-03-21.json");
    expect(vi.mocked(audioQuery)).toHaveBeenCalledTimes(13);
  });

  it("calls synthesis once per line in the script (13 lines total)", async () => {
    await runPipeline(mockStorage, "scripts/2026-03-21.json");
    expect(vi.mocked(synthesis)).toHaveBeenCalledTimes(13);
  });

  it("calls storage.buildOutputKey with the date extracted from the key", async () => {
    await runPipeline(mockStorage, "scripts/2026-03-21.json");
    expect(mockStorage.buildOutputKey).toHaveBeenCalledWith(
      "2026-03-21",
      MINIMAL_SCRIPT.title,
    );
  });

  it("accumulates offsets sequentially: second line offset equals first line duration", async () => {
    const result = await runPipeline(mockStorage, "scripts/2026-03-21.json");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const intro = result.value.sections[0];
      if (intro?.type === "intro") {
        expect(intro.greeting[0]?.offsetSec).toBeCloseTo(0, 5);
        expect(intro.newsOverview[0]?.offsetSec).toBeCloseTo(1.5, 5);
      }
    }
  });
});

// ============================================
// runPipeline — error cases (returns Err, never throws)
// ============================================

describe("runPipeline — errors", () => {
  it("returns Err when storage.getScript fails", async () => {
    const storage = {
      ...mockStorage,
      getScript: vi
        .fn()
        .mockReturnValue(
          errAsync({ type: "GET_OBJECT_ERROR" as const, message: "NoSuchKey" }),
        ),
    };

    const result = await runPipeline(storage, "scripts/2026-03-21.json");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("GET_OBJECT_ERROR");
    }
  });

  it("returns Err when audioQuery fails", async () => {
    vi.mocked(audioQuery).mockReturnValueOnce(
      errAsync({
        type: "AUDIO_QUERY_ERROR" as const,
        message: "VOICEVOX unreachable",
      }),
    );

    const result = await runPipeline(mockStorage, "scripts/2026-03-21.json");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("AUDIO_QUERY_ERROR");
    }
  });

  it("returns Err when synthesis fails", async () => {
    vi.mocked(synthesis).mockReturnValueOnce(
      errAsync({
        type: "SYNTHESIS_ERROR" as const,
        message: "Synthesis failed",
      }),
    );

    const result = await runPipeline(mockStorage, "scripts/2026-03-21.json");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("SYNTHESIS_ERROR");
    }
  });

  it("returns Err when getWavDurationSec fails", async () => {
    vi.mocked(getWavDurationSec).mockReturnValueOnce(
      err({ type: "INVALID_HEADER" as const, message: "Invalid WAV header" }),
    );

    const result = await runPipeline(mockStorage, "scripts/2026-03-21.json");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("INVALID_HEADER");
    }
  });

  it("returns Err when concatenateWavs fails", async () => {
    vi.mocked(concatenateWavs).mockReturnValue(
      err({ type: "EMPTY_INPUT" as const, message: "No WAV buffers" }),
    );

    const result = await runPipeline(mockStorage, "scripts/2026-03-21.json");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("EMPTY_INPUT");
    }
  });

  it("returns Err when storage.uploadWav fails", async () => {
    const storage = {
      ...mockStorage,
      uploadWav: vi
        .fn()
        .mockReturnValue(
          errAsync({
            type: "PUT_OBJECT_ERROR" as const,
            message: "Upload failed",
          }),
        ),
    };

    const result = await runPipeline(storage, "scripts/2026-03-21.json");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("PUT_OBJECT_ERROR");
    }
  });

  it("short-circuits and skips TTS calls when script fetch fails", async () => {
    const storage = {
      ...mockStorage,
      getScript: vi
        .fn()
        .mockReturnValue(
          errAsync({
            type: "GET_OBJECT_ERROR" as const,
            message: "Bucket not found",
          }),
        ),
    };

    await runPipeline(storage, "scripts/2026-03-21.json");

    expect(vi.mocked(audioQuery)).not.toHaveBeenCalled();
    expect(vi.mocked(synthesis)).not.toHaveBeenCalled();
  });

  it("does not upload when WAV concatenation fails", async () => {
    vi.mocked(concatenateWavs).mockReturnValue(
      err({
        type: "FORMAT_MISMATCH" as const,
        message: "Incompatible formats",
      }),
    );

    await runPipeline(mockStorage, "scripts/2026-03-21.json");

    expect(mockStorage.uploadWav).not.toHaveBeenCalled();
  });
});

// ============================================
// runPipeline — uploadEnrichedScript integration
// ============================================

describe("runPipeline — uploadEnrichedScript integration", () => {
  it("calls storage.uploadEnrichedScript after uploadWav on success", async () => {
    await runPipeline(mockStorage, "scripts/2026-03-21.json");

    expect(mockStorage.uploadWav).toHaveBeenCalledTimes(1);
    expect(mockStorage.uploadEnrichedScript).toHaveBeenCalledTimes(1);
  });

  it("calls uploadEnrichedScript with the assembled EnrichedScript", async () => {
    await runPipeline(mockStorage, "scripts/2026-03-21.json");

    expect(mockStorage.uploadEnrichedScript).toHaveBeenCalledWith(
      expect.objectContaining({
        title: MINIMAL_SCRIPT.title,
        outputWavS3Key: MOCK_OUTPUT_KEY,
      }),
    );
  });

  it("calls uploadEnrichedScript AFTER uploadWav (ordering constraint)", async () => {
    const callOrder: string[] = [];
    vi.mocked(mockStorage.uploadWav).mockImplementation(() => {
      callOrder.push("uploadWav");
      return okAsync(undefined);
    });
    vi.mocked(mockStorage.uploadEnrichedScript).mockImplementation(() => {
      callOrder.push("uploadEnrichedScript");
      return okAsync(undefined);
    });

    await runPipeline(mockStorage, "scripts/2026-03-21.json");

    expect(callOrder).toEqual(["uploadWav", "uploadEnrichedScript"]);
  });

  it("returns Err when uploadEnrichedScript fails", async () => {
    const storage = {
      ...mockStorage,
      uploadEnrichedScript: vi
        .fn()
        .mockReturnValue(
          errAsync({
            type: "PUT_OBJECT_ERROR" as const,
            message: "Enriched script upload failed",
          }),
        ),
    };

    const result = await runPipeline(storage, "scripts/2026-03-21.json");

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("PUT_OBJECT_ERROR");
    }
  });

  it("does not call uploadEnrichedScript when uploadWav fails", async () => {
    const storage = {
      ...mockStorage,
      uploadWav: vi
        .fn()
        .mockReturnValue(
          errAsync({
            type: "PUT_OBJECT_ERROR" as const,
            message: "WAV upload failed",
          }),
        ),
    };

    await runPipeline(storage, "scripts/2026-03-21.json");

    expect(storage.uploadEnrichedScript).not.toHaveBeenCalled();
  });

  it("does not call uploadEnrichedScript when WAV concatenation fails", async () => {
    vi.mocked(concatenateWavs).mockReturnValue(
      err({
        type: "FORMAT_MISMATCH" as const,
        message: "Incompatible formats",
      }),
    );

    await runPipeline(mockStorage, "scripts/2026-03-21.json");

    expect(mockStorage.uploadEnrichedScript).not.toHaveBeenCalled();
  });

  it("does not call uploadEnrichedScript when script fetch fails", async () => {
    const storage = {
      ...mockStorage,
      getScript: vi
        .fn()
        .mockReturnValue(
          errAsync({ type: "GET_OBJECT_ERROR" as const, message: "NoSuchKey" }),
        ),
    };

    await runPipeline(storage, "scripts/2026-03-21.json");

    expect(storage.uploadEnrichedScript).not.toHaveBeenCalled();
  });
});
