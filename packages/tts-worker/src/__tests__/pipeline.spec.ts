// Tests for the TTS pipeline (pipeline.ts).
//
// Design contract:
//   runPipeline(scriptKey): Effect<EnrichedScript, PipelineError, StorageService | VoicevoxService>
//   PipelineError = VoicevoxError | S3Error | WavError

import { Effect, Layer, Result } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AudioQueryError,
  EmptyInputError,
  FormatMismatchError,
  InvalidHeaderError,
  type S3Error,
  S3GetObjectError,
  S3PutObjectError,
  SynthesisError,
  type VoicevoxError,
} from "../errors";
import { runPipeline } from "../pipeline";
import type { EnrichedScript, Script } from "../schema";
import { StorageService } from "../storage";
import { type VoicevoxAudioQuery, VoicevoxService } from "../voicevox";

// ============================================
// Mock direct imports in pipeline (non-service functions)
// ============================================

vi.mock("../wav", () => ({
  getWavDurationSec: vi.fn(),
  concatenateWavs: vi.fn(),
}));

vi.mock("../speaker", () => ({
  getSpeakerId: vi.fn(),
  SPEAKER_IDS: { A: 0, B: 1 },
}));

import { getSpeakerId } from "../speaker";
import { concatenateWavs, getWavDurationSec } from "../wav";

// ============================================
// Minimal valid script fixture (13 lines total)
//   intro:         greeting(1) + newsOverview(1)             =  2
//   discussion×3:  3 discussions × 3 blocks × 1 line each   =  9
//   outro:         recap(1) + closing(1)                     =  2
// ============================================

