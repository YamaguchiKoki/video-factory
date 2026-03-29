import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RenderError } from "../core/errors";
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

  describe("正常系", () => {
    it("renderMedia成功時にOkを返す", async () => {
      const config = createMockRenderConfig();

      // Get mocked renderMedia
      const { renderMedia } = await import("@remotion/renderer");
      vi.mocked(renderMedia).mockResolvedValue({
        buffer: null,
        slowestFrames: [],
        // biome-ignore lint/suspicious/noExplicitAny: mock return value for renderMedia
      } as any);

      const renderVideo = createRenderVideo(mockLogger);
      const result = await renderVideo(config);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toMatch(
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

      const renderVideo = createRenderVideo(mockLogger);
      await renderVideo(config);

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
    it("renderMediaがエラーをthrowした場合にErrを返す", async () => {
      const config = createMockRenderConfig();
      const mockError = new Error("Render failed");

      const { renderMedia } = await import("@remotion/renderer");
      vi.mocked(renderMedia).mockRejectedValue(mockError);

      const renderVideo = createRenderVideo(mockLogger);
      const result = await renderVideo(config);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        const error: RenderError = result.error;
        expect(error.type).toBe("RENDER_FAILED");
        expect(error.message).toContain("Render failed");
        expect(error.cause).toBe(mockError);
      }
    });

    it("タイムアウト時にRENDER_TIMEOUTエラーを返す", async () => {
      const config = createMockRenderConfig();
      const timeoutError = new Error("Timeout after 15 minutes");

      const { renderMedia } = await import("@remotion/renderer");
      vi.mocked(renderMedia).mockRejectedValue(timeoutError);

      const renderVideo = createRenderVideo(mockLogger);
      const result = await renderVideo(config);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        const error: RenderError = result.error;
        expect(error.type).toBe("RENDER_TIMEOUT");
        expect(error.message).toContain("Timeout");
      }
    });

    it("ブラウザエラー時にBROWSER_ERRORエラーを返す", async () => {
      const config = createMockRenderConfig();
      const browserError = new Error("Chrome process crashed");

      const { renderMedia } = await import("@remotion/renderer");
      vi.mocked(renderMedia).mockRejectedValue(browserError);

      const renderVideo = createRenderVideo(mockLogger);
      const result = await renderVideo(config);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        const error: RenderError = result.error;
        expect(error.type).toBe("BROWSER_ERROR");
        expect(error.message).toContain("Chrome");
      }
    });
  });

  describe("onProgressコールバック", () => {
    it("進行状況が10%ごとにログ出力される", async () => {
      const config = createMockRenderConfig();

      const { renderMedia } = await import("@remotion/renderer");
      // biome-ignore lint/suspicious/noExplicitAny: mock implementation with dynamic options
      vi.mocked(renderMedia).mockImplementation(async (options: any) => {
        // Simulate progress callbacks
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
          options.onProgress({
            progress: 0.5,
            renderedFrames: 450,
            encodedFrames: 445,
            encodedDoneIn: null,
            renderedDoneIn: null,
            renderEstimatedTime: 0,
            stitchStage: "encoding",
          });
          options.onProgress({
            progress: 1.0,
            renderedFrames: 900,
            encodedFrames: 900,
            encodedDoneIn: 1000,
            renderedDoneIn: 1000,
            renderEstimatedTime: 0,
            stitchStage: "muxing",
          });
        }
        return { buffer: null, slowestFrames: [] };
      });

      const renderVideo = createRenderVideo(mockLogger);
      await renderVideo(config);

      // Verify logger was called with progress info
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

      // Mock process.memoryUsage before creating renderVideo
      const originalMemoryUsage = process.memoryUsage;
      const mockMemoryUsage = vi.fn().mockReturnValue({
        heapUsed: 3.9 * 1024 * 1024 * 1024, // 3.9 GB (above threshold)
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
          // Call onProgress which will check memory
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

      const renderVideo = createRenderVideo(mockLogger);
      await renderVideo(config);

      // Restore original
      process.memoryUsage = originalMemoryUsage;

      // Verify warning was logged
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

      const renderVideo = createRenderVideo(mockLogger);
      await renderVideo(config);

      // Verify start and end logs
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
