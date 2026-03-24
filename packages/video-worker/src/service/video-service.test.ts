import { describe, it, expect, vi, beforeEach } from "vitest";
import { err, errAsync, ok, okAsync } from "neverthrow";
import { createFileSystemError, createValidationError, createRenderError } from "../core/errors";
import type { VideoProps } from "../schema/schema";
import { createRenderVideoWorkflow, type RenderVideoWorkflowDeps } from "./video-service";

describe("renderVideoWorkflow", () => {
  const mockDeps = (): RenderVideoWorkflowDeps => ({
    readFile: vi.fn(),
    parseEnrichedScript: vi.fn(),
    bundleComposition: vi.fn(),
    renderVideo: vi.fn(),
    downloadFromS3: vi.fn(),
    uploadToS3: vi.fn(),
    createTempDir: vi.fn(),
    cleanupTempDir: vi.fn(),
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    entryPoint: "/app/src/remotion/index.ts",
  });

  const validVideoProps: VideoProps = {
    title: "テストビデオ",
    totalDurationSec: 30.0,
    newsItems: [{ id: "news-1", title: "ニュース1" }],
    lines: [
      {
        speaker: "A",
        text: "こんにちは",
        audioPath: "/input/audio.wav",
        startSec: 0,
        durationSec: 3.0,
      },
    ],
    sectionMarkers: [
      {
        type: "intro",
        startSec: 0,
        endSec: 3.0,
        agenda: [{ id: "news-1", title: "ニュース1" }],
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("successful workflow", () => {
    it("should complete all steps and return output key", async () => {
      const deps = mockDeps();
      const scriptKey = "tts-worker/script.json";
      const audioKey = "tts-worker/audio.wav";
      const outputKey = "/output/video.mp4";

      vi.mocked(deps.createTempDir).mockReturnValue(okAsync("/tmp/video-worker-123"));
      vi.mocked(deps.downloadFromS3).mockReturnValue(okAsync(undefined));
      vi.mocked(deps.readFile).mockReturnValue(okAsync(Buffer.from('{"test": "data"}')));
      vi.mocked(deps.parseEnrichedScript).mockReturnValue(ok(validVideoProps));
      vi.mocked(deps.bundleComposition).mockReturnValue(
        okAsync("http://localhost:3000/bundle"),
      );
      vi.mocked(deps.renderVideo).mockReturnValue(okAsync("/tmp/rendered.mp4"));
      vi.mocked(deps.uploadToS3).mockReturnValue(okAsync(undefined));
      vi.mocked(deps.cleanupTempDir).mockReturnValue(okAsync(undefined));

      const renderWorkflow = createRenderVideoWorkflow(deps);
      const result = await renderWorkflow(scriptKey, audioKey, outputKey);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe(outputKey);
      }

      expect(deps.createTempDir).toHaveBeenCalledTimes(1);
      expect(deps.downloadFromS3).toHaveBeenCalledTimes(2);
      expect(deps.readFile).toHaveBeenCalledWith(expect.any(String));
      expect(deps.parseEnrichedScript).toHaveBeenCalledWith(expect.any(String), "audio.wav");
      expect(deps.bundleComposition).toHaveBeenCalledWith(
        deps.entryPoint,
        expect.any(String),
      );
      expect(deps.renderVideo).toHaveBeenCalled();
      expect(deps.uploadToS3).toHaveBeenCalled();
      expect(deps.cleanupTempDir).toHaveBeenCalled();
    });

    it("renderVideo is called with TechNews composition id and bundle serveUrl", async () => {
      const deps = mockDeps();
      const bundleUrl = "http://localhost:3000/bundle";

      vi.mocked(deps.createTempDir).mockReturnValue(okAsync("/tmp/video-worker-123"));
      vi.mocked(deps.downloadFromS3).mockReturnValue(okAsync(undefined));
      vi.mocked(deps.readFile).mockReturnValue(okAsync(Buffer.from("{}")));
      vi.mocked(deps.parseEnrichedScript).mockReturnValue(ok(validVideoProps));
      vi.mocked(deps.bundleComposition).mockReturnValue(okAsync(bundleUrl));
      vi.mocked(deps.renderVideo).mockReturnValue(okAsync("/tmp/rendered.mp4"));
      vi.mocked(deps.uploadToS3).mockReturnValue(okAsync(undefined));
      vi.mocked(deps.cleanupTempDir).mockReturnValue(okAsync(undefined));

      const renderWorkflow = createRenderVideoWorkflow(deps);
      await renderWorkflow("script.json", "audio.wav", "/output/v.mp4");

      expect(deps.renderVideo).toHaveBeenCalledWith(
        expect.objectContaining({
          composition: expect.objectContaining({ id: "TechNews" }),
          serveUrl: bundleUrl,
        }),
      );
    });

    it("should log start and completion times", async () => {
      const deps = mockDeps();

      vi.mocked(deps.createTempDir).mockReturnValue(okAsync("/tmp/video-worker-123"));
      vi.mocked(deps.downloadFromS3).mockReturnValue(okAsync(undefined));
      vi.mocked(deps.readFile).mockReturnValue(okAsync(Buffer.from("{}")));
      vi.mocked(deps.parseEnrichedScript).mockReturnValue(ok(validVideoProps));
      vi.mocked(deps.bundleComposition).mockReturnValue(okAsync("http://localhost:3000/bundle"));
      vi.mocked(deps.renderVideo).mockReturnValue(okAsync("/tmp/rendered.mp4"));
      vi.mocked(deps.uploadToS3).mockReturnValue(okAsync(undefined));
      vi.mocked(deps.cleanupTempDir).mockReturnValue(okAsync(undefined));

      const renderWorkflow = createRenderVideoWorkflow(deps);
      await renderWorkflow("script.json", "audio.wav", "/output/v.mp4");

      expect(deps.logger.info).toHaveBeenCalledWith(
        expect.stringContaining("Starting video workflow"),
        expect.any(Object),
      );
      expect(deps.logger.info).toHaveBeenCalledWith(
        expect.stringContaining("Video workflow completed"),
        expect.objectContaining({
          outputPath: "/output/v.mp4",
          elapsedTime: expect.any(String),
        }),
      );
    });
  });

  describe("error handling - file read failure", () => {
    it("should return early if script file read fails", async () => {
      const deps = mockDeps();

      const fileError = createFileSystemError(
        "IO_ERROR",
        "File not found",
        null,
        { path: "/input/script.json" },
      );

      vi.mocked(deps.createTempDir).mockReturnValue(okAsync("/tmp/video-worker-123"));
      vi.mocked(deps.downloadFromS3).mockReturnValue(okAsync(undefined));
      vi.mocked(deps.readFile).mockReturnValue(errAsync(fileError));
      vi.mocked(deps.cleanupTempDir).mockReturnValue(okAsync(undefined));

      const renderWorkflow = createRenderVideoWorkflow(deps);
      const result = await renderWorkflow("script.json", "audio.wav", "/output/v.mp4");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("FILE_READ_ERROR");
      }

      expect(deps.cleanupTempDir).toHaveBeenCalled();
      expect(deps.parseEnrichedScript).not.toHaveBeenCalled();
      expect(deps.renderVideo).not.toHaveBeenCalled();
    });
  });

  describe("error handling - script validation failure", () => {
    it("should return early if parseEnrichedScript fails", async () => {
      const deps = mockDeps();

      const validationError = createValidationError(
        "SCHEMA_VALIDATION_ERROR",
        "Invalid schema",
        null,
        { fieldPath: "sections" },
      );

      vi.mocked(deps.createTempDir).mockReturnValue(okAsync("/tmp/video-worker-123"));
      vi.mocked(deps.downloadFromS3).mockReturnValue(okAsync(undefined));
      vi.mocked(deps.readFile).mockReturnValue(okAsync(Buffer.from("{}")));
      vi.mocked(deps.parseEnrichedScript).mockReturnValue(err(validationError));
      vi.mocked(deps.cleanupTempDir).mockReturnValue(okAsync(undefined));

      const renderWorkflow = createRenderVideoWorkflow(deps);
      const result = await renderWorkflow("script.json", "audio.wav", "/output/v.mp4");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("VALIDATION_ERROR");
      }

      expect(deps.cleanupTempDir).toHaveBeenCalled();
      expect(deps.bundleComposition).not.toHaveBeenCalled();
      expect(deps.renderVideo).not.toHaveBeenCalled();
    });
  });

  describe("error handling - bundle failure", () => {
    it("should return error if bundleComposition fails", async () => {
      const deps = mockDeps();

      const renderError = createRenderError(
        "RENDER_FAILED",
        "Webpack build failed",
        null,
        {},
      );

      vi.mocked(deps.createTempDir).mockReturnValue(okAsync("/tmp/video-worker-123"));
      vi.mocked(deps.downloadFromS3).mockReturnValue(okAsync(undefined));
      vi.mocked(deps.readFile).mockReturnValue(okAsync(Buffer.from("{}")));
      vi.mocked(deps.parseEnrichedScript).mockReturnValue(ok(validVideoProps));
      vi.mocked(deps.bundleComposition).mockReturnValue(errAsync(renderError));
      vi.mocked(deps.cleanupTempDir).mockReturnValue(okAsync(undefined));

      const renderWorkflow = createRenderVideoWorkflow(deps);
      const result = await renderWorkflow("script.json", "audio.wav", "/output/v.mp4");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("RENDER_ERROR");
      }

      expect(deps.cleanupTempDir).toHaveBeenCalled();
      expect(deps.renderVideo).not.toHaveBeenCalled();
    });
  });

  describe("error handling - render failure", () => {
    it("should return error if renderVideo fails", async () => {
      const deps = mockDeps();

      const renderError = createRenderError(
        "RENDER_FAILED",
        "Rendering failed",
        null,
        { frameNumber: 100 },
      );

      vi.mocked(deps.createTempDir).mockReturnValue(okAsync("/tmp/video-worker-123"));
      vi.mocked(deps.downloadFromS3).mockReturnValue(okAsync(undefined));
      vi.mocked(deps.readFile).mockReturnValue(okAsync(Buffer.from("{}")));
      vi.mocked(deps.parseEnrichedScript).mockReturnValue(ok(validVideoProps));
      vi.mocked(deps.bundleComposition).mockReturnValue(okAsync("http://localhost:3000/bundle"));
      vi.mocked(deps.renderVideo).mockReturnValue(errAsync(renderError));
      vi.mocked(deps.cleanupTempDir).mockReturnValue(okAsync(undefined));

      const renderWorkflow = createRenderVideoWorkflow(deps);
      const result = await renderWorkflow("script.json", "audio.wav", "/output/v.mp4");

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
      const tempDir = "/tmp/video-worker-123";

      vi.mocked(deps.createTempDir).mockReturnValue(okAsync(tempDir));
      vi.mocked(deps.downloadFromS3).mockReturnValue(okAsync(undefined));
      vi.mocked(deps.readFile).mockReturnValue(
        errAsync(createFileSystemError("IO_ERROR", "Read failed", null, {})),
      );
      vi.mocked(deps.cleanupTempDir).mockReturnValue(okAsync(undefined));

      const renderWorkflow = createRenderVideoWorkflow(deps);
      await renderWorkflow("script.json", "audio.wav", "/output/v.mp4");

      expect(deps.cleanupTempDir).toHaveBeenCalledWith(tempDir);
    });

    it("should cleanup temp directory on success", async () => {
      const deps = mockDeps();
      const tempDir = "/tmp/video-worker-123";

      vi.mocked(deps.createTempDir).mockReturnValue(okAsync(tempDir));
      vi.mocked(deps.downloadFromS3).mockReturnValue(okAsync(undefined));
      vi.mocked(deps.readFile).mockReturnValue(okAsync(Buffer.from("{}")));
      vi.mocked(deps.parseEnrichedScript).mockReturnValue(ok(validVideoProps));
      vi.mocked(deps.bundleComposition).mockReturnValue(okAsync("http://localhost:3000/bundle"));
      vi.mocked(deps.renderVideo).mockReturnValue(okAsync("/tmp/rendered.mp4"));
      vi.mocked(deps.uploadToS3).mockReturnValue(okAsync(undefined));
      vi.mocked(deps.cleanupTempDir).mockReturnValue(okAsync(undefined));

      const renderWorkflow = createRenderVideoWorkflow(deps);
      await renderWorkflow("script.json", "audio.wav", "/output/v.mp4");

      expect(deps.cleanupTempDir).toHaveBeenCalledWith(tempDir);
    });
  });
});
