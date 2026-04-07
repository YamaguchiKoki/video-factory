// Tests for the CLI entry point (cli.ts).
//
// Design contract:
//   DEFAULT_INPUT_KEY = "script-generator/script.json"
//   DEFAULT_OUTPUT_WAV_KEY = "tts-worker/audio.wav"
//   DEFAULT_OUTPUT_SCRIPT_KEY = "tts-worker/script.json"
//
//   createMainProgram(opts): Effect<void, PipelineError | EnvValidationError>

import { Effect, Layer, Result } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StorageService } from "../storage";

// ============================================
// Mock dependencies
// ============================================

const { mockRunPipeline } = vi.hoisted(() => ({
  mockRunPipeline: vi.fn(),
}));

vi.mock("../pipeline", () => ({
  runPipeline: mockRunPipeline,
}));

const { mockCreateStorageServiceLive } = vi.hoisted(() => ({
  mockCreateStorageServiceLive: vi.fn(),
}));

vi.mock("../s3", () => ({
  createStorageServiceLive: mockCreateStorageServiceLive,
  extractDateFromKey: vi.fn(
    (key: string) => key.split("/").at(-1)?.replace(".json", "") ?? key,
  ),
  createS3ClientConfig: vi.fn(() => ({})),
}));

vi.mock("../voicevox", () => ({
  VoicevoxServiceLive: Layer.empty,
  VoicevoxService: {},
  VOICEVOX_URL: "http://localhost:50021",
}));

import {
  createMainProgram,
  DEFAULT_INPUT_KEY,
  DEFAULT_OUTPUT_SCRIPT_KEY,
  DEFAULT_OUTPUT_WAV_KEY,
} from "../cli";
import type { EnrichedScript } from "../schema";

// ============================================
// Test data helpers
// ============================================

const buildValidEnrichedScript = (): EnrichedScript => ({
  title: "テストラジオ",
  totalDurationSec: 3.0,
  outputWavS3Key: "tts-worker/audio.wav",
  newsItems: [
    { id: "news-1", title: "ニュース1" },
    { id: "news-2", title: "ニュース2" },
    { id: "news-3", title: "ニュース3" },
  ],
  sections: [
    {
      type: "intro",
      greeting: [
        {
          speaker: "A",
          text: "こんにちは",
          voicevoxSpeakerId: 0,
          offsetSec: 0,
          durationSec: 1.0,
        },
      ],
      newsOverview: [
        {
          speaker: "B",
          text: "今日のニュース",
          voicevoxSpeakerId: 1,
          offsetSec: 1.0,
          durationSec: 1.0,
        },
      ],
    },
    {
      type: "discussion",
      newsId: "news-1",
      blocks: [
        {
          phase: "summary",
          lines: [
            {
              speaker: "A",
              text: "概要1",
              voicevoxSpeakerId: 0,
              offsetSec: 2.0,
              durationSec: 0.5,
            },
          ],
        },
        {
          phase: "background",
          lines: [
            {
              speaker: "B",
              text: "背景1",
              voicevoxSpeakerId: 1,
              offsetSec: 2.5,
              durationSec: 0.5,
            },
          ],
        },
        {
          phase: "deepDive",
          lines: [
            {
              speaker: "A",
              text: "深掘り1",
              voicevoxSpeakerId: 0,
              offsetSec: 3.0,
              durationSec: 0.5,
            },
          ],
        },
      ],
    },
    {
      type: "discussion",
      newsId: "news-2",
      blocks: [
        {
          phase: "summary",
          lines: [
            {
              speaker: "A",
              text: "概要2",
              voicevoxSpeakerId: 0,
              offsetSec: 3.5,
              durationSec: 0.5,
            },
          ],
        },
        {
          phase: "background",
          lines: [
            {
              speaker: "B",
              text: "背景2",
              voicevoxSpeakerId: 1,
              offsetSec: 4.0,
              durationSec: 0.5,
            },
          ],
        },
        {
          phase: "deepDive",
          lines: [
            {
              speaker: "A",
              text: "深掘り2",
              voicevoxSpeakerId: 0,
              offsetSec: 4.5,
              durationSec: 0.5,
            },
          ],
        },
      ],
    },
    {
      type: "discussion",
      newsId: "news-3",
      blocks: [
        {
          phase: "summary",
          lines: [
            {
              speaker: "A",
              text: "概要3",
              voicevoxSpeakerId: 0,
              offsetSec: 5.0,
              durationSec: 0.5,
            },
          ],
        },
        {
          phase: "background",
          lines: [
            {
              speaker: "B",
              text: "背景3",
              voicevoxSpeakerId: 1,
              offsetSec: 5.5,
              durationSec: 0.5,
            },
          ],
        },
        {
          phase: "deepDive",
          lines: [
            {
              speaker: "A",
              text: "深掘り3",
              voicevoxSpeakerId: 0,
              offsetSec: 6.0,
              durationSec: 0.5,
            },
          ],
        },
      ],
    },
    {
      type: "outro",
      recap: [
        {
          speaker: "A",
          text: "まとめ",
          voicevoxSpeakerId: 0,
          offsetSec: 6.5,
          durationSec: 1.0,
        },
      ],
      closing: [
        {
          speaker: "B",
          text: "さようなら",
          voicevoxSpeakerId: 1,
          offsetSec: 7.5,
          durationSec: 1.0,
        },
      ],
    },
  ],
});

