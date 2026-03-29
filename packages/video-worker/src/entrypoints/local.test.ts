// Tests for the local.ts entrypoint.
//
// Design contract:
//   - Uses commander: --script <path>, --audio <path>, --output <path>
//   - main(): Promise<void> is exported as a pure function
//   - Missing --script or --audio or --output → exits 1 with an error message
//   - All required args present → runs renderWorkflow and exits based on result

import { errAsync, okAsync } from "neverthrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ============================================
// Mock heavy dependencies
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

vi.mock("../infrastructure", () => ({
  createTempDir: mockCreateTempDir,
  cleanupTempDir: mockCleanupTempDir,
  createRenderVideo: mockCreateRenderVideo,
  bundleComposition: mockBundleComposition,
  readFile: mockReadFile,
}));

const { mockCreateLogger } = vi.hoisted(() => ({
  mockCreateLogger: vi.fn(),
}));

vi.mock("../infrastructure/logger", () => ({
  createLogger: mockCreateLogger,
}));

const { mockRenderWorkflow, mockCreateRenderVideoWorkflow } = vi.hoisted(() => {
  const mockRenderWorkflow = vi.fn();
  return {
    mockRenderWorkflow,
    mockCreateRenderVideoWorkflow: vi.fn(() => mockRenderWorkflow),
  };
});

vi.mock("../service/video-service", () => ({
  createRenderVideoWorkflow: mockCreateRenderVideoWorkflow,
}));

vi.mock("../core/enriched-parser", () => ({
  parseEnrichedScript: vi.fn(),
}));

// ============================================
// Setup
// ============================================

const mockLogger = {
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

const videoServiceError = {
  type: "RENDER_ERROR" as const,
  message: "render failed",
  cause: null,
  context: {},
};

const TEMP_DIR = "/tmp/video-worker-local";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(process, "exit").mockReturnValue(undefined as never);
  mockCreateLogger.mockReturnValue(mockLogger);
  mockCreateRenderVideo.mockReturnValue(vi.fn());
  mockCreateTempDir.mockReturnValue(okAsync(TEMP_DIR));
  mockCleanupTempDir.mockReturnValue(okAsync(undefined));
  mockRenderWorkflow.mockReturnValue(okAsync("/path/to/output.mp4"));
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ============================================
// Helper — run main() with given argv
// ============================================

const runMain = async (args: string[]) => {
  const savedArgv = process.argv;
  process.argv = ["node", "local.ts", ...args];
  const { main } = await import("./local");
  await main();
  process.argv = savedArgv;
};

// ============================================
// CLI argument validation
// ============================================

describe("local.ts main() — argument validation (commander)", () => {
  it("exits with code 1 when --script is missing", async () => {
    await runMain([
      "--audio",
      "/path/audio.wav",
      "--output",
      "/path/output.mp4",
    ]);

    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("exits with code 1 when --audio is missing", async () => {
    await runMain([
      "--script",
      "/path/script.json",
      "--output",
      "/path/output.mp4",
    ]);

    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("exits with code 1 when --output is missing", async () => {
    await runMain([
      "--script",
      "/path/script.json",
      "--audio",
      "/path/audio.wav",
    ]);

    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("exits with code 1 when no arguments are provided", async () => {
    await runMain([]);

    expect(process.exit).toHaveBeenCalledWith(1);
  });
});

// ============================================
// Successful execution
// ============================================

describe("local.ts main() — successful execution", () => {
  it("does not exit when all arguments are provided and workflow succeeds", async () => {
    await runMain([
      "--script",
      "/path/script.json",
      "--audio",
      "/path/audio.wav",
      "--output",
      "/path/output.mp4",
    ]);

    expect(process.exit).not.toHaveBeenCalledWith(1);
  });

  it("calls createRenderVideoWorkflow with the correct paths", async () => {
    await runMain([
      "--script",
      "/path/script.json",
      "--audio",
      "/path/audio.wav",
      "--output",
      "/path/output.mp4",
    ]);

    expect(mockRenderWorkflow).toHaveBeenCalledWith(
      "/path/script.json",
      "/path/audio.wav",
      "/path/output.mp4",
    );
  });
});

// ============================================
// Error handling
// ============================================

describe("local.ts main() — error handling", () => {
  it("exits with code 1 when renderWorkflow returns an error", async () => {
    mockRenderWorkflow.mockReturnValue(errAsync(videoServiceError));

    await runMain([
      "--script",
      "/path/script.json",
      "--audio",
      "/path/audio.wav",
      "--output",
      "/path/output.mp4",
    ]);

    expect(process.exit).toHaveBeenCalledWith(1);
  });
});

// ============================================
// No auto-execution guard
// ============================================

describe("local.ts — no execution guard", () => {
  it("exports main() as a regular function without side effects on module load", async () => {
    const mod = await import("./local");

    expect(typeof mod.main).toBe("function");
    expect(process.exit).not.toHaveBeenCalled();
  });
});
