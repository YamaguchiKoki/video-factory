/**
 * Remotion Video Renderer
 * Wraps @remotion/renderer's renderMedia() API with neverthrow Result type
 */

import { renderMedia } from "@remotion/renderer";
import type { VideoConfig } from "remotion/no-react";
import { ResultAsync } from "neverthrow";
import type { RenderConfig } from "../core/render-config";
import { createRenderError, type RenderError } from "../core/errors";

/**
 * Logger interface for dependency injection
 */
export interface Logger {
  debug: (message: string, context?: Record<string, unknown>) => void;
  info: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
  error: (message: string, error: Error | null, context?: Record<string, unknown>) => void;
}

/**
 * Memory warning threshold (4GB in bytes)
 */
const MEMORY_WARNING_THRESHOLD = 3.8 * 1024 * 1024 * 1024; // 3.8 GB

/**
 * Progress logging threshold (log every 10%)
 */
const PROGRESS_LOG_INTERVAL = 0.1;

/**
 * Categorize render error based on error message
 */
const categorizeRenderError = (errorMessage: string, cause: Error | null): RenderError => {
  const lowerMessage = errorMessage.toLowerCase();
  const isTimeout = lowerMessage.includes("timeout");
  const isBrowser = lowerMessage.includes("chrome") || lowerMessage.includes("browser");

  if (isTimeout) {
    return createRenderError("RENDER_TIMEOUT", `Render timeout: ${errorMessage}`, cause, {});
  }
  if (isBrowser) {
    return createRenderError("BROWSER_ERROR", `Browser error: ${errorMessage}`, cause, {});
  }
  return createRenderError("RENDER_FAILED", `Render failed: ${errorMessage}`, cause, {});
};

/**
 * Convert memory bytes to GB string
 */
const bytesToGB = (bytes: number): string => (bytes / (1024 * 1024 * 1024)).toFixed(2);

/**
 * Create a renderVideo function with logger dependency injection
 * @param logger - Logger instance for progress and error reporting
 * @returns Function that renders video and returns Result<outputPath, RenderError>
 */
export const createRenderVideo = (logger: Logger) => {
  /**
   * Render video using Remotion renderMedia() API
   * @param config - Render configuration
   * @returns ResultAsync with output file path on success, RenderError on failure
   */
  const renderVideo = (config: RenderConfig): ResultAsync<string, RenderError> => {
    const startTime = Date.now();
    const outputLocation = `/tmp/remotion-render-${Date.now()}/output.mp4`;
    // Use closure to track last logged progress (immutable reference)
    const progressTracker = { lastLogged: 0 };

    logger.info("Starting video render", {
      composition: config.composition.id,
      width: config.composition.width,
      height: config.composition.height,
      fps: config.composition.fps,
      durationInFrames: config.composition.durationInFrames,
      outputLocation,
    });

    // Convert RenderConfig.composition to VideoConfig required by renderMedia
    const videoConfig: VideoConfig = {
      ...config.composition,
      props: config.inputProps,
      defaultProps: config.inputProps,
      defaultCodec: null,
      defaultOutName: "output.mp4",
      defaultVideoImageFormat: config.imageFormat,
      defaultPixelFormat: "yuv420p",
      defaultProResProfile: null,
    };

    return ResultAsync.fromPromise(
      renderMedia({
        composition: videoConfig,
        serveUrl: "https://example.com", // Required by API but not used in our case
        codec: config.codec,
        crf: config.crf,
        imageFormat: config.imageFormat,
        inputProps: config.inputProps,
        outputLocation,
        timeoutInMilliseconds: config.timeoutInMilliseconds,
        concurrency: config.concurrency,
        onProgress: ({ progress, renderedFrames, encodedFrames }) => {
          // Log progress every 10%
          const progressPercent = Math.floor(progress * 100);
          const shouldLog = progress - progressTracker.lastLogged >= PROGRESS_LOG_INTERVAL;

          if (shouldLog) {
            logger.info("Rendering progress", {
              progress: `${progressPercent}%`,
              renderedFrames,
              encodedFrames,
              elapsedTime: `${Math.floor((Date.now() - startTime) / 1000)}s`,
            });
            progressTracker.lastLogged = progress;
          }

          // Monitor memory usage
          const memoryUsage = process.memoryUsage();
          if (memoryUsage.heapUsed > MEMORY_WARNING_THRESHOLD) {
            logger.warn("Memory usage approaching limit", {
              heapUsed: `${bytesToGB(memoryUsage.heapUsed)} GB`,
              progress: `${progressPercent}%`,
            });
          }
        },
      }),
      (error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const cause = error instanceof Error ? error : null;

        const renderError = categorizeRenderError(errorMessage, cause);

        logger.error("Video render failed", cause, {
          type: renderError.type,
          message: renderError.message,
        });

        return renderError;
      },
    ).map(() => {
      const endTime = Date.now();
      const elapsedSeconds = Math.floor((endTime - startTime) / 1000);

      logger.info("Video render completed", {
        outputLocation,
        elapsedTime: `${elapsedSeconds}s`,
      });

      return outputLocation;
    });
  };

  return renderVideo;
};
