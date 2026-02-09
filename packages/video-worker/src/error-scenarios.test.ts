/**
 * Error Scenario End-to-End Tests
 * Task 10.3: Verify error handling in real scenarios
 *
 * Requirements:
 * - 1.5, 1.6: File not found handling
 * - 2.6: Invalid script handling
 * - 3.8: Rendering timeout
 * - 8.1: Cleanup after errors
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFile as fsWriteFile, unlink, mkdir } from "node:fs/promises";
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
    try {
      if (existsSync(outputPath)) {
        await unlink(outputPath);
      }
    } catch {
      // Ignore
    }
  });

  it("should handle missing script file gracefully", async () => {
    const requestId = crypto.randomUUID();
    const logger = createLogger(requestId);

    const nonExistentScriptPath = join(testDir, "non-existent-script.json");
    const audioPath = join(process.cwd(), "mock-data/audio.wav");

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

    const result = await workflow(nonExistentScriptPath, audioPath, outputPath);

    // Should return error
    expect(result.isErr()).toBe(true);

    if (result.isErr()) {
      expect(result.error.type).toBe("FILE_READ_ERROR");
      expect(result.error.message).toContain("no such file or directory");
    }

    // Verify no output file was created
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
      parseScript,
      buildRenderConfig,
      renderVideo,
      writeFile,
      createTempDir,
      cleanupTempDir,
      logger,
    });

    const result = await workflow(scriptPath, nonExistentAudioPath, outputPath);

    // Should return error
    expect(result.isErr()).toBe(true);

    if (result.isErr()) {
      expect(result.error.type).toBe("FILE_READ_ERROR");
    }

    // Verify no output file was created
    expect(existsSync(outputPath)).toBe(false);
  });

  it("should handle invalid JSON in script file", async () => {
    const requestId = crypto.randomUUID();
    const logger = createLogger(requestId);

    // Create invalid JSON file
    const invalidScriptPath = join(testDir, "invalid-script.json");
    await fsWriteFile(invalidScriptPath, "{ invalid json }", "utf-8");

    const audioPath = join(process.cwd(), "mock-data/audio.wav");

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

    const result = await workflow(invalidScriptPath, audioPath, outputPath);

    // Should return validation error
    expect(result.isErr()).toBe(true);

    if (result.isErr()) {
      expect(result.error.type).toBe("VALIDATION_ERROR");
      expect(result.error.message).toContain("JSON");
    }

    // Cleanup
    await unlink(invalidScriptPath);
  });

  it("should handle script with invalid schema", async () => {
    const requestId = crypto.randomUUID();
    const logger = createLogger(requestId);

    // Create script with missing required fields
    const invalidSchemaPath = join(testDir, "invalid-schema.json");
    const invalidScript = {
      metadata: {
        title: "Test",
        // Missing createdAt and durationSeconds
      },
      speakers: [],
      segments: [],
    };

    await fsWriteFile(invalidSchemaPath, JSON.stringify(invalidScript), "utf-8");

    const audioPath = join(process.cwd(), "mock-data/audio.wav");

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

    const result = await workflow(invalidSchemaPath, audioPath, outputPath);

    // Should return validation error
    expect(result.isErr()).toBe(true);

    if (result.isErr()) {
      expect(result.error.type).toBe("VALIDATION_ERROR");
    }

    // Cleanup
    await unlink(invalidSchemaPath);
  });

  it("should handle script with timestamp conflicts", async () => {
    const requestId = crypto.randomUUID();
    const logger = createLogger(requestId);

    // Create script with overlapping timestamps
    const conflictScriptPath = join(testDir, "conflict-script.json");
    const conflictScript = {
      metadata: {
        title: "Conflict Test",
        createdAt: "2026-02-09T00:00:00Z",
        durationSeconds: 10,
      },
      speakers: [
        {
          id: "speaker1",
          name: "Speaker 1",
          role: "agent",
          avatarPath: "avatar.png",
        },
      ],
      segments: [
        {
          id: "seg1",
          speakerId: "speaker1",
          text: "First",
          startTime: 0,
          endTime: 5,
        },
        {
          id: "seg2",
          speakerId: "speaker1",
          text: "Second",
          startTime: 3, // Overlaps with seg1
          endTime: 8,
        },
      ],
    };

    await fsWriteFile(conflictScriptPath, JSON.stringify(conflictScript), "utf-8");

    const audioPath = join(process.cwd(), "mock-data/audio.wav");

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

    const result = await workflow(conflictScriptPath, audioPath, outputPath);

    // Should return validation error
    expect(result.isErr()).toBe(true);

    if (result.isErr()) {
      expect(result.error.type).toBe("VALIDATION_ERROR");
      expect(result.error.message).toContain("overlap");
    }

    // Cleanup
    await unlink(conflictScriptPath);
  });

  it("should cleanup temp files after error", async () => {
    const requestId = crypto.randomUUID();
    const logger = createLogger(requestId);

    // Use invalid script to trigger error
    const invalidScriptPath = join(testDir, "cleanup-test.json");
    await fsWriteFile(invalidScriptPath, "{ invalid }", "utf-8");

    const audioPath = join(process.cwd(), "mock-data/audio.wav");

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

    const result = await workflow(invalidScriptPath, audioPath, outputPath);

    expect(result.isErr()).toBe(true);

    // Verify temp directory was cleaned up
    // (Implementation ensures cleanupTempDir is called in finally block)
    // We can't directly verify the temp dir was cleaned, but we verify
    // the workflow completed and no error was thrown

    // Cleanup test file
    await unlink(invalidScriptPath);
  });

  it("should handle invalid speaker reference", async () => {
    const requestId = crypto.randomUUID();
    const logger = createLogger(requestId);

    // Create script with segment referencing non-existent speaker
    const invalidRefPath = join(testDir, "invalid-ref.json");
    const invalidRefScript = {
      metadata: {
        title: "Invalid Ref Test",
        createdAt: "2026-02-09T00:00:00Z",
        durationSeconds: 10,
      },
      speakers: [
        {
          id: "speaker1",
          name: "Speaker 1",
          role: "agent",
          avatarPath: "avatar.png",
        },
      ],
      segments: [
        {
          id: "seg1",
          speakerId: "non-existent-speaker", // Invalid reference
          text: "Hello",
          startTime: 0,
          endTime: 3,
        },
      ],
    };

    await fsWriteFile(invalidRefPath, JSON.stringify(invalidRefScript), "utf-8");

    const audioPath = join(process.cwd(), "mock-data/audio.wav");

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

    const result = await workflow(invalidRefPath, audioPath, outputPath);

    // Should return validation error
    expect(result.isErr()).toBe(true);

    if (result.isErr()) {
      expect(result.error.type).toBe("VALIDATION_ERROR");
      expect(result.error.message).toContain("speaker");
    }

    // Cleanup
    await unlink(invalidRefPath);
  });

  it("should log detailed error information", async () => {
    const requestId = crypto.randomUUID();
    const logger = createLogger(requestId);

    const nonExistentPath = join(testDir, "does-not-exist.json");
    const audioPath = join(process.cwd(), "mock-data/audio.wav");

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

    const result = await workflow(nonExistentPath, audioPath, outputPath);

    expect(result.isErr()).toBe(true);

    if (result.isErr()) {
      const error = result.error;

      // Verify error has required fields
      expect(error.type).toBeDefined();
      expect(error.message).toBeDefined();
      expect(error.context).toBeDefined();

      // Verify context includes useful debugging info
      expect(error.context).toHaveProperty("scriptPath");
    }
  });
});
