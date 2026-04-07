import { Effect, Result } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RenderConfig } from "../core/render-config";
import { createRenderVideo } from "./remotion-renderer";

// Mock @remotion/renderer
vi.mock("@remotion/renderer", () => ({
  renderMedia: vi.fn(),
}));

describe("renderVideo", () => {
  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
  });

  const createMockRenderConfig = (): RenderConfig => ({
    composition: {
      id: "test-composition",
      width: 1920,
      height: 1080,
      fps: 30,
      durationInFrames: 900,
    },
    serveUrl: "http://localhost:3000/bundle",
    inputProps: {
      audioPath: "/tmp/test-audio.wav",
      segments: [],
      speakers: [],
    },
    codec: "h264",
    crf: 23,
    imageFormat: "jpeg",
    timeoutInMilliseconds: 900000,
    concurrency: 2,
    enableMultiProcessOnLinux: true,
  });

  const run = (config: RenderConfig) => {
    const renderVideo = createRenderVideo(mockLogger);
    return Effect.runPromise(Effect.result(renderVideo(config)));
  };

  describe("正常系", () => {
    it("renderMedia成功時にSuccessを返す", async () => {
      const config = createMockRenderConfig();

      const { renderMedia } = await import("@remotion/renderer");
      vi.mocked(renderMedia).mockResolvedValue({
        buffer: null,
        slowestFrames: [],
        // biome-ignore lint/suspicious/noExplicitAny: mock return value for renderMedia
      } as any);

      const result = await run(config);

      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        expect(result.success).toMatch(
          /^\/tmp\/remotion-render-\d+\/output\.mp4$/,
        );
      }
      expect(renderMedia).toHaveBeenCalledTimes(1);
    });

    it("renderMediaを正しいパラメータで呼び出す", async () => {
      const config = createMockRenderConfig();

      const { renderMedia } = await import("@remotion/renderer");
      vi.mocked(renderMedia).mockResolvedValue({
        buffer: null,
        slowestFrames: [],
        // biome-ignore lint/suspicious/noExplicitAny: mock return value for renderMedia
      } as any);

      await run(config);

      expect(renderMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          composition: expect.objectContaining({
            id: config.composition.id,
            width: config.composition.width,
            height: config.composition.height,
            fps: config.composition.fps,
            durationInFrames: config.composition.durationInFrames,
          }),
          inputProps: config.inputProps,
          codec: config.codec,
          crf: config.crf,
          imageFormat: config.imageFormat,
          timeoutInMilliseconds: config.timeoutInMilliseconds,
          concurrency: config.concurrency,
          outputLocation: expect.stringMatching(
            /^\/tmp\/remotion-render-\d+\/output\.mp4$/,
          ),
        }),
      );
    });
  });

  describe("異常系", () => {
    it("renderMediaがエラーをthrowした場合にFailureを返す", async () => {
      const config = createMockRenderConfig();
      const mockError = new Error("Render failed");

      const { renderMedia } = await import("@remotion/renderer");
      vi.mocked(renderMedia).mockRejectedValue(mockError);

      const result = await run(config);

      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) {
        expect(result.failure._tag).toBe("RenderError");
        expect(result.failure.message).toContain("Render failed");
        expect(result.failure.cause).toBe(mockError);
      }
    });

    it("タイムアウト時にRenderErrorを返す（メッセージにtimeoutを含む）", async () => {
      const config = createMockRenderConfig();
      const timeoutError = new Error("Timeout after 15 minutes");

      const { renderMedia } = await import("@remotion/renderer");
      vi.mocked(renderMedia).mockRejectedValue(timeoutError);

      const result = await run(config);

      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) {
        expect(result.failure._tag).toBe("RenderError");
        expect(result.failure.message).toContain("timeout");
      }
    });

    it("ブラウザエラー時にRenderErrorを返す（メッセージにBrowser errorを含む）", async () => {
      const config = createMockRenderConfig();
      const browserError = new Error("Chrome process crashed");

      const { renderMedia } = await import("@remotion/renderer");
      vi.mocked(renderMedia).mockRejectedValue(browserError);

      const result = await run(config);

      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) {
        expect(result.failure._tag).toBe("RenderError");
        expect(result.failure.message).toContain("Browser error");
      }
    });
  });

  describe("onProgressコールバック", () => {
    it("進行状況が10%ごとにログ出力される", async () => {
      const config = createMockRenderConfig();

      const { renderMedia } = await import("@remotion/renderer");
      // biome-ignore lint/suspicious/noExplicitAny: mock implementation with dynamic options
      vi.mocked(renderMedia).mockImplementation(async (options: any) => {
        if (options.onProgress) {
          options.onProgress({
            progress: 0.0,
            renderedFrames: 0,
            encodedFrames: 0,
            encodedDoneIn: null,
            renderedDoneIn: null,
            renderEstimatedTime: 0,
            stitchStage: "encoding",
          });
          options.onProgress({
            progress: 0.1,
            renderedFrames: 90,
            encodedFrames: 85,
            encodedDoneIn: null,
            renderedDoneIn: null,
            renderEstimatedTime: 0,
            stitchStage: "encoding",
          });
          options.onProgress({
            progress: 0.2,
            renderedFrames: 180,
            encodedFrames: 175,
            encodedDoneIn: null,
            renderedDoneIn: null,
            renderEstimatedTime: 0,
            stitchStage: "encoding",
          });
        }
        return { buffer: null, slowestFrames: [] };
      });

      await run(config);

      expect(mockLogger.info).toHaveBeenCalled();
      const logCalls = mockLogger.info.mock.calls;
      const progressLogs = logCalls.filter((call: unknown[]) =>
        (call[0] as string).includes("Rendering progress"),
      );
      expect(progressLogs.length).toBeGreaterThan(0);
    });
  });

  describe("メモリ監視", () => {
    it("メモリ使用量が4GB接近時に警告ログを出力", async () => {
      const config = createMockRenderConfig();

      const originalMemoryUsage = process.memoryUsage;
      const mockMemoryUsage = vi.fn().mockReturnValue({
        heapUsed: 3.9 * 1024 * 1024 * 1024,
        rss: 4 * 1024 * 1024 * 1024,
        heapTotal: 4 * 1024 * 1024 * 1024,
        external: 0,
        arrayBuffers: 0,
      });
      // biome-ignore lint/suspicious/noExplicitAny: overriding process.memoryUsage for test
      process.memoryUsage = mockMemoryUsage as any;

      const { renderMedia } = await import("@remotion/renderer");
      // biome-ignore lint/suspicious/noExplicitAny: mock implementation with dynamic options
      vi.mocked(renderMedia).mockImplementation(async (options: any) => {
        if (options.onProgress) {
          options.onProgress({
            progress: 0.5,
            renderedFrames: 450,
            encodedFrames: 445,
            encodedDoneIn: null,
            renderedDoneIn: null,
            renderEstimatedTime: 0,
            stitchStage: "encoding",
          });
        }
        return { buffer: null, slowestFrames: [] };
      });

      await run(config);

      process.memoryUsage = originalMemoryUsage;

      expect(mockLogger.warn).toHaveBeenCalled();
      const warnCalls = mockLogger.warn.mock.calls;
      const memoryWarnings = warnCalls.filter((call: unknown[]) =>
        (call[0] as string).includes("Memory usage"),
      );
      expect(memoryWarnings.length).toBeGreaterThan(0);
    });
  });

  describe("レンダリング時間の監視", () => {
    it("開始時刻と終了時刻をログ出力する", async () => {
      const config = createMockRenderConfig();

      const { renderMedia } = await import("@remotion/renderer");
      vi.mocked(renderMedia).mockResolvedValue({
        buffer: null,
        slowestFrames: [],
        // biome-ignore lint/suspicious/noExplicitAny: mock return value for renderMedia
      } as any);

      await run(config);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Starting video render"),
        expect.any(Object),
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Video render completed"),
        expect.any(Object),
      );
    });
  });
});
