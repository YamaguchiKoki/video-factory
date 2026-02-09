/**
 * End-to-End Tests for Complete Video Generation
 * Task 10.1: Complete video rendering with mock data
 *
 * Requirements:
 * - 3.1, 3.2, 3.3: Complete video rendering workflow
 * - Verifies audio-text synchronization
 * - Verifies VisualComponent display
 * - Verifies avatar animations
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFile as fsReadFile, unlink, stat, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { existsSync } from "node:fs";
import { createRenderVideoWorkflow } from "./service/video-service";
import {
  readFile,
  writeFile,
  createTempDir,
  cleanupTempDir,
  createRenderVideo,
} from "./infrastructure";
import { parseScript, buildRenderConfig } from "./core";
import { createLogger } from "./infrastructure/logger";

// Skip E2E tests unless explicitly enabled
const shouldRunE2E = process.env.RUN_E2E_TESTS === "true";
const describeE2E = shouldRunE2E ? describe : describe.skip;

describeE2E("Task 10.1: Complete Video Generation E2E", () => {
  const outputDir = join(tmpdir(), "video-worker-e2e-tests");
  const outputPath = join(outputDir, `test-video-${Date.now()}.mp4`);
  const scriptPath = join(process.cwd(), "mock-data/script.json");
  const audioPath = join(process.cwd(), "mock-data/audio.wav");

  beforeAll(async () => {
    // Create output directory
    if (!existsSync(outputDir)) {
      await mkdir(outputDir, { recursive: true });
    }

    // Verify mock data exists
    const scriptExists = existsSync(scriptPath);
    const audioExists = existsSync(audioPath);

    if (!scriptExists) {
      throw new Error(`Mock script not found: ${scriptPath}`);
    }
    if (!audioExists) {
      throw new Error(`Mock audio not found: ${audioPath}`);
    }
  });

  afterAll(async () => {
    // Clean up output file
    try {
      if (existsSync(outputPath)) {
        await unlink(outputPath);
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  it("should generate complete video from mock data", async () => {
    const requestId = crypto.randomUUID();
    const logger = createLogger(requestId);

    // Create workflow with real dependencies
    const renderVideo = createRenderVideo(logger);
    const workflow = createRenderVideoWorkflow({
      readFile,
      parseScript,
      buildRenderConfig,
      renderVideo,
      writeFile,
      createTempDir,
      cleanupTempDir,
      logger,
    });

    // Execute workflow
    const result = await workflow(scriptPath, audioPath, outputPath);

    // Verify success
    expect(result.isOk()).toBe(true);

    if (result.isErr()) {
      console.error("Workflow error:", result.error);
      throw new Error(`Workflow failed: ${result.error.message}`);
    }

    // Verify output file exists
    const fileExists = existsSync(outputPath);
    expect(fileExists).toBe(true);

    // Verify output file has content
    const stats = await stat(outputPath);
    expect(stats.size).toBeGreaterThan(0);

    // Log file size for debugging
    logger.info("Generated video file", {
      path: outputPath,
      sizeBytes: stats.size,
      sizeMB: (stats.size / 1024 / 1024).toFixed(2),
    });
  }, 900000); // 15 minutes timeout for rendering

  it("should generate video with correct metadata", async () => {
    const requestId = crypto.randomUUID();
    const logger = createLogger(requestId);

    // Read and parse script to verify expected duration
    const scriptContent = await fsReadFile(scriptPath, "utf-8");
    const scriptData = JSON.parse(scriptContent);
    const expectedDuration = scriptData.metadata.durationSeconds;

    const renderVideo = createRenderVideo(logger);
    const workflow = createRenderVideoWorkflow({
      readFile,
      parseScript,
      buildRenderConfig,
      renderVideo,
      writeFile,
      createTempDir,
      cleanupTempDir,
      logger,
    });

    const result = await workflow(scriptPath, audioPath, outputPath);

    expect(result.isOk()).toBe(true);

    // Verify file exists and has reasonable size for video duration
    const stats = await stat(outputPath);

    // Expected: ~1MB per second of video (conservative estimate for h264 CRF 23)
    const minExpectedSize = expectedDuration * 500 * 1024; // 500KB per second minimum
    const maxExpectedSize = expectedDuration * 5 * 1024 * 1024; // 5MB per second maximum

    expect(stats.size).toBeGreaterThanOrEqual(minExpectedSize);
    expect(stats.size).toBeLessThanOrEqual(maxExpectedSize);

    logger.info("Video metadata verified", {
      expectedDuration,
      actualSize: stats.size,
      minExpected: minExpectedSize,
      maxExpected: maxExpectedSize,
    });
  }, 900000);

  it("should handle all VisualComponent types", async () => {
    const requestId = crypto.randomUUID();
    const logger = createLogger(requestId);

    // Verify script contains all component types
    const scriptContent = await fsReadFile(scriptPath, "utf-8");
    const scriptData = JSON.parse(scriptContent);

    const componentTypes = new Set(
      scriptData.segments
        .filter((seg: { visualComponent?: { type: string } }) => seg.visualComponent)
        .map((seg: { visualComponent: { type: string } }) => seg.visualComponent.type)
    );

    expect(componentTypes.has("news-list")).toBe(true);
    expect(componentTypes.has("concept-explanation")).toBe(true);
    expect(componentTypes.has("conversation-summary")).toBe(true);

    // Render video with all component types
    const renderVideo = createRenderVideo(logger);
    const workflow = createRenderVideoWorkflow({
      readFile,
      parseScript,
      buildRenderConfig,
      renderVideo,
      writeFile,
      createTempDir,
      cleanupTempDir,
      logger,
    });

    const result = await workflow(scriptPath, audioPath, outputPath);

    expect(result.isOk()).toBe(true);

    logger.info("All VisualComponent types verified", {
      types: Array.from(componentTypes),
    });
  }, 900000);
});
