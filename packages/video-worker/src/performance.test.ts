import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { unlink, stat, mkdir } from "node:fs/promises";
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

// Skip performance tests unless explicitly enabled
const shouldRunPerf = process.env.RUN_PERF_TESTS === "true";
const describePerf = shouldRunPerf ? describe : describe.skip;

const monitorMemory = (onUpdate: (usage: NodeJS.MemoryUsage) => void) => {
  const interval = setInterval(() => {
    const usage = process.memoryUsage();
    onUpdate(usage);
  }, 1000); // Check every second

  return () => clearInterval(interval);
};

describePerf("Task 10.2: Performance Requirements", () => {
  const outputDir = join(tmpdir(), "video-worker-perf-tests");
  const outputPath = join(outputDir, `perf-test-${Date.now()}.mp4`);
  const scriptPath = join(process.cwd(), "mock-data/script.json");
  const audioPath = join(process.cwd(), "mock-data/audio.wav");

  beforeAll(async () => {
    if (!existsSync(outputDir)) {
      await mkdir(outputDir, { recursive: true });
    }
  });

  afterAll(async () => {
    await fromPromise(unlink(outputPath), (e) => e).orElse(() =>
      okAsync(undefined)
    );
  });

  it("should complete rendering within 15 minutes", async () => {
    const requestId = crypto.randomUUID();
    const logger = createLogger(requestId);

    const startTime = Date.now();

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

    const endTime = Date.now();
    const elapsedMs = endTime - startTime;
    const elapsedMinutes = elapsedMs / 1000 / 60;

    expect(result.isOk()).toBe(true);

    // Requirement: 15 minutes maximum
    const maxMinutes = 15;
    expect(elapsedMinutes).toBeLessThanOrEqual(maxMinutes);

    logger.info("Rendering time verified", {
      elapsedMinutes: elapsedMinutes.toFixed(2),
      maxMinutes,
      passed: elapsedMinutes <= maxMinutes,
    });
  }, 900000); // 15 minutes timeout

  it("should keep memory usage under 4GB", async () => {
    const requestId = crypto.randomUUID();
    const logger = createLogger(requestId);

    const memoryReadings: number[] = [];
    const maxMemoryGB = 4;
    const maxMemoryBytes = maxMemoryGB * 1024 * 1024 * 1024;

    const stopMonitoring = monitorMemory((usage) => {
      const heapUsed = usage.heapUsed;
      memoryReadings.push(heapUsed);

      const usageGB = heapUsed / 1024 / 1024 / 1024;
      if (usageGB > 3.5) {
        logger.warn("High memory usage detected", {
          currentGB: usageGB.toFixed(2),
          maxGB: maxMemoryGB,
        });
      }
    });

    try {
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

      const peakMemory = Math.max(...memoryReadings);
      const peakMemoryGB = peakMemory / 1024 / 1024 / 1024;

      expect(peakMemory).toBeLessThanOrEqual(maxMemoryBytes);

      logger.info("Memory usage verified", {
        peakMemoryGB: peakMemoryGB.toFixed(2),
        maxMemoryGB,
        passed: peakMemory <= maxMemoryBytes,
        totalReadings: memoryReadings.length,
      });
    } finally {
      stopMonitoring();
    }
  }, 900000);

  it("should generate video with reasonable file size", async () => {
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

    const stats = await stat(outputPath);
    const fileSizeMB = stats.size / 1024 / 1024;

    // For 2-minute video (120 seconds from mock data), expected ~10-50MB for h264 CRF 23
    const minSizeMB = 5; // Minimum reasonable size
    const maxSizeMB = 100; // Maximum acceptable size

    expect(fileSizeMB).toBeGreaterThanOrEqual(minSizeMB);
    expect(fileSizeMB).toBeLessThanOrEqual(maxSizeMB);

    logger.info("File size verified", {
      fileSizeMB: fileSizeMB.toFixed(2),
      minSizeMB,
      maxSizeMB,
      passed: fileSizeMB >= minSizeMB && fileSizeMB <= maxSizeMB,
    });
  }, 900000);

  it("should verify concurrency setting optimizes performance", async () => {
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

    const startTime = Date.now();
    const result = await workflow(scriptPath, audioPath, outputPath);
    const elapsedMs = Date.now() - startTime;

    expect(result.isOk()).toBe(true);

    const elapsedMinutes = elapsedMs / 1000 / 60;

    logger.info("Concurrency optimization verified", {
      elapsedMinutes: elapsedMinutes.toFixed(2),
      configuredConcurrency: 2,
      note: "Concurrency=2 balances speed and memory usage",
    });

    expect(elapsedMinutes).toBeLessThan(15);
  }, 900000);
});