const MINIMAL_SCRIPT: Script = {
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

// ============================================
// Helper: mock service implementations
// Explicit return type annotations prevent TypeScript from inferring narrow Effect error types
// ============================================

const createMockStorageImpl = () => ({
  getScript: vi.fn(
    (_key: string): Effect.Effect<Script, S3Error> =>
      Effect.succeed(MINIMAL_SCRIPT),
  ),
  uploadWav: vi.fn(
    (_key: string, _data: ArrayBuffer): Effect.Effect<void, S3Error> =>
      Effect.succeed(undefined),
  ),
  uploadEnrichedScript: vi.fn(
    (_data: EnrichedScript): Effect.Effect<void, S3Error> =>
      Effect.succeed(undefined),
  ),
  buildOutputKey: vi.fn(
    (_date: string, _title: string): string => MOCK_OUTPUT_KEY,
  ),
});

const createMockVoicevoxImpl = () => ({
  audioQuery: vi.fn(
    (
      _text: string,
      _speakerId: number,
    ): Effect.Effect<VoicevoxAudioQuery, VoicevoxError> =>
      Effect.succeed(MOCK_QUERY_OBJ as VoicevoxAudioQuery),
  ),
  synthesis: vi.fn(
    (
      _speakerId: number,
      _query: VoicevoxAudioQuery,
    ): Effect.Effect<ArrayBuffer, VoicevoxError> => Effect.succeed(MOCK_WAV),
  ),
});

type MockStorage = ReturnType<typeof createMockStorageImpl>;
type MockVoicevox = ReturnType<typeof createMockVoicevoxImpl>;

const buildTestLayer = (storage: MockStorage, voicevox: MockVoicevox) =>
  Layer.merge(
    Layer.succeed(StorageService, storage),
    Layer.succeed(VoicevoxService, voicevox),
  );

const runPipelineWith = (
  key: string,
  storage: MockStorage,
  voicevox: MockVoicevox,
) =>
  Effect.runPromise(
    runPipeline(key).pipe(Effect.provide(buildTestLayer(storage, voicevox))),
  );

const runPipelineWithResult = (
  key: string,
  storage: MockStorage,
  voicevox: MockVoicevox,
) =>
  Effect.runPromise(
    Effect.result(
      runPipeline(key).pipe(Effect.provide(buildTestLayer(storage, voicevox))),
    ),
  );

// ============================================
// Setup / Teardown
// ============================================

beforeEach(() => {
  vi.mocked(getWavDurationSec).mockReturnValue(Effect.succeed(1.5));
  vi.mocked(concatenateWavs).mockReturnValue(Effect.succeed(MOCK_COMBINED_WAV));
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
  it("resolves with an EnrichedScript", async () => {
    const enrichedScript = await runPipelineWith(
      "scripts/2026-03-21.json",
      createMockStorageImpl(),
      createMockVoicevoxImpl(),
    );
    expect(enrichedScript).toBeDefined();
  });

  it("returns the correct title from the script", async () => {
    const enrichedScript = await runPipelineWith(
      "scripts/2026-03-21.json",
      createMockStorageImpl(),
      createMockVoicevoxImpl(),
    );
    expect(enrichedScript.title).toBe(MINIMAL_SCRIPT.title);
  });

  it("returns totalDurationSec equal to the sum of all line durations (13 × 1.5)", async () => {
    const enrichedScript = await runPipelineWith(
      "scripts/2026-03-21.json",
      createMockStorageImpl(),
      createMockVoicevoxImpl(),
    );
    expect(enrichedScript.totalDurationSec).toBeCloseTo(13 * 1.5, 5);
  });

  it("returns outputWavS3Key equal to the value returned by buildOutputKey", async () => {
    const enrichedScript = await runPipelineWith(
      "scripts/2026-03-21.json",
      createMockStorageImpl(),
      createMockVoicevoxImpl(),
    );
    expect(enrichedScript.outputWavS3Key).toBe(MOCK_OUTPUT_KEY);
  });

  it("returns 5 sections in the correct type order", async () => {
    const enrichedScript = await runPipelineWith(
      "scripts/2026-03-21.json",
      createMockStorageImpl(),
      createMockVoicevoxImpl(),
    );
    expect(enrichedScript.sections).toHaveLength(5);
    expect(enrichedScript.sections[0]?.type).toBe("intro");
    expect(enrichedScript.sections[1]?.type).toBe("discussion");
    expect(enrichedScript.sections[2]?.type).toBe("discussion");
    expect(enrichedScript.sections[3]?.type).toBe("discussion");
    expect(enrichedScript.sections[4]?.type).toBe("outro");
  });

  it("preserves newsItems from the original script", async () => {
    const enrichedScript = await runPipelineWith(
      "scripts/2026-03-21.json",
      createMockStorageImpl(),
      createMockVoicevoxImpl(),
    );
    expect(enrichedScript.newsItems).toEqual(MINIMAL_SCRIPT.newsItems);
  });

  it("calls storage.getScript with the provided key", async () => {
    const storage = createMockStorageImpl();
    await runPipelineWith(
      "scripts/2026-03-21.json",
      storage,
      createMockVoicevoxImpl(),
    );
    expect(storage.getScript).toHaveBeenCalledWith("scripts/2026-03-21.json");
  });

  it("calls storage.uploadWav with the output key and combined WAV buffer", async () => {
    const storage = createMockStorageImpl();
    await runPipelineWith(
      "scripts/2026-03-21.json",
      storage,
      createMockVoicevoxImpl(),
    );
    expect(storage.uploadWav).toHaveBeenCalledWith(
      MOCK_OUTPUT_KEY,
      MOCK_COMBINED_WAV,
    );
  });

  it("calls audioQuery once per line in the script (13 lines total)", async () => {
    const voicevox = createMockVoicevoxImpl();
    await runPipelineWith(
      "scripts/2026-03-21.json",
      createMockStorageImpl(),
      voicevox,
    );
    expect(voicevox.audioQuery).toHaveBeenCalledTimes(13);
  });

  it("calls synthesis once per line in the script (13 lines total)", async () => {
    const voicevox = createMockVoicevoxImpl();
    await runPipelineWith(
      "scripts/2026-03-21.json",
      createMockStorageImpl(),
      voicevox,
    );
    expect(voicevox.synthesis).toHaveBeenCalledTimes(13);
  });

  it("calls storage.buildOutputKey with the date extracted from the key", async () => {
    const storage = createMockStorageImpl();
    await runPipelineWith(
      "scripts/2026-03-21.json",
      storage,
      createMockVoicevoxImpl(),
    );
    expect(storage.buildOutputKey).toHaveBeenCalledWith(
      "2026-03-21",
      MINIMAL_SCRIPT.title,
    );
  });

  it("accumulates offsets sequentially: second line offset equals first line duration", async () => {
    const enrichedScript = await runPipelineWith(
      "scripts/2026-03-21.json",
      createMockStorageImpl(),
      createMockVoicevoxImpl(),
    );
    const intro = enrichedScript.sections[0];
    if (intro?.type === "intro") {
      expect(intro.greeting[0]?.offsetSec).toBeCloseTo(0, 5);
      expect(intro.newsOverview[0]?.offsetSec).toBeCloseTo(1.5, 5);
    }
  });
});

// ============================================
// runPipeline — error cases (fails, never throws)
// ============================================

describe("runPipeline — errors", () => {
  it("fails when storage.getScript fails", async () => {
    const storage: MockStorage = {
      ...createMockStorageImpl(),
      getScript: vi.fn(
        (_key: string): Effect.Effect<Script, S3Error> =>
          Effect.fail(new S3GetObjectError({ message: "NoSuchKey" })),
      ),
    };
    const result = await runPipelineWithResult(
      "scripts/2026-03-21.json",
      storage,
      createMockVoicevoxImpl(),
    );
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("S3GetObjectError");
    }
  });

  it("fails when audioQuery fails", async () => {
    const voicevox: MockVoicevox = {
      ...createMockVoicevoxImpl(),
      audioQuery: vi.fn(
        (
          _text: string,
          _speakerId: number,
        ): Effect.Effect<VoicevoxAudioQuery, VoicevoxError> =>
          Effect.fail(new AudioQueryError({ message: "VOICEVOX unreachable" })),
      ),
    };
    const result = await runPipelineWithResult(
      "scripts/2026-03-21.json",
      createMockStorageImpl(),
      voicevox,
    );
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("AudioQueryError");
    }
  });

  it("fails when synthesis fails", async () => {
    const voicevox: MockVoicevox = {
      ...createMockVoicevoxImpl(),
      synthesis: vi.fn(
        (
          _speakerId: number,
          _query: unknown,
        ): Effect.Effect<ArrayBuffer, VoicevoxError> =>
          Effect.fail(new SynthesisError({ message: "Synthesis failed" })),
      ),
    };
    const result = await runPipelineWithResult(
      "scripts/2026-03-21.json",
      createMockStorageImpl(),
      voicevox,
    );
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("SynthesisError");
    }
  });

  it("fails when getWavDurationSec fails", async () => {
    vi.mocked(getWavDurationSec).mockReturnValueOnce(
      Effect.fail(new InvalidHeaderError({ message: "Invalid WAV header" })),
    );
    const result = await runPipelineWithResult(
      "scripts/2026-03-21.json",
      createMockStorageImpl(),
      createMockVoicevoxImpl(),
    );
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("InvalidHeaderError");
    }
  });

  it("fails when concatenateWavs fails", async () => {
    vi.mocked(concatenateWavs).mockReturnValue(
      Effect.fail(new EmptyInputError({ message: "No WAV buffers" })),
    );
    const result = await runPipelineWithResult(
      "scripts/2026-03-21.json",
      createMockStorageImpl(),
      createMockVoicevoxImpl(),
    );
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("EmptyInputError");
    }
  });

  it("fails when storage.uploadWav fails", async () => {
    const storage: MockStorage = {
      ...createMockStorageImpl(),
      uploadWav: vi.fn(
        (_key: string, _data: ArrayBuffer): Effect.Effect<void, S3Error> =>
          Effect.fail(new S3PutObjectError({ message: "Upload failed" })),
      ),
    };
    const result = await runPipelineWithResult(
      "scripts/2026-03-21.json",
      storage,
      createMockVoicevoxImpl(),
    );
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("S3PutObjectError");
    }
  });

  it("short-circuits and skips TTS calls when script fetch fails", async () => {
    const storage: MockStorage = {
      ...createMockStorageImpl(),
      getScript: vi.fn(
        (_key: string): Effect.Effect<Script, S3Error> =>
          Effect.fail(new S3GetObjectError({ message: "Bucket not found" })),
      ),
    };
    const voicevox = createMockVoicevoxImpl();
    await runPipelineWithResult("scripts/2026-03-21.json", storage, voicevox);
    expect(voicevox.audioQuery).not.toHaveBeenCalled();
    expect(voicevox.synthesis).not.toHaveBeenCalled();
  });

  it("does not upload WAV when concatenation fails", async () => {
    vi.mocked(concatenateWavs).mockReturnValue(
      Effect.fail(new FormatMismatchError({ message: "Incompatible formats" })),
    );
    const storage = createMockStorageImpl();
    await runPipelineWithResult(
      "scripts/2026-03-21.json",
      storage,
      createMockVoicevoxImpl(),
    );
    expect(storage.uploadWav).not.toHaveBeenCalled();
  });
});

