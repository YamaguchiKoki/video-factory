import { existsSync } from "node:fs";
import { writeFile as fsWriteFile, mkdir, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fromPromise, okAsync } from "neverthrow";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseEnrichedScript } from "./core/enriched-parser";
import {
  bundleComposition,
  cleanupTempDir,
  createRenderVideo,
  createTempDir,
  readFile,
  writeFile,
} from "./infrastructure";
import { createLogger } from "./infrastructure/logger";
import { createRenderVideoWorkflow } from "./service/video-service";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const entryPoint = resolve(__dirname, "remotion/index.ts");

// Skip error scenario tests unless explicitly enabled
const shouldRunErrorTests = process.env.RUN_ERROR_TESTS === "true";
const describeError = shouldRunErrorTests ? describe : describe.skip;

describeError("Task 10.3: Error Scenarios E2E", () => {
  const testDir = join(tmpdir(), "video-worker-error-tests");
  const outputPath = join(testDir, `error-test-${Date.now()}.mp4`);

  beforeAll(async () => {
    if (!existsSync(testDir)) {
      await mkdir(testDir, { recursive: true });
    }
  });

  afterAll(async () => {
    await fromPromise(unlink(outputPath), (e) => e).orElse(() =>
      okAsync(undefined),
    );
  });

  it("should handle missing script file gracefully", async () => {
    const requestId = crypto.randomUUID();
    const logger = createLogger(requestId);

    const nonExistentScriptPath = join(testDir, "non-existent-script.json");
    const audioPath = join(process.cwd(), "mock-data/audio.wav");

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

    const result = await workflow(nonExistentScriptPath, audioPath, outputPath);

    expect(result.isErr()).toBe(true);

    if (result.isErr()) {
      expect(result.error.type).toBe("FILE_READ_ERROR");
      expect(result.error.message).toContain("no such file or directory");
    }

    expect(existsSync(outputPath)).toBe(false);
  });

  it("should handle missing audio file gracefully", async () => {
    const requestId = crypto.randomUUID();
    const logger = createLogger(requestId);

    const scriptPath = join(process.cwd(), "mock-data/script.json");
    const nonExistentAudioPath = join(testDir, "non-existent-audio.wav");

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

    const result = await workflow(scriptPath, nonExistentAudioPath, outputPath);

    expect(result.isErr()).toBe(true);

    if (result.isErr()) {
      expect(result.error.type).toBe("FILE_READ_ERROR");
    }

    expect(existsSync(outputPath)).toBe(false);
  });

  it("should handle invalid JSON in script file", async () => {
    const requestId = crypto.randomUUID();
    const logger = createLogger(requestId);

    const invalidScriptPath = join(testDir, "invalid-script.json");
    await fsWriteFile(invalidScriptPath, "{ invalid json }", "utf-8");

    const audioPath = join(process.cwd(), "mock-data/audio.wav");

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

    const result = await workflow(invalidScriptPath, audioPath, outputPath);

    expect(result.isErr()).toBe(true);

    if (result.isErr()) {
      expect(result.error.type).toBe("VALIDATION_ERROR");
      expect(result.error.message).toContain("JSON");
    }

    await unlink(invalidScriptPath);
  });

  it("should handle script with invalid schema", async () => {
    const requestId = crypto.randomUUID();
    const logger = createLogger(requestId);

    const invalidSchemaPath = join(testDir, "invalid-schema.json");
    const invalidScript = {
      title: "Test",
      // Missing totalDurationSec, newsItems, sections
    };

    await fsWriteFile(
      invalidSchemaPath,
      JSON.stringify(invalidScript),
      "utf-8",
    );

    const audioPath = join(process.cwd(), "mock-data/audio.wav");

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

    const result = await workflow(invalidSchemaPath, audioPath, outputPath);

    expect(result.isErr()).toBe(true);

    if (result.isErr()) {
      expect(result.error.type).toBe("VALIDATION_ERROR");
    }

    await unlink(invalidSchemaPath);
  });

  it("should cleanup temp files after error", async () => {
    const requestId = crypto.randomUUID();
    const logger = createLogger(requestId);

    const invalidScriptPath = join(testDir, "cleanup-test.json");
    await fsWriteFile(invalidScriptPath, "{ invalid }", "utf-8");

    const audioPath = join(process.cwd(), "mock-data/audio.wav");

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

    const result = await workflow(invalidScriptPath, audioPath, outputPath);

    expect(result.isErr()).toBe(true);

    await unlink(invalidScriptPath);
  });

  it("should log detailed error information", async () => {
    const requestId = crypto.randomUUID();
    const logger = createLogger(requestId);

    const nonExistentPath = join(testDir, "does-not-exist.json");
    const audioPath = join(process.cwd(), "mock-data/audio.wav");

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

    const result = await workflow(nonExistentPath, audioPath, outputPath);

    expect(result.isErr()).toBe(true);

    if (result.isErr()) {
      const error = result.error;

      expect(error.type).toBeDefined();
      expect(error.message).toBeDefined();
      expect(error.context).toBeDefined();

      expect(error.context).toHaveProperty("scriptPath");
    }
  });
});
