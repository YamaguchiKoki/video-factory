/**
 * VideoService Tests
 * Tests for the video rendering workflow orchestration
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { err, errAsync, ok, okAsync } from "neverthrow";
import { createFileSystemError, createValidationError, createRenderError } from "../core/errors";
import type { ParsedScript } from "../core/script-types";
import type { RenderConfig } from "../core/render-config";
import { createRenderVideoWorkflow, type RenderVideoWorkflowDeps } from "./video-service";

describe("renderVideoWorkflow", () => {
  // Mock dependencies
  const mockDeps = (): RenderVideoWorkflowDeps => ({
    readFile: vi.fn(),
    parseScript: vi.fn(),
    buildRenderConfig: vi.fn(),
    renderVideo: vi.fn(),
    writeFile: vi.fn(),
    createTempDir: vi.fn(),
    cleanupTempDir: vi.fn(),
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  });

  const validScript: ParsedScript = {
    metadata: {
      title: "Test Video",
      createdAt: "2026-02-09T00:00:00Z",
      durationSeconds: 10,
    },
    speakers: [
      { id: "speaker1", name: "Agent", role: "agent", avatarPath: "avatar1.png" },
    ],
    segments: [
      { id: "seg1", speakerId: "speaker1", text: "Hello", startTime: 0, endTime: 3 },
    ],
  };

  const validRenderConfig: RenderConfig = {
    composition: {
      id: "RadioVideo",
      width: 1920,
      height: 1080,
      fps: 30,
      durationInFrames: 300,
    },
    inputProps: {
      audioPath: "/tmp/audio.wav",
      segments: validScript.segments,
      speakers: validScript.speakers,
    },
    codec: "h264",
    crf: 23,
    imageFormat: "jpeg",
    timeoutInMilliseconds: 900000,
    concurrency: 2,
    enableMultiProcessOnLinux: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("successful workflow", () => {
    it("should complete all steps and return output path", async () => {
      const deps = mockDeps();
      const scriptPath = "/input/script.json";
      const audioPath = "/input/audio.wav";
      const outputPath = "/output/video.mp4";

      // Setup successful mock responses
      vi.mocked(deps.createTempDir).mockReturnValue(okAsync("/tmp/video-worker-123"));
      vi.mocked(deps.readFile).mockReturnValue(okAsync(Buffer.from('{"test": "data"}')));
      vi.mocked(deps.parseScript).mockReturnValue(ok(validScript));
      vi.mocked(deps.buildRenderConfig).mockReturnValue(ok(validRenderConfig));
      vi.mocked(deps.renderVideo).mockReturnValue(okAsync("/tmp/rendered.mp4"));
      vi.mocked(deps.writeFile).mockReturnValue(okAsync(undefined));
      vi.mocked(deps.cleanupTempDir).mockReturnValue(okAsync(undefined));

      const renderWorkflow = createRenderVideoWorkflow(deps);
      const result = await renderWorkflow(scriptPath, audioPath, outputPath);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe(outputPath);
      }

      // Verify all steps were called
      expect(deps.createTempDir).toHaveBeenCalledTimes(1);
      expect(deps.readFile).toHaveBeenCalledWith(scriptPath);
      expect(deps.parseScript).toHaveBeenCalled();
      expect(deps.buildRenderConfig).toHaveBeenCalled();
      expect(deps.renderVideo).toHaveBeenCalled();
      expect(deps.writeFile).toHaveBeenCalled();
      expect(deps.cleanupTempDir).toHaveBeenCalled();
    });

    it("should log start and completion times", async () => {
      const deps = mockDeps();
      const scriptPath = "/input/script.json";
      const audioPath = "/input/audio.wav";
      const outputPath = "/output/video.mp4";

      // Setup successful mock responses
      vi.mocked(deps.createTempDir).mockReturnValue(okAsync("/tmp/video-worker-123"));
      vi.mocked(deps.readFile).mockReturnValue(okAsync(Buffer.from('{"test": "data"}')));
      vi.mocked(deps.parseScript).mockReturnValue(ok(validScript));
      vi.mocked(deps.buildRenderConfig).mockReturnValue(ok(validRenderConfig));
      vi.mocked(deps.renderVideo).mockReturnValue(okAsync("/tmp/rendered.mp4"));
      vi.mocked(deps.writeFile).mockReturnValue(okAsync(undefined));
      vi.mocked(deps.cleanupTempDir).mockReturnValue(okAsync(undefined));

      const renderWorkflow = createRenderVideoWorkflow(deps);
      await renderWorkflow(scriptPath, audioPath, outputPath);

      expect(deps.logger.info).toHaveBeenCalledWith(
        expect.stringContaining("Starting video workflow"),
        expect.any(Object)
      );
      expect(deps.logger.info).toHaveBeenCalledWith(
        expect.stringContaining("Video workflow completed"),
        expect.objectContaining({
          outputPath,
          elapsedTime: expect.any(String),
        })
      );
    });
  });

  describe("error handling - file read failure", () => {
    it("should return early if script file read fails", async () => {
      const deps = mockDeps();
      const scriptPath = "/input/script.json";
      const audioPath = "/input/audio.wav";
      const outputPath = "/output/video.mp4";

      const fileError = createFileSystemError(
        "IO_ERROR",
        "File not found",
        null,
        { path: scriptPath }
      );

      vi.mocked(deps.createTempDir).mockReturnValue(okAsync("/tmp/video-worker-123"));
      vi.mocked(deps.readFile).mockReturnValue(errAsync(fileError));
      vi.mocked(deps.cleanupTempDir).mockReturnValue(okAsync(undefined));

      const renderWorkflow = createRenderVideoWorkflow(deps);
      const result = await renderWorkflow(scriptPath, audioPath, outputPath);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("FILE_READ_ERROR");
      }

      // Verify cleanup was called despite error
      expect(deps.cleanupTempDir).toHaveBeenCalled();
      // Verify subsequent steps were not called
      expect(deps.parseScript).not.toHaveBeenCalled();
      expect(deps.renderVideo).not.toHaveBeenCalled();
    });
  });

  describe("error handling - script validation failure", () => {
    it("should return early if script validation fails", async () => {
      const deps = mockDeps();
      const scriptPath = "/input/script.json";
      const audioPath = "/input/audio.wav";
      const outputPath = "/output/video.mp4";

      const validationError = createValidationError(
        "SCHEMA_VALIDATION_ERROR",
        "Invalid schema",
        null,
        { fieldPath: "metadata" }
      );

      vi.mocked(deps.createTempDir).mockReturnValue(okAsync("/tmp/video-worker-123"));
      vi.mocked(deps.readFile).mockReturnValue(okAsync(Buffer.from('{"test": "data"}')));
      vi.mocked(deps.parseScript).mockReturnValue(err(validationError));
      vi.mocked(deps.cleanupTempDir).mockReturnValue(okAsync(undefined));

      const renderWorkflow = createRenderVideoWorkflow(deps);
      const result = await renderWorkflow(scriptPath, audioPath, outputPath);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("VALIDATION_ERROR");
      }

      expect(deps.cleanupTempDir).toHaveBeenCalled();
      expect(deps.renderVideo).not.toHaveBeenCalled();
    });
  });

  describe("error handling - render failure", () => {
    it("should return error if render fails", async () => {
      const deps = mockDeps();
      const scriptPath = "/input/script.json";
      const audioPath = "/input/audio.wav";
      const outputPath = "/output/video.mp4";

      const renderError = createRenderError(
        "RENDER_FAILED",
        "Rendering failed",
        null,
        { frameNumber: 100 }
      );

      vi.mocked(deps.createTempDir).mockReturnValue(okAsync("/tmp/video-worker-123"));
      vi.mocked(deps.readFile).mockReturnValue(okAsync(Buffer.from('{"test": "data"}')));
      vi.mocked(deps.parseScript).mockReturnValue(ok(validScript));
      vi.mocked(deps.buildRenderConfig).mockReturnValue(ok(validRenderConfig));
      vi.mocked(deps.renderVideo).mockReturnValue(errAsync(renderError));
      vi.mocked(deps.cleanupTempDir).mockReturnValue(okAsync(undefined));

      const renderWorkflow = createRenderVideoWorkflow(deps);
      const result = await renderWorkflow(scriptPath, audioPath, outputPath);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("RENDER_ERROR");
      }

      expect(deps.cleanupTempDir).toHaveBeenCalled();
    });
  });

  describe("cleanup guarantee", () => {
    it("should cleanup temp directory even on failure", async () => {
      const deps = mockDeps();
      const scriptPath = "/input/script.json";
      const audioPath = "/input/audio.wav";
      const outputPath = "/output/video.mp4";

      const tempDir = "/tmp/video-worker-123";

      vi.mocked(deps.createTempDir).mockReturnValue(okAsync(tempDir));
      vi.mocked(deps.readFile).mockReturnValue(
        errAsync(createFileSystemError("IO_ERROR", "Read failed", null, {}))
      );
      vi.mocked(deps.cleanupTempDir).mockReturnValue(okAsync(undefined));

      const renderWorkflow = createRenderVideoWorkflow(deps);
      await renderWorkflow(scriptPath, audioPath, outputPath);

      expect(deps.cleanupTempDir).toHaveBeenCalledWith(tempDir);
    });

    it("should cleanup temp directory on success", async () => {
      const deps = mockDeps();
      const scriptPath = "/input/script.json";
      const audioPath = "/input/audio.wav";
      const outputPath = "/output/video.mp4";

      const tempDir = "/tmp/video-worker-123";

      vi.mocked(deps.createTempDir).mockReturnValue(okAsync(tempDir));
      vi.mocked(deps.readFile).mockReturnValue(okAsync(Buffer.from('{"test": "data"}')));
      vi.mocked(deps.parseScript).mockReturnValue(ok(validScript));
      vi.mocked(deps.buildRenderConfig).mockReturnValue(ok(validRenderConfig));
      vi.mocked(deps.renderVideo).mockReturnValue(okAsync("/tmp/rendered.mp4"));
      vi.mocked(deps.writeFile).mockReturnValue(okAsync(undefined));
      vi.mocked(deps.cleanupTempDir).mockReturnValue(okAsync(undefined));

      const renderWorkflow = createRenderVideoWorkflow(deps);
      await renderWorkflow(scriptPath, audioPath, outputPath);

      expect(deps.cleanupTempDir).toHaveBeenCalledWith(tempDir);
    });
  });
});
