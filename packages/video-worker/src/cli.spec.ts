// Tests for the Docker CLI entry point (cli.ts) using commander.
//
// Design contract:
//   DEFAULT_SCRIPT_KEY = "tts-worker/script.json"
//   DEFAULT_AUDIO_KEY  = "tts-worker/audio.wav"
//   DEFAULT_OUTPUT_KEY = "video-worker/video.mp4"
//
//   createProgram(): Command

import { errAsync, okAsync } from "neverthrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ============================================
// Mock ./infrastructure
// ============================================

const {
  mockCreateTempDir,
  mockCleanupTempDir,
  mockCreateRenderVideo,
  mockBundleComposition,
  mockReadFile,
} = vi.hoisted(() => ({
  mockCreateTempDir: vi.fn(),
  mockCleanupTempDir: vi.fn(),
  mockCreateRenderVideo: vi.fn(),
  mockBundleComposition: vi.fn(),
  mockReadFile: vi.fn(),
}));

vi.mock("./infrastructure", () => ({
  createTempDir: mockCreateTempDir,
  cleanupTempDir: mockCleanupTempDir,
  createRenderVideo: mockCreateRenderVideo,
  bundleComposition: mockBundleComposition,
  readFile: mockReadFile,
}));

// ============================================
// Mock ./infrastructure/logger
// ============================================

const { mockCreateLogger } = vi.hoisted(() => ({
  mockCreateLogger: vi.fn(),
}));

vi.mock("./infrastructure/logger", () => ({
  createLogger: mockCreateLogger,
}));

// ============================================
// Mock ./service/video-service
// ============================================

const { mockRenderWorkflow, mockCreateRenderVideoWorkflow } = vi.hoisted(() => {
  const mockRenderWorkflow = vi.fn();
  return {
    mockRenderWorkflow,
    mockCreateRenderVideoWorkflow: vi.fn(() => mockRenderWorkflow),
  };
});

vi.mock("./service/video-service", () => ({
  createRenderVideoWorkflow: mockCreateRenderVideoWorkflow,
}));

// ============================================
// Mock ./infrastructure/s3
// ============================================

const { mockCreateS3Client, mockDownloadToFile, mockUploadFromFile } =
  vi.hoisted(() => ({
    mockCreateS3Client: vi.fn(),
    mockDownloadToFile: vi.fn(),
    mockUploadFromFile: vi.fn(),
  }));

vi.mock("./infrastructure/s3", () => ({
  createS3Client: mockCreateS3Client,
  downloadToFile: mockDownloadToFile,
  uploadFromFile: mockUploadFromFile,
}));

// ============================================
// Mock ./core/enriched-parser
// ============================================

vi.mock("./core/enriched-parser", () => ({
  parseEnrichedScript: vi.fn(),
}));

import {
  createProgram,
  DEFAULT_AUDIO_KEY,
  DEFAULT_OUTPUT_KEY,
  DEFAULT_SCRIPT_KEY,
} from "./cli";

// ============================================
// Test data
// ============================================

const videoServiceError = {
  type: "RENDER_ERROR" as const,
  message: "render failed",
  cause: null,
  context: {},
};

// ============================================
// Helper
// ============================================

const runProgram = (...args: ReadonlyArray<string>) =>
  createProgram().parseAsync(["node", "cli.ts", ...args]);

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
// createProgram — commander CLI
// ============================================

describe("createProgram", () => {
  const mockLogger = {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.S3_BUCKET = "video-factory";
    vi.spyOn(process, "exit").mockReturnValue(undefined as never);
    mockCreateLogger.mockReturnValue(mockLogger);
    mockCreateS3Client.mockReturnValue({});
    mockCreateRenderVideo.mockReturnValue(vi.fn());
    mockRenderWorkflow.mockReturnValue(okAsync("video-worker/video.mp4"));
  });

  afterEach(() => {
    delete process.env.S3_BUCKET;
    vi.restoreAllMocks();
  });

  it("exits with code 1 when S3_BUCKET is not set", async () => {
    delete process.env.S3_BUCKET;

    await runProgram();

    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("exits with code 1 when render workflow fails", async () => {
    mockRenderWorkflow.mockReturnValue(errAsync(videoServiceError));

    await runProgram();

    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("calls renderWorkflow with default S3 keys when no options provided", async () => {
    await runProgram();

    expect(mockRenderWorkflow).toHaveBeenCalledWith(
      DEFAULT_SCRIPT_KEY,
      DEFAULT_AUDIO_KEY,
      DEFAULT_OUTPUT_KEY,
    );
  });

  it("passes custom --script-key to renderWorkflow", async () => {
    await runProgram("--script-key", "custom/script.json");

    expect(mockRenderWorkflow).toHaveBeenCalledWith(
      "custom/script.json",
      expect.any(String),
      expect.any(String),
    );
  });

  it("passes custom --audio-key to renderWorkflow", async () => {
    await runProgram("--audio-key", "custom/audio.wav");

    expect(mockRenderWorkflow).toHaveBeenCalledWith(
      expect.any(String),
      "custom/audio.wav",
      expect.any(String),
    );
  });

  it("passes custom --output-key to renderWorkflow", async () => {
    await runProgram("--output-key", "custom/video.mp4");

    expect(mockRenderWorkflow).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      "custom/video.mp4",
    );
  });

  it("does not exit when render workflow succeeds", async () => {
    await runProgram();

    expect(process.exit).not.toHaveBeenCalled();
  });
});
