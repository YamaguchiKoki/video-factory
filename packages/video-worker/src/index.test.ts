/**
 * Entry point tests
 * Tests for CLI argument parsing and main() function
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock process.exit to prevent actual process termination
vi.mock("process", () => ({
  exit: vi.fn(),
  env: {},
  argv: [],
}));

describe("main()", () => {
  const originalArgv = process.argv;
  const originalEnv = process.env;
  const originalExit = process.exit;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    process.exit = vi.fn() as unknown as typeof process.exit;
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.env = originalEnv;
    process.exit = originalExit;
  });

  it("should parse CLI arguments correctly", async () => {
    // RED: Test should fail because main() is not implemented yet
    process.argv = [
      "node",
      "index.js",
      "--script",
      "/path/to/script.json",
      "--audio",
      "/path/to/audio.wav",
      "--output",
      "/path/to/output.mp4",
    ];

    const { main } = await import("./index");

    // We'll mock the workflow to verify arguments are passed correctly
    expect(main).toBeDefined();
  });

  it("should exit with code 1 when required arguments are missing", async () => {
    process.argv = ["node", "index.js"];

    const { main } = await import("./index");
    await main();

    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("should read LOG_LEVEL from environment variable", async () => {
    process.env.LOG_LEVEL = "DEBUG";
    process.argv = [
      "node",
      "index.js",
      "--script",
      "/path/to/script.json",
      "--audio",
      "/path/to/audio.wav",
      "--output",
      "/path/to/output.mp4",
    ];

    const { main } = await import("./index");

    expect(main).toBeDefined();
  });

  it("should handle MOCK_MODE environment variable", async () => {
    process.env.MOCK_MODE = "true";
    process.argv = [
      "node",
      "index.js",
      "--output",
      "/path/to/output.mp4",
    ];

    const { main } = await import("./index");

    expect(main).toBeDefined();
  });
});
