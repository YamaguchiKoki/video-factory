// Tests for the Docker CLI entry point (cli.ts).
//
// Design contract:
//   DEFAULT_SCRIPT_KEY = "tts-worker/script.json"
//   DEFAULT_AUDIO_KEY  = "tts-worker/audio.wav"
//   DEFAULT_OUTPUT_KEY = "video-worker/video.mp4"
//
//   createMainProgram(opts): Effect<void, ...>

import { Effect, Result } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ============================================
// Mock ./deps
// ============================================

const {
  mockRenderWorkflow,
  mockCreateRenderVideoWorkflow,
  mockCreateDockerDeps,
} = vi.hoisted(() => {
  const mockRenderWorkflow = vi.fn();
  return {
    mockRenderWorkflow,
    mockCreateRenderVideoWorkflow: vi.fn(() => mockRenderWorkflow),
    mockCreateDockerDeps: vi.fn(),
  };
});

vi.mock("./deps", () => ({
  createDockerDeps: mockCreateDockerDeps,
}));

// ============================================
// Mock ./service/video-service
// ============================================

vi.mock("./service/video-service", () => ({
  createRenderVideoWorkflow: mockCreateRenderVideoWorkflow,
}));

import {
  createMainProgram,
  DEFAULT_AUDIO_KEY,
  DEFAULT_OUTPUT_KEY,
  DEFAULT_SCRIPT_KEY,
} from "./cli";

// ============================================
// Constant assertions
// ============================================

describe("DEFAULT_SCRIPT_KEY", () => {
  it("is tts-worker/script.json", () => {
    expect(DEFAULT_SCRIPT_KEY).toBe("tts-worker/script.json");
  });
});

describe("DEFAULT_AUDIO_KEY", () => {
  it("is tts-worker/audio.wav", () => {
    expect(DEFAULT_AUDIO_KEY).toBe("tts-worker/audio.wav");
  });
});

describe("DEFAULT_OUTPUT_KEY", () => {
  it("is video-worker/video.mp4", () => {
    expect(DEFAULT_OUTPUT_KEY).toBe("video-worker/video.mp4");
  });
});

// ============================================
// createMainProgram
// ============================================

describe("createMainProgram", () => {
  const mockLogger = {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.S3_BUCKET = "video-factory";
    mockCreateDockerDeps.mockReturnValue({ logger: mockLogger });
    mockRenderWorkflow.mockReturnValue(
      Effect.succeed("video-worker/video.mp4"),
    );
  });

  afterEach(() => {
    delete process.env.S3_BUCKET;
    vi.restoreAllMocks();
  });

  it("fails with EnvValidationError when S3_BUCKET is not set", async () => {
    delete process.env.S3_BUCKET;

    const result = await Effect.runPromise(
      Effect.result(
        createMainProgram({
          scriptKey: DEFAULT_SCRIPT_KEY,
          audioKey: DEFAULT_AUDIO_KEY,
          outputKey: DEFAULT_OUTPUT_KEY,
        }),
      ),
    );

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("EnvValidationError");
    }
  });

  it("succeeds when env is valid and workflow succeeds", async () => {
    const result = await Effect.runPromise(
      Effect.result(
        createMainProgram({
          scriptKey: DEFAULT_SCRIPT_KEY,
          audioKey: DEFAULT_AUDIO_KEY,
          outputKey: DEFAULT_OUTPUT_KEY,
        }),
      ),
    );

    expect(Result.isSuccess(result)).toBe(true);
  });

  it("calls renderWorkflow with default S3 keys", async () => {
    await Effect.runPromise(
      createMainProgram({
        scriptKey: DEFAULT_SCRIPT_KEY,
        audioKey: DEFAULT_AUDIO_KEY,
        outputKey: DEFAULT_OUTPUT_KEY,
      }),
    );

    expect(mockRenderWorkflow).toHaveBeenCalledWith(
      DEFAULT_SCRIPT_KEY,
      DEFAULT_AUDIO_KEY,
      DEFAULT_OUTPUT_KEY,
    );
  });

  it("passes custom scriptKey to renderWorkflow", async () => {
    await Effect.runPromise(
      createMainProgram({
        scriptKey: "custom/script.json",
        audioKey: DEFAULT_AUDIO_KEY,
        outputKey: DEFAULT_OUTPUT_KEY,
      }),
    );

    expect(mockRenderWorkflow).toHaveBeenCalledWith(
      "custom/script.json",
      expect.any(String),
      expect.any(String),
    );
  });

  it("passes custom audioKey to renderWorkflow", async () => {
    await Effect.runPromise(
      createMainProgram({
        scriptKey: DEFAULT_SCRIPT_KEY,
        audioKey: "custom/audio.wav",
        outputKey: DEFAULT_OUTPUT_KEY,
      }),
    );

    expect(mockRenderWorkflow).toHaveBeenCalledWith(
      expect.any(String),
      "custom/audio.wav",
      expect.any(String),
    );
  });

  it("passes custom outputKey to renderWorkflow", async () => {
    await Effect.runPromise(
      createMainProgram({
        scriptKey: DEFAULT_SCRIPT_KEY,
        audioKey: DEFAULT_AUDIO_KEY,
        outputKey: "custom/video.mp4",
      }),
    );

    expect(mockRenderWorkflow).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      "custom/video.mp4",
    );
  });

  it("fails when render workflow fails", async () => {
    const { RenderError } = await import("./core/errors");
    mockRenderWorkflow.mockReturnValue(
      Effect.fail(new RenderError({ message: "render failed" })),
    );

    const result = await Effect.runPromise(
      Effect.result(
        createMainProgram({
          scriptKey: DEFAULT_SCRIPT_KEY,
          audioKey: DEFAULT_AUDIO_KEY,
          outputKey: DEFAULT_OUTPUT_KEY,
        }),
      ),
    );

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("RenderError");
    }
  });
});
