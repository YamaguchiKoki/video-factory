/**
 * End-to-end tests for CLI entry point
 * Tests complete video generation flow with mock data
 */

import { describe, it, expect, afterAll } from "vitest";
import { readFile as fsReadFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Skip E2E tests unless explicitly enabled
const shouldRunE2E = process.env.RUN_E2E_TESTS === "true";
const describeE2E = shouldRunE2E ? describe : describe.skip;

describeE2E("CLI End-to-End Tests", () => {
  const outputPath = join(tmpdir(), `test-output-${Date.now()}.mp4`);

  afterAll(async () => {
    // Clean up output file
    try {
      await unlink(outputPath);
    } catch {
      // Ignore if file doesn't exist
    }
  });

  it("should generate video with mock data", async () => {
    // This test requires the mock data files to exist
    // and will actually run the Remotion renderer

    // Set environment variables
    process.env.MOCK_MODE = "true";
    process.env.LOG_LEVEL = "INFO";

    // Import main function
    const { main } = await import("./entrypoints/local");

    // Override process.argv
    const originalArgv = process.argv;
    const originalExit = process.exit;

    process.argv = [
      "node",
      "index.js",
      "--output",
      outputPath,
    ];

    // Mock process.exit to capture exit code
    const exitCodes: number[] = [];
    process.exit = ((code: number) => {
      exitCodes.push(code);
      // Don't actually exit
    }) as typeof process.exit;

    try {
      await main();

      // Verify exit code
      expect(exitCodes).toContain(0);

      // Verify output file was created
      const outputExists = await fsReadFile(outputPath)
        .then(() => true)
        .catch(() => false);

      expect(outputExists).toBe(true);

      if (outputExists) {
        const stats = await fsReadFile(outputPath);
        expect(stats.length).toBeGreaterThan(0);
      }
    } finally {
      // Restore original values
      process.argv = originalArgv;
      process.exit = originalExit;
    }
  }, 120000); // 2 minutes timeout for video rendering

  it("should fail with exit code 1 when output path is missing", async () => {
    const { main } = await import("./entrypoints/local");

    const originalArgv = process.argv;
    const originalExit = process.exit;

    process.argv = ["node", "index.js"]; // No arguments

    const exitCodes: number[] = [];
    process.exit = ((code: number) => {
      exitCodes.push(code);
    }) as typeof process.exit;

    const consoleErrors: string[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      consoleErrors.push(args.map(String).join(" "));
    };

    try {
      await main();

      expect(exitCodes).toContain(1);
      expect(consoleErrors.some((msg) => msg.includes("required"))).toBe(true);
    } finally {
      process.argv = originalArgv;
      process.exit = originalExit;
      console.error = originalError;
    }
  });
});