const createNullStorageLayer = () =>
  Layer.succeed(StorageService, {
    getScript: () => Effect.succeed({} as never),
    uploadWav: () => Effect.succeed(undefined),
    uploadEnrichedScript: () => Effect.succeed(undefined),
    buildOutputKey: () => "key",
  });

// ============================================
// S3 key constants
// ============================================

describe("default S3 key constants", () => {
  it("DEFAULT_INPUT_KEY is script-generator/script.json", () => {
    expect(DEFAULT_INPUT_KEY).toBe("script-generator/script.json");
  });

  it("DEFAULT_OUTPUT_WAV_KEY is tts-worker/audio.wav", () => {
    expect(DEFAULT_OUTPUT_WAV_KEY).toBe("tts-worker/audio.wav");
  });

  it("DEFAULT_OUTPUT_SCRIPT_KEY is tts-worker/script.json", () => {
    expect(DEFAULT_OUTPUT_SCRIPT_KEY).toBe("tts-worker/script.json");
  });
});

// ============================================
// createMainProgram
// ============================================

describe("createMainProgram", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.S3_BUCKET = "video-factory";
    mockCreateStorageServiceLive.mockReturnValue(createNullStorageLayer());
    mockRunPipeline.mockReturnValue(Effect.succeed(buildValidEnrichedScript()));
  });

  afterEach(() => {
    delete process.env.S3_BUCKET;
    vi.restoreAllMocks();
  });

  it("succeeds when env is valid and pipeline succeeds", async () => {
    const result = await Effect.runPromise(
      Effect.result(
        createMainProgram({
          inputKey: DEFAULT_INPUT_KEY,
          outputWavKey: DEFAULT_OUTPUT_WAV_KEY,
          outputScriptKey: DEFAULT_OUTPUT_SCRIPT_KEY,
        }),
      ),
    );
    expect(Result.isSuccess(result)).toBe(true);
  });

  it("fails with EnvValidationError when S3_BUCKET is not set", async () => {
    delete process.env.S3_BUCKET;

    const result = await Effect.runPromise(
      Effect.result(
        createMainProgram({
          inputKey: DEFAULT_INPUT_KEY,
          outputWavKey: DEFAULT_OUTPUT_WAV_KEY,
          outputScriptKey: DEFAULT_OUTPUT_SCRIPT_KEY,
        }),
      ),
    );

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("EnvValidationError");
    }
  });

  it("calls runPipeline with opts.inputKey", async () => {
    await Effect.runPromise(
      createMainProgram({
        inputKey: "custom/script.json",
        outputWavKey: DEFAULT_OUTPUT_WAV_KEY,
        outputScriptKey: DEFAULT_OUTPUT_SCRIPT_KEY,
      }),
    );

    expect(mockRunPipeline).toHaveBeenCalledWith("custom/script.json");
  });

  it("calls createStorageServiceLive with the bucket from env", async () => {
    await Effect.runPromise(
      createMainProgram({
        inputKey: DEFAULT_INPUT_KEY,
        outputWavKey: DEFAULT_OUTPUT_WAV_KEY,
        outputScriptKey: DEFAULT_OUTPUT_SCRIPT_KEY,
      }),
    );

    expect(mockCreateStorageServiceLive).toHaveBeenCalledWith(
      "video-factory",
      expect.any(String),
      expect.any(String),
      expect.any(Object),
    );
  });

  it("calls createStorageServiceLive with opts.outputWavKey", async () => {
    await Effect.runPromise(
      createMainProgram({
        inputKey: DEFAULT_INPUT_KEY,
        outputWavKey: "custom/audio.wav",
        outputScriptKey: DEFAULT_OUTPUT_SCRIPT_KEY,
      }),
    );

    expect(mockCreateStorageServiceLive).toHaveBeenCalledWith(
      expect.any(String),
      "custom/audio.wav",
      expect.any(String),
      expect.any(Object),
    );
  });

  it("calls createStorageServiceLive with opts.outputScriptKey", async () => {
    await Effect.runPromise(
      createMainProgram({
        inputKey: DEFAULT_INPUT_KEY,
        outputWavKey: DEFAULT_OUTPUT_WAV_KEY,
        outputScriptKey: "custom/enriched.json",
      }),
    );

    expect(mockCreateStorageServiceLive).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      "custom/enriched.json",
      expect.any(Object),
    );
  });

  it("fails when runPipeline fails", async () => {
    const { S3GetObjectError } = await import("../errors");
    mockRunPipeline.mockReturnValue(
      Effect.fail(new S3GetObjectError({ message: "S3 error" })),
    );

    const result = await Effect.runPromise(
      Effect.result(
        createMainProgram({
          inputKey: DEFAULT_INPUT_KEY,
          outputWavKey: DEFAULT_OUTPUT_WAV_KEY,
          outputScriptKey: DEFAULT_OUTPUT_SCRIPT_KEY,
        }),
      ),
    );

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("S3GetObjectError");
    }
  });
});
