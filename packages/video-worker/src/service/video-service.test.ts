import { Effect, Result } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  FileSystemError,
  RenderError,
  S3DownloadError,
  S3UploadError,
  ValidationError,
} from "../core/errors";
import type { VideoProps } from "../schema/schema";
import {
  createRenderVideoWorkflow,
  type RenderVideoWorkflowDeps,
} from "./video-service";

const run = (effect: Effect.Effect<string, unknown>) =>
  Effect.runPromise(Effect.result(effect));

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

      vi.mocked(deps.createTempDir).mockReturnValue(
        Effect.succeed("/tmp/video-worker-123"),
      );
      vi.mocked(deps.downloadFromS3).mockReturnValue(Effect.succeed(undefined));
      vi.mocked(deps.readFile).mockReturnValue(
        Effect.succeed(Buffer.from('{"test": "data"}')),
      );
      vi.mocked(deps.parseEnrichedScript).mockReturnValue(
        Effect.succeed(validVideoProps),
      );
      vi.mocked(deps.bundleComposition).mockReturnValue(
        Effect.succeed("http://localhost:3000/bundle"),
      );
      vi.mocked(deps.renderVideo).mockReturnValue(
        Effect.succeed("/tmp/rendered.mp4"),
      );
      vi.mocked(deps.uploadToS3).mockReturnValue(Effect.succeed(undefined));
      vi.mocked(deps.cleanupTempDir).mockReturnValue(Effect.succeed(undefined));

      const renderWorkflow = createRenderVideoWorkflow(deps);
      const result = await run(renderWorkflow(scriptKey, audioKey, outputKey));

      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        expect(result.success).toBe(outputKey);
      }

      expect(deps.createTempDir).toHaveBeenCalledTimes(1);
      expect(deps.downloadFromS3).toHaveBeenCalledTimes(2);
      expect(deps.readFile).toHaveBeenCalledWith(expect.any(String));
      expect(deps.parseEnrichedScript).toHaveBeenCalledWith(
        expect.any(String),
        "audio.wav",
      );
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

      vi.mocked(deps.createTempDir).mockReturnValue(
        Effect.succeed("/tmp/video-worker-123"),
      );
      vi.mocked(deps.downloadFromS3).mockReturnValue(Effect.succeed(undefined));
      vi.mocked(deps.readFile).mockReturnValue(
        Effect.succeed(Buffer.from("{}")),
      );
      vi.mocked(deps.parseEnrichedScript).mockReturnValue(
        Effect.succeed(validVideoProps),
      );
      vi.mocked(deps.bundleComposition).mockReturnValue(
        Effect.succeed(bundleUrl),
      );
      vi.mocked(deps.renderVideo).mockReturnValue(
        Effect.succeed("/tmp/rendered.mp4"),
      );
      vi.mocked(deps.uploadToS3).mockReturnValue(Effect.succeed(undefined));
      vi.mocked(deps.cleanupTempDir).mockReturnValue(Effect.succeed(undefined));

      const renderWorkflow = createRenderVideoWorkflow(deps);
      await run(renderWorkflow("script.json", "audio.wav", "/output/v.mp4"));

      expect(deps.renderVideo).toHaveBeenCalledWith(
        expect.objectContaining({
          composition: expect.objectContaining({ id: "TechNews" }),
          serveUrl: bundleUrl,
        }),
      );
    });

    it("should log start and completion times", async () => {
      const deps = mockDeps();

      vi.mocked(deps.createTempDir).mockReturnValue(
        Effect.succeed("/tmp/video-worker-123"),
      );
      vi.mocked(deps.downloadFromS3).mockReturnValue(Effect.succeed(undefined));
      vi.mocked(deps.readFile).mockReturnValue(
        Effect.succeed(Buffer.from("{}")),
      );
      vi.mocked(deps.parseEnrichedScript).mockReturnValue(
        Effect.succeed(validVideoProps),
      );
      vi.mocked(deps.bundleComposition).mockReturnValue(
        Effect.succeed("http://localhost:3000/bundle"),
      );
      vi.mocked(deps.renderVideo).mockReturnValue(
        Effect.succeed("/tmp/rendered.mp4"),
      );
      vi.mocked(deps.uploadToS3).mockReturnValue(Effect.succeed(undefined));
      vi.mocked(deps.cleanupTempDir).mockReturnValue(Effect.succeed(undefined));

      const renderWorkflow = createRenderVideoWorkflow(deps);
      await run(renderWorkflow("script.json", "audio.wav", "/output/v.mp4"));

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

      const fileError = new FileSystemError({ message: "File not found" });

      vi.mocked(deps.createTempDir).mockReturnValue(
        Effect.succeed("/tmp/video-worker-123"),
      );
      vi.mocked(deps.downloadFromS3).mockReturnValue(Effect.succeed(undefined));
      vi.mocked(deps.readFile).mockReturnValue(Effect.fail(fileError));
      vi.mocked(deps.cleanupTempDir).mockReturnValue(Effect.succeed(undefined));

      const renderWorkflow = createRenderVideoWorkflow(deps);
      const result = await run(
        renderWorkflow("script.json", "audio.wav", "/output/v.mp4"),
      );

      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) {
        expect(result.failure._tag).toBe("FileSystemError");
      }

      expect(deps.cleanupTempDir).toHaveBeenCalled();
      expect(deps.parseEnrichedScript).not.toHaveBeenCalled();
      expect(deps.renderVideo).not.toHaveBeenCalled();
    });
  });

  describe("error handling - script validation failure", () => {
    it("should return early if parseEnrichedScript fails", async () => {
      const deps = mockDeps();

      const validationError = new ValidationError({
        message: "Invalid schema",
      });

      vi.mocked(deps.createTempDir).mockReturnValue(
        Effect.succeed("/tmp/video-worker-123"),
      );
      vi.mocked(deps.downloadFromS3).mockReturnValue(Effect.succeed(undefined));
      vi.mocked(deps.readFile).mockReturnValue(
        Effect.succeed(Buffer.from("{}")),
      );
      vi.mocked(deps.parseEnrichedScript).mockReturnValue(
        Effect.fail(validationError),
      );
      vi.mocked(deps.cleanupTempDir).mockReturnValue(Effect.succeed(undefined));

      const renderWorkflow = createRenderVideoWorkflow(deps);
      const result = await run(
        renderWorkflow("script.json", "audio.wav", "/output/v.mp4"),
      );

      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) {
        expect(result.failure._tag).toBe("ValidationError");
      }

      expect(deps.cleanupTempDir).toHaveBeenCalled();
      expect(deps.bundleComposition).not.toHaveBeenCalled();
      expect(deps.renderVideo).not.toHaveBeenCalled();
    });
  });

  describe("error handling - bundle failure", () => {
    it("should return error if bundleComposition fails", async () => {
      const deps = mockDeps();

      const renderError = new RenderError({ message: "Webpack build failed" });

      vi.mocked(deps.createTempDir).mockReturnValue(
        Effect.succeed("/tmp/video-worker-123"),
      );
      vi.mocked(deps.downloadFromS3).mockReturnValue(Effect.succeed(undefined));
      vi.mocked(deps.readFile).mockReturnValue(
        Effect.succeed(Buffer.from("{}")),
      );
      vi.mocked(deps.parseEnrichedScript).mockReturnValue(
        Effect.succeed(validVideoProps),
      );
      vi.mocked(deps.bundleComposition).mockReturnValue(
        Effect.fail(renderError),
      );
      vi.mocked(deps.cleanupTempDir).mockReturnValue(Effect.succeed(undefined));

      const renderWorkflow = createRenderVideoWorkflow(deps);
      const result = await run(
        renderWorkflow("script.json", "audio.wav", "/output/v.mp4"),
      );

      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) {
        expect(result.failure._tag).toBe("RenderError");
      }

      expect(deps.cleanupTempDir).toHaveBeenCalled();
      expect(deps.renderVideo).not.toHaveBeenCalled();
    });
  });

  describe("error handling - render failure", () => {
    it("should return error if renderVideo fails", async () => {
      const deps = mockDeps();

      const renderError = new RenderError({ message: "Rendering failed" });

      vi.mocked(deps.createTempDir).mockReturnValue(
        Effect.succeed("/tmp/video-worker-123"),
      );
      vi.mocked(deps.downloadFromS3).mockReturnValue(Effect.succeed(undefined));
      vi.mocked(deps.readFile).mockReturnValue(
        Effect.succeed(Buffer.from("{}")),
      );
      vi.mocked(deps.parseEnrichedScript).mockReturnValue(
        Effect.succeed(validVideoProps),
      );
      vi.mocked(deps.bundleComposition).mockReturnValue(
        Effect.succeed("http://localhost:3000/bundle"),
      );
      vi.mocked(deps.renderVideo).mockReturnValue(Effect.fail(renderError));
      vi.mocked(deps.cleanupTempDir).mockReturnValue(Effect.succeed(undefined));

      const renderWorkflow = createRenderVideoWorkflow(deps);
      const result = await run(
        renderWorkflow("script.json", "audio.wav", "/output/v.mp4"),
      );

      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) {
        expect(result.failure._tag).toBe("RenderError");
      }

      expect(deps.cleanupTempDir).toHaveBeenCalled();
    });
  });

  describe("cleanup guarantee", () => {
    it("should cleanup temp directory even on failure", async () => {
      const deps = mockDeps();
      const tempDir = "/tmp/video-worker-123";

      vi.mocked(deps.createTempDir).mockReturnValue(Effect.succeed(tempDir));
      vi.mocked(deps.downloadFromS3).mockReturnValue(Effect.succeed(undefined));
      vi.mocked(deps.readFile).mockReturnValue(
        Effect.fail(new FileSystemError({ message: "Read failed" })),
      );
      vi.mocked(deps.cleanupTempDir).mockReturnValue(Effect.succeed(undefined));

      const renderWorkflow = createRenderVideoWorkflow(deps);
      await run(renderWorkflow("script.json", "audio.wav", "/output/v.mp4"));

      expect(deps.cleanupTempDir).toHaveBeenCalledWith(tempDir);
    });

    it("should cleanup temp directory on success", async () => {
      const deps = mockDeps();
      const tempDir = "/tmp/video-worker-123";

      vi.mocked(deps.createTempDir).mockReturnValue(Effect.succeed(tempDir));
      vi.mocked(deps.downloadFromS3).mockReturnValue(Effect.succeed(undefined));
      vi.mocked(deps.readFile).mockReturnValue(
        Effect.succeed(Buffer.from("{}")),
      );
      vi.mocked(deps.parseEnrichedScript).mockReturnValue(
        Effect.succeed(validVideoProps),
      );
      vi.mocked(deps.bundleComposition).mockReturnValue(
        Effect.succeed("http://localhost:3000/bundle"),
      );
      vi.mocked(deps.renderVideo).mockReturnValue(
        Effect.succeed("/tmp/rendered.mp4"),
      );
      vi.mocked(deps.uploadToS3).mockReturnValue(Effect.succeed(undefined));
      vi.mocked(deps.cleanupTempDir).mockReturnValue(Effect.succeed(undefined));

      const renderWorkflow = createRenderVideoWorkflow(deps);
      await run(renderWorkflow("script.json", "audio.wav", "/output/v.mp4"));

      expect(deps.cleanupTempDir).toHaveBeenCalledWith(tempDir);
    });
  });

  describe("S3 download details", () => {
    const s3Success = () => Effect.succeed<void>(undefined);
    const s3DownloadError = (msg = "S3 error") =>
      Effect.fail(new S3DownloadError({ message: msg }));
    const s3UploadError = (msg = "Upload error") =>
      Effect.fail(new S3UploadError({ message: msg }));

    const SCRIPT_KEY = "tts-worker/script.json";
    const AUDIO_KEY = "tts-worker/audio.wav";
    const OUTPUT_KEY = "video-worker/video.mp4";
    const TEMP_DIR = "/tmp/video-worker-123";

    it("downloads script using the provided scriptKey", async () => {
      const deps = mockDeps();
      vi.mocked(deps.createTempDir).mockReturnValue(Effect.succeed(TEMP_DIR));
      vi.mocked(deps.downloadFromS3).mockReturnValue(s3Success());
      vi.mocked(deps.readFile).mockReturnValue(
        Effect.succeed(Buffer.from("{}")),
      );
      vi.mocked(deps.parseEnrichedScript).mockReturnValue(
        Effect.succeed(validVideoProps),
      );
      vi.mocked(deps.bundleComposition).mockReturnValue(
        Effect.succeed("http://localhost:3000/bundle"),
      );
      vi.mocked(deps.renderVideo).mockReturnValue(
        Effect.succeed(`${TEMP_DIR}/rendered.mp4`),
      );
      vi.mocked(deps.uploadToS3).mockReturnValue(s3Success());
      vi.mocked(deps.cleanupTempDir).mockReturnValue(Effect.succeed(undefined));

      const renderWorkflow = createRenderVideoWorkflow(deps);
      await run(renderWorkflow(SCRIPT_KEY, AUDIO_KEY, OUTPUT_KEY));

      const firstCall = vi.mocked(deps.downloadFromS3).mock.calls[0];
      expect(firstCall?.[0]).toBe(SCRIPT_KEY);
    });

    it("downloads audio using the provided audioKey", async () => {
      const deps = mockDeps();
      vi.mocked(deps.createTempDir).mockReturnValue(Effect.succeed(TEMP_DIR));
      vi.mocked(deps.downloadFromS3).mockReturnValue(s3Success());
      vi.mocked(deps.readFile).mockReturnValue(
        Effect.succeed(Buffer.from("{}")),
      );
      vi.mocked(deps.parseEnrichedScript).mockReturnValue(
        Effect.succeed(validVideoProps),
      );
      vi.mocked(deps.bundleComposition).mockReturnValue(
        Effect.succeed("http://localhost:3000/bundle"),
      );
      vi.mocked(deps.renderVideo).mockReturnValue(
        Effect.succeed(`${TEMP_DIR}/rendered.mp4`),
      );
      vi.mocked(deps.uploadToS3).mockReturnValue(s3Success());
      vi.mocked(deps.cleanupTempDir).mockReturnValue(Effect.succeed(undefined));

      const renderWorkflow = createRenderVideoWorkflow(deps);
      await run(renderWorkflow(SCRIPT_KEY, AUDIO_KEY, OUTPUT_KEY));

      const secondCall = vi.mocked(deps.downloadFromS3).mock.calls[1];
      expect(secondCall?.[0]).toBe(AUDIO_KEY);
    });

    it("uploads rendered video with video/mp4 content type", async () => {
      const deps = mockDeps();
      vi.mocked(deps.createTempDir).mockReturnValue(Effect.succeed(TEMP_DIR));
      vi.mocked(deps.downloadFromS3).mockReturnValue(s3Success());
      vi.mocked(deps.readFile).mockReturnValue(
        Effect.succeed(Buffer.from("{}")),
      );
      vi.mocked(deps.parseEnrichedScript).mockReturnValue(
        Effect.succeed(validVideoProps),
      );
      vi.mocked(deps.bundleComposition).mockReturnValue(
        Effect.succeed("http://localhost:3000/bundle"),
      );
      vi.mocked(deps.renderVideo).mockReturnValue(
        Effect.succeed(`${TEMP_DIR}/rendered.mp4`),
      );
      vi.mocked(deps.uploadToS3).mockReturnValue(s3Success());
      vi.mocked(deps.cleanupTempDir).mockReturnValue(Effect.succeed(undefined));

      const renderWorkflow = createRenderVideoWorkflow(deps);
      await run(renderWorkflow(SCRIPT_KEY, AUDIO_KEY, OUTPUT_KEY));

      expect(deps.uploadToS3).toHaveBeenCalledWith(
        OUTPUT_KEY,
        expect.any(String),
        "video/mp4",
      );
    });

    it("returns Failure S3DownloadError when script download fails", async () => {
      const deps = mockDeps();
      vi.mocked(deps.createTempDir).mockReturnValue(Effect.succeed(TEMP_DIR));
      vi.mocked(deps.downloadFromS3).mockReturnValueOnce(
        s3DownloadError("Script not found"),
      );
      vi.mocked(deps.cleanupTempDir).mockReturnValue(Effect.succeed(undefined));

      const renderWorkflow = createRenderVideoWorkflow(deps);
      const result = await run(
        renderWorkflow(SCRIPT_KEY, AUDIO_KEY, OUTPUT_KEY),
      );

      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) {
        expect(result.failure._tag).toBe("S3DownloadError");
      }
    });

    it("returns Failure S3DownloadError when audio download fails", async () => {
      const deps = mockDeps();
      vi.mocked(deps.createTempDir).mockReturnValue(Effect.succeed(TEMP_DIR));
      vi.mocked(deps.downloadFromS3)
        .mockReturnValueOnce(s3Success())
        .mockReturnValueOnce(s3DownloadError("Audio not found"));
      vi.mocked(deps.cleanupTempDir).mockReturnValue(Effect.succeed(undefined));

      const renderWorkflow = createRenderVideoWorkflow(deps);
      const result = await run(
        renderWorkflow(SCRIPT_KEY, AUDIO_KEY, OUTPUT_KEY),
      );

      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) {
        expect(result.failure._tag).toBe("S3DownloadError");
      }
    });

    it("returns Failure S3UploadError when uploadToS3 fails", async () => {
      const deps = mockDeps();
      vi.mocked(deps.createTempDir).mockReturnValue(Effect.succeed(TEMP_DIR));
      vi.mocked(deps.downloadFromS3).mockReturnValue(s3Success());
      vi.mocked(deps.readFile).mockReturnValue(
        Effect.succeed(Buffer.from("{}")),
      );
      vi.mocked(deps.parseEnrichedScript).mockReturnValue(
        Effect.succeed(validVideoProps),
      );
      vi.mocked(deps.bundleComposition).mockReturnValue(
        Effect.succeed("http://localhost:3000/bundle"),
      );
      vi.mocked(deps.renderVideo).mockReturnValue(
        Effect.succeed(`${TEMP_DIR}/rendered.mp4`),
      );
      vi.mocked(deps.uploadToS3).mockReturnValue(
        s3UploadError("Upload quota exceeded"),
      );
      vi.mocked(deps.cleanupTempDir).mockReturnValue(Effect.succeed(undefined));

      const renderWorkflow = createRenderVideoWorkflow(deps);
      const result = await run(
        renderWorkflow(SCRIPT_KEY, AUDIO_KEY, OUTPUT_KEY),
      );

      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) {
        expect(result.failure._tag).toBe("S3UploadError");
      }
    });

    it("cleans up temp directory even when upload fails", async () => {
      const deps = mockDeps();
      vi.mocked(deps.createTempDir).mockReturnValue(Effect.succeed(TEMP_DIR));
      vi.mocked(deps.downloadFromS3).mockReturnValue(s3Success());
      vi.mocked(deps.readFile).mockReturnValue(
        Effect.succeed(Buffer.from("{}")),
      );
      vi.mocked(deps.parseEnrichedScript).mockReturnValue(
        Effect.succeed(validVideoProps),
      );
      vi.mocked(deps.bundleComposition).mockReturnValue(
        Effect.succeed("http://localhost:3000/bundle"),
      );
      vi.mocked(deps.renderVideo).mockReturnValue(
        Effect.succeed(`${TEMP_DIR}/rendered.mp4`),
      );
      vi.mocked(deps.uploadToS3).mockReturnValue(s3UploadError());
      vi.mocked(deps.cleanupTempDir).mockReturnValue(Effect.succeed(undefined));

      const renderWorkflow = createRenderVideoWorkflow(deps);
      await run(renderWorkflow(SCRIPT_KEY, AUDIO_KEY, OUTPUT_KEY));

      expect(deps.cleanupTempDir).toHaveBeenCalledWith(TEMP_DIR);
    });
  });
});
