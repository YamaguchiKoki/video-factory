// Tests for the Docker CLI entry point (cli.ts) using commander.
//
// Design contract:
//   DEFAULT_SCRIPT_KEY = "tts-worker/script.json"
//   DEFAULT_AUDIO_KEY  = "tts-worker/audio.wav"
//   DEFAULT_OUTPUT_KEY = "video-worker/video.mp4"
//
//   createProgram(): Command

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { errAsync, okAsync } from "neverthrow";

// ============================================
// Mock ./infrastructure
// ============================================

const {
  mockCreateTempDir,
  mockCleanupTempDir,
  mockCreateRenderVideo,
  mockBundleComposition,
  mockReadFile,
  mockWriteFile,
} = vi.hoisted(() => ({
  mockCreateTempDir: vi.fn(),
  mockCleanupTempDir: vi.fn(),
  mockCreateRenderVideo: vi.fn(),
  mockBundleComposition: vi.fn(),
  mockReadFile: vi.fn(),
  mockWriteFile: vi.fn(),
}));

vi.mock("./infrastructure", () => ({
  createTempDir: mockCreateTempDir,
  cleanupTempDir: mockCleanupTempDir,
  createRenderVideo: mockCreateRenderVideo,
  bundleComposition: mockBundleComposition,
  readFile: mockReadFile,
  writeFile: mockWriteFile,
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

const { mockCreateS3Client, mockDownloadToFile, mockUploadFromFile } = vi.hoisted(() => ({
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

import { DEFAULT_AUDIO_KEY, DEFAULT_OUTPUT_KEY, DEFAULT_SCRIPT_KEY, createProgram } from "./cli";

// ============================================
// Test data
// ============================================

const TEMP_DIR = "/tmp/video-worker-test";

const fileSystemError = {
  type: "IO_ERROR" as const,
  message: "filesystem error",
  cause: null,
  context: {},
};

const s3Error = {
  type: "GET_OBJECT_ERROR" as const,
  message: "s3 download error",
};

const uploadS3Error = {
  type: "PUT_OBJECT_ERROR" as const,
  message: "s3 upload error",
};

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
    process.env["S3_BUCKET"] = "video-factory";
    vi.spyOn(process, "exit").mockReturnValue(undefined as never);
    mockCreateLogger.mockReturnValue(mockLogger);
    mockCreateS3Client.mockReturnValue({});
    mockCreateRenderVideo.mockReturnValue(vi.fn());
    mockCreateTempDir.mockReturnValue(okAsync(TEMP_DIR));
    mockCleanupTempDir.mockReturnValue(okAsync(undefined));
    mockDownloadToFile.mockReturnValue(okAsync(undefined));
    mockRenderWorkflow.mockReturnValue(okAsync(`${TEMP_DIR}/video.mp4`));
    mockUploadFromFile.mockReturnValue(okAsync(undefined));
  });

  afterEach(() => {
    delete process.env["S3_BUCKET"];
    vi.restoreAllMocks();
  });

  it("exits with code 1 when S3_BUCKET is not set", async () => {
    delete process.env["S3_BUCKET"];

    await runProgram();

    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("exits with code 1 when createTempDir fails", async () => {
    mockCreateTempDir.mockReturnValue(errAsync(fileSystemError));

    await runProgram().catch(() => undefined);

    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("exits with code 1 when script download fails", async () => {
    mockDownloadToFile.mockReturnValueOnce(errAsync(s3Error));

    await runProgram();

    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("exits with code 1 when audio download fails", async () => {
    mockDownloadToFile
      .mockReturnValueOnce(okAsync(undefined))
      .mockReturnValueOnce(errAsync(s3Error));

    await runProgram();

    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("exits with code 1 when render workflow fails", async () => {
    mockRenderWorkflow.mockReturnValue(errAsync(videoServiceError));

    await runProgram();

    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("exits with code 1 when S3 upload fails", async () => {
    mockUploadFromFile.mockReturnValue(errAsync(uploadS3Error));

    await runProgram();

    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("uses default keys when no options are provided", async () => {
    await runProgram();

    expect(mockDownloadToFile).toHaveBeenCalledWith(
      expect.any(Object),
      "video-factory",
      DEFAULT_SCRIPT_KEY,
      expect.any(String),
    );
    expect(mockDownloadToFile).toHaveBeenCalledWith(
      expect.any(Object),
      "video-factory",
      DEFAULT_AUDIO_KEY,
      expect.any(String),
    );
    expect(mockUploadFromFile).toHaveBeenCalledWith(
      expect.any(Object),
      "video-factory",
      DEFAULT_OUTPUT_KEY,
      expect.any(String),
      "video/mp4",
    );
  });

  it("passes custom --script-key to downloadToFile", async () => {
    await runProgram("--script-key", "custom/script.json");

    expect(mockDownloadToFile).toHaveBeenCalledWith(
      expect.any(Object),
      "video-factory",
      "custom/script.json",
      expect.any(String),
    );
  });

  it("passes custom --audio-key to downloadToFile", async () => {
    await runProgram("--audio-key", "custom/audio.wav");

    expect(mockDownloadToFile).toHaveBeenCalledWith(
      expect.any(Object),
      "video-factory",
      "custom/audio.wav",
      expect.any(String),
    );
  });

  it("passes custom --output-key to uploadFromFile", async () => {
    await runProgram("--output-key", "custom/video.mp4");

    expect(mockUploadFromFile).toHaveBeenCalledWith(
      expect.any(Object),
      "video-factory",
      "custom/video.mp4",
      expect.any(String),
      "video/mp4",
    );
  });
});
