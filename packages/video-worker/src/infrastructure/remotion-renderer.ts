import { renderMedia } from "@remotion/renderer";
import { Effect } from "effect";
import type { VideoConfig } from "remotion/no-react";
import { RenderError } from "../core/errors";
import type { RenderConfig } from "../core/render-config";
import type { Logger } from "./logger";

const MEMORY_WARNING_THRESHOLD = 3.8 * 1024 * 1024 * 1024; // 3.8 GB

const PROGRESS_LOG_INTERVAL = 0.1;

const categorizeRenderError = (
  errorMessage: string,
  cause: Error | undefined,
): RenderError => {
  const lowerMessage = errorMessage.toLowerCase();
  const isTimeout = lowerMessage.includes("timeout");
  const isBrowser =
    lowerMessage.includes("chrome") || lowerMessage.includes("browser");

  if (isTimeout) {
    return new RenderError({
      message: `Render timeout: ${errorMessage}`,
      cause,
    });
  }
  if (isBrowser) {
    return new RenderError({
      message: `Browser error: ${errorMessage}`,
      cause,
    });
  }
  return new RenderError({
    message: `Render failed: ${errorMessage}`,
    cause,
  });
};

const bytesToGB = (bytes: number): string =>
  (bytes / (1024 * 1024 * 1024)).toFixed(2);

export const createRenderVideo = (logger: Logger) => {
  const renderVideo = (
    config: RenderConfig,
  ): Effect.Effect<string, RenderError> => {
    const startTime = Date.now();
    const outputLocation = `/tmp/remotion-render-${Date.now()}/output.mp4`;
    const progressTracker = { lastLogged: 0 };

    logger.info("Starting video render", {
      composition: config.composition.id,
      width: config.composition.width,
      height: config.composition.height,
      fps: config.composition.fps,
      durationInFrames: config.composition.durationInFrames,
      outputLocation,
    });

    // Cast to Record<string, unknown> at the Remotion API boundary — Remotion's
    // renderMedia signature expects this shape, but our internal type is VideoProps.
    const inputPropsForRemotion = config.inputProps as Record<string, unknown>;

    const videoConfig: VideoConfig = {
      ...config.composition,
      props: inputPropsForRemotion,
      defaultProps: inputPropsForRemotion,
      defaultCodec: null,
      defaultOutName: "output.mp4",
      defaultVideoImageFormat: config.imageFormat,
      defaultPixelFormat: "yuv420p",
      defaultProResProfile: null,
    };

    return Effect.tryPromise({
      try: () =>
        renderMedia({
          composition: videoConfig,
          serveUrl: config.serveUrl,
          codec: config.codec,
          crf: config.crf,
          imageFormat: config.imageFormat,
          inputProps: inputPropsForRemotion,
          outputLocation,
          timeoutInMilliseconds: config.timeoutInMilliseconds,
          concurrency: config.concurrency,
          onProgress: ({ progress, renderedFrames, encodedFrames }) => {
            const progressPercent = Math.floor(progress * 100);
            const shouldLog =
              progress - progressTracker.lastLogged >= PROGRESS_LOG_INTERVAL;

            if (shouldLog) {
              logger.info("Rendering progress", {
                progress: `${progressPercent}%`,
                renderedFrames,
                encodedFrames,
                elapsedTime: `${Math.floor((Date.now() - startTime) / 1000)}s`,
              });
              progressTracker.lastLogged = progress;
            }

            const memoryUsage = process.memoryUsage();
            if (memoryUsage.heapUsed > MEMORY_WARNING_THRESHOLD) {
              logger.warn("Memory usage approaching limit", {
                heapUsed: `${bytesToGB(memoryUsage.heapUsed)} GB`,
                progress: `${progressPercent}%`,
              });
            }
          },
        }),
      catch: (error: unknown) => {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const cause = error instanceof Error ? error : undefined;

        const renderError = categorizeRenderError(errorMessage, cause);

        logger.error("Video render failed", cause ?? null, {
          message: renderError.message,
        });

        return renderError;
      },
    }).pipe(
      Effect.map(() => {
        const endTime = Date.now();
        const elapsedSeconds = Math.floor((endTime - startTime) / 1000);

        logger.info("Video render completed", {
          outputLocation,
          elapsedTime: `${elapsedSeconds}s`,
        });

        return outputLocation;
      }),
    );
  };

  return renderVideo;
};
