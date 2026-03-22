import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFile as fsReadFile, unlink, stat, mkdir } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { existsSync } from "node:fs";
import { fromPromise, okAsync } from "neverthrow";
import { createRenderVideoWorkflow } from "./service/video-service";
import {
  readFile,
  writeFile,
  createTempDir,
  cleanupTempDir,
  createRenderVideo,
  bundleComposition,
} from "./infrastructure";
import { parseEnrichedScript } from "./core/enriched-parser";
import { createLogger } from "./infrastructure/logger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const entryPoint = resolve(__dirname, "remotion/index.ts");

// Skip E2E tests unless explicitly enabled
const shouldRunE2E = process.env.RUN_E2E_TESTS === "true";
const describeE2E = shouldRunE2E ? describe : describe.skip;

describeE2E("Task 10.1: Complete Video Generation E2E", () => {
  const outputDir = join(tmpdir(), "video-worker-e2e-tests");
  const outputPath = join(outputDir, `test-video-${Date.now()}.mp4`);
  const scriptPath = join(process.cwd(), "mock-data/script.json");
  const audioPath = join(process.cwd(), "mock-data/audio.wav");

  beforeAll(async () => {
    if (!existsSync(outputDir)) {
      await mkdir(outputDir, { recursive: true });
    }

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
    await fromPromise(unlink(outputPath), (e) => e).orElse(() =>
      okAsync(undefined)
    );
  });

  it("should generate complete video from mock data", async () => {
    const requestId = crypto.randomUUID();
    const logger = createLogger(requestId);

    const renderVideo = createRenderVideo(logger);
    const workflow = createRenderVideoWorkflow({
      readFile,
      parseEnrichedScript,
      bundleComposition,
      renderVideo,
      writeFile,
      createTempDir,
      cleanupTempDir,
      logger,
      entryPoint,
    });

    const result = await workflow(scriptPath, audioPath, outputPath);

    expect(result.isOk()).toBe(true);

    if (result.isErr()) {
      console.error("Workflow error:", result.error);
      throw new Error(`Workflow failed: ${result.error.message}`);
    }

    const fileExists = existsSync(outputPath);
    expect(fileExists).toBe(true);

    const stats = await stat(outputPath);
    expect(stats.size).toBeGreaterThan(0);

    logger.info("Generated video file", {
      path: outputPath,
      sizeBytes: stats.size,
      sizeMB: (stats.size / 1024 / 1024).toFixed(2),
    });
  }, 900000); // 15 minutes timeout for rendering

  it("should generate video with correct metadata", async () => {
    const requestId = crypto.randomUUID();
    const logger = createLogger(requestId);

    const scriptContent = await fsReadFile(scriptPath, "utf-8");
    const scriptData = JSON.parse(scriptContent);
    const expectedDuration = scriptData.totalDurationSec;

    const renderVideo = createRenderVideo(logger);
    const workflow = createRenderVideoWorkflow({
      readFile,
      parseEnrichedScript,
      bundleComposition,
      renderVideo,
      writeFile,
      createTempDir,
      cleanupTempDir,
      logger,
      entryPoint,
    });

    const result = await workflow(scriptPath, audioPath, outputPath);

    expect(result.isOk()).toBe(true);

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

  it("should handle all section types", async () => {
    const requestId = crypto.randomUUID();
    const logger = createLogger(requestId);

    const scriptContent = await fsReadFile(scriptPath, "utf-8");
    const scriptData = JSON.parse(scriptContent);

    const sectionTypes = new Set(
      (scriptData.sections as Array<{ type: string }>).map((s) => s.type)
    );

    expect(sectionTypes.has("intro")).toBe(true);
    expect(sectionTypes.has("discussion")).toBe(true);
    expect(sectionTypes.has("outro")).toBe(true);

    const renderVideo = createRenderVideo(logger);
    const workflow = createRenderVideoWorkflow({
      readFile,
      parseEnrichedScript,
      bundleComposition,
      renderVideo,
      writeFile,
      createTempDir,
      cleanupTempDir,
      logger,
      entryPoint,
    });

    const result = await workflow(scriptPath, audioPath, outputPath);

    expect(result.isOk()).toBe(true);

    logger.info("All section types verified", {
      types: Array.from(sectionTypes),
    });
  }, 900000);
});