// ============================================
// runPipeline — uploadEnrichedScript integration
// ============================================

describe("runPipeline — uploadEnrichedScript integration", () => {
  it("calls storage.uploadEnrichedScript after uploadWav on success", async () => {
    const storage = createMockStorageImpl();
    await runPipelineWith(
      "scripts/2026-03-21.json",
      storage,
      createMockVoicevoxImpl(),
    );
    expect(storage.uploadWav).toHaveBeenCalledTimes(1);
    expect(storage.uploadEnrichedScript).toHaveBeenCalledTimes(1);
  });

  it("calls uploadEnrichedScript with the assembled EnrichedScript", async () => {
    const storage = createMockStorageImpl();
    await runPipelineWith(
      "scripts/2026-03-21.json",
      storage,
      createMockVoicevoxImpl(),
    );
    expect(storage.uploadEnrichedScript).toHaveBeenCalledWith(
      expect.objectContaining({
        title: MINIMAL_SCRIPT.title,
        outputWavS3Key: MOCK_OUTPUT_KEY,
      }),
    );
  });

  it("calls uploadEnrichedScript AFTER uploadWav (ordering constraint)", async () => {
    const callOrder: string[] = [];
    const storage: MockStorage = {
      ...createMockStorageImpl(),
      uploadWav: vi.fn(
        (_key: string, _data: ArrayBuffer): Effect.Effect<void, S3Error> => {
          callOrder.push("uploadWav");
          return Effect.succeed(undefined);
        },
      ),
      uploadEnrichedScript: vi.fn(
        (_data: EnrichedScript): Effect.Effect<void, S3Error> => {
          callOrder.push("uploadEnrichedScript");
          return Effect.succeed(undefined);
        },
      ),
    };
    await runPipelineWith(
      "scripts/2026-03-21.json",
      storage,
      createMockVoicevoxImpl(),
    );
    expect(callOrder).toEqual(["uploadWav", "uploadEnrichedScript"]);
  });

  it("fails when uploadEnrichedScript fails", async () => {
    const storage: MockStorage = {
      ...createMockStorageImpl(),
      uploadEnrichedScript: vi.fn(
        (_data: EnrichedScript): Effect.Effect<void, S3Error> =>
          Effect.fail(
            new S3PutObjectError({ message: "Enriched script upload failed" }),
          ),
      ),
    };
    const result = await runPipelineWithResult(
      "scripts/2026-03-21.json",
      storage,
      createMockVoicevoxImpl(),
    );
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("S3PutObjectError");
    }
  });

  it("does not call uploadEnrichedScript when uploadWav fails", async () => {
    const storage: MockStorage = {
      ...createMockStorageImpl(),
      uploadWav: vi.fn(
        (_key: string, _data: ArrayBuffer): Effect.Effect<void, S3Error> =>
          Effect.fail(new S3PutObjectError({ message: "WAV upload failed" })),
      ),
    };
    await runPipelineWithResult(
      "scripts/2026-03-21.json",
      storage,
      createMockVoicevoxImpl(),
    );
    expect(storage.uploadEnrichedScript).not.toHaveBeenCalled();
  });

  it("does not call uploadEnrichedScript when WAV concatenation fails", async () => {
    vi.mocked(concatenateWavs).mockReturnValue(
      Effect.fail(new FormatMismatchError({ message: "Incompatible formats" })),
    );
    const storage = createMockStorageImpl();
    await runPipelineWithResult(
      "scripts/2026-03-21.json",
      storage,
      createMockVoicevoxImpl(),
    );
    expect(storage.uploadEnrichedScript).not.toHaveBeenCalled();
  });

  it("does not call uploadEnrichedScript when script fetch fails", async () => {
    const storage: MockStorage = {
      ...createMockStorageImpl(),
      getScript: vi.fn(
        (_key: string): Effect.Effect<Script, S3Error> =>
          Effect.fail(new S3GetObjectError({ message: "NoSuchKey" })),
      ),
    };
    await runPipelineWithResult(
      "scripts/2026-03-21.json",
      storage,
      createMockVoicevoxImpl(),
    );
    expect(storage.uploadEnrichedScript).not.toHaveBeenCalled();
  });
});
