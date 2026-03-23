// Tests for the Docker CLI entry point (cli.ts) using commander.
//
// Design contract:
//   DEFAULT_INPUT_KEY = "script-generator/script.json"
//   DEFAULT_OUTPUT_WAV_KEY = "tts-worker/audio.wav"
//   DEFAULT_OUTPUT_SCRIPT_KEY = "tts-worker/script.json"
//
//   createDockerStorage(bucket, outputWavKey): StorageDeps
//   createProgram(): Command

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { okAsync, errAsync } from "neverthrow";
import type { EnrichedScript } from "../schema";

// ============================================
// Mock pipeline and s3 modules
// ============================================

const { mockRunPipeline } = vi.hoisted(() => ({
  mockRunPipeline: vi.fn(),
}));

vi.mock("../pipeline", () => ({
  runPipeline: mockRunPipeline,
}));

const {
  mockGetScriptFromS3,
  mockUploadWavToS3,
  mockUploadEnrichedScriptToS3,
} = vi.hoisted(() => ({
  mockGetScriptFromS3: vi.fn(),
  mockUploadWavToS3: vi.fn(),
  mockUploadEnrichedScriptToS3: vi.fn(),
}));

vi.mock("../s3", () => ({
  getScriptFromS3: mockGetScriptFromS3,
  uploadWavToS3: mockUploadWavToS3,
  uploadEnrichedScriptToS3: mockUploadEnrichedScriptToS3,
  createS3ClientConfig: vi.fn(() => ({})),
}));

import {
  DEFAULT_INPUT_KEY,
  DEFAULT_OUTPUT_SCRIPT_KEY,
  DEFAULT_OUTPUT_WAV_KEY,
  createDockerStorage,
  createProgram,
} from "../cli";

// ============================================
// Test data
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
        { speaker: "A", text: "こんにちは", voicevoxSpeakerId: 0, offsetSec: 0, durationSec: 1.0 },
      ],
      newsOverview: [
        { speaker: "B", text: "今日のニュース", voicevoxSpeakerId: 1, offsetSec: 1.0, durationSec: 1.0 },
      ],
    },
    {
      type: "discussion",
      newsId: "news-1",
      blocks: [
        { phase: "summary", lines: [{ speaker: "A", text: "概要1", voicevoxSpeakerId: 0, offsetSec: 2.0, durationSec: 0.5 }] },
        { phase: "background", lines: [{ speaker: "B", text: "背景1", voicevoxSpeakerId: 1, offsetSec: 2.5, durationSec: 0.5 }] },
        { phase: "deepDive", lines: [{ speaker: "A", text: "深掘り1", voicevoxSpeakerId: 0, offsetSec: 3.0, durationSec: 0.5 }] },
      ],
    },
    {
      type: "discussion",
      newsId: "news-2",
      blocks: [
        { phase: "summary", lines: [{ speaker: "A", text: "概要2", voicevoxSpeakerId: 0, offsetSec: 3.5, durationSec: 0.5 }] },
        { phase: "background", lines: [{ speaker: "B", text: "背景2", voicevoxSpeakerId: 1, offsetSec: 4.0, durationSec: 0.5 }] },
        { phase: "deepDive", lines: [{ speaker: "A", text: "深掘り2", voicevoxSpeakerId: 0, offsetSec: 4.5, durationSec: 0.5 }] },
      ],
    },
    {
      type: "discussion",
      newsId: "news-3",
      blocks: [
        { phase: "summary", lines: [{ speaker: "A", text: "概要3", voicevoxSpeakerId: 0, offsetSec: 5.0, durationSec: 0.5 }] },
        { phase: "background", lines: [{ speaker: "B", text: "背景3", voicevoxSpeakerId: 1, offsetSec: 5.5, durationSec: 0.5 }] },
        { phase: "deepDive", lines: [{ speaker: "A", text: "深掘り3", voicevoxSpeakerId: 0, offsetSec: 6.0, durationSec: 0.5 }] },
      ],
    },
    {
      type: "outro",
      recap: [{ speaker: "A", text: "まとめ", voicevoxSpeakerId: 0, offsetSec: 6.5, durationSec: 1.0 }],
      closing: [{ speaker: "B", text: "さようなら", voicevoxSpeakerId: 1, offsetSec: 7.5, durationSec: 1.0 }],
    },
  ],
});

// ============================================
// Helper to run the program with args
// ============================================

const runProgram = (...args: ReadonlyArray<string>) =>
  createProgram().parseAsync(["node", "cli.ts", ...args]);

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
// createDockerStorage
// ============================================

describe("createDockerStorage", () => {
  it("buildOutputKey returns the given outputWavKey regardless of arguments", () => {
    const storage = createDockerStorage("video-factory", "custom/audio.wav");

    expect(storage.buildOutputKey("2026-03-21", "タイトル")).toBe("custom/audio.wav");
    expect(storage.buildOutputKey("", "")).toBe("custom/audio.wav");
  });
});

// ============================================
// createProgram — commander CLI
// ============================================

describe("createProgram", () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env["S3_BUCKET"] = "video-factory";
    exitSpy = vi.spyOn(process, "exit").mockReturnValue(undefined as never);
    mockRunPipeline.mockReturnValue(okAsync(buildValidEnrichedScript()));
    mockUploadEnrichedScriptToS3.mockReturnValue(okAsync(undefined));
  });

  afterEach(() => {
    delete process.env["S3_BUCKET"];
    vi.restoreAllMocks();
  });

  it("exits with code 1 when S3_BUCKET is not set", async () => {
    delete process.env["S3_BUCKET"];

    await runProgram();

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("uses default keys when no options are provided", async () => {
    await runProgram();

    expect(mockRunPipeline).toHaveBeenCalledWith(
      expect.any(Object),
      DEFAULT_INPUT_KEY,
    );
    expect(mockUploadEnrichedScriptToS3).toHaveBeenCalledWith(
      "video-factory",
      DEFAULT_OUTPUT_SCRIPT_KEY,
      expect.any(Object),
    );
  });

  it("passes custom --input-key to runPipeline", async () => {
    await runProgram("--input-key", "custom/script.json");

    expect(mockRunPipeline).toHaveBeenCalledWith(
      expect.any(Object),
      "custom/script.json",
    );
  });

  it("passes custom --output-wav-key to createDockerStorage", async () => {
    await runProgram("--output-wav-key", "custom/audio.wav");

    const storageDeps = mockRunPipeline.mock.calls[0]?.[0];
    expect(storageDeps.buildOutputKey("", "")).toBe("custom/audio.wav");
  });

  it("passes custom --output-script-key to uploadEnrichedScriptToS3", async () => {
    await runProgram("--output-script-key", "custom/enriched.json");

    expect(mockUploadEnrichedScriptToS3).toHaveBeenCalledWith(
      "video-factory",
      "custom/enriched.json",
      expect.any(Object),
    );
  });

  it("exits with code 1 when runPipeline returns an error", async () => {
    mockRunPipeline.mockReturnValue(
      errAsync({ type: "GET_OBJECT_ERROR" as const, message: "S3 error" }),
    );

    await runProgram();

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits with code 1 when uploadEnrichedScriptToS3 returns an error", async () => {
    mockUploadEnrichedScriptToS3.mockReturnValue(
      errAsync({ type: "PUT_OBJECT_ERROR" as const, message: "upload failed" }),
    );

    await runProgram();

    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
