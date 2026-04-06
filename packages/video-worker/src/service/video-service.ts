import path, { join } from "node:path";
import { Effect } from "effect";
import type {
  FileSystemError,
  RenderError,
  S3DownloadError,
  S3UploadError,
  ValidationError,
} from "../core/errors";
import type { RenderConfig } from "../core/render-config";
import type { Logger } from "../infrastructure/logger";
import type { VideoProps } from "../schema/schema";

type VideoWorkflowError =
  | FileSystemError
  | ValidationError
  | RenderError
  | S3DownloadError
  | S3UploadError;

export type RenderVideoWorkflowDeps = {
  readonly readFile: (path: string) => Effect.Effect<Buffer, FileSystemError>;
  readonly parseEnrichedScript: (
    jsonContent: string,
    wavPath: string,
  ) => Effect.Effect<VideoProps, ValidationError>;
  readonly bundleComposition: (
    entryPoint: string,
    publicDir: string,
  ) => Effect.Effect<string, RenderError>;
  readonly renderVideo: (
    config: RenderConfig,
  ) => Effect.Effect<string, RenderError>;
  readonly downloadFromS3: (
    key: string,
    destPath: string,
  ) => Effect.Effect<void, S3DownloadError>;
  readonly uploadToS3: (
    key: string,
    srcPath: string,
    contentType: string,
  ) => Effect.Effect<void, S3UploadError>;
  readonly createTempDir: () => Effect.Effect<string, FileSystemError>;
  readonly cleanupTempDir: (
    path: string,
  ) => Effect.Effect<void, FileSystemError>;
  readonly logger: Logger;
  readonly entryPoint: string;
  readonly publicDir?: string;
};

const FPS = 30;
const COMPOSITION_ID = "TechNews";

const buildVideoRenderConfig = (
  videoProps: VideoProps,
  serveUrl: string,
): RenderConfig =>
  ({
    composition: {
      id: COMPOSITION_ID,
      width: 1920,
      height: 1080,
      fps: FPS,
      durationInFrames: Math.ceil(videoProps.totalDurationSec * FPS),
    },
    serveUrl,
    inputProps: videoProps,
    codec: "h264",
    crf: 23,
    imageFormat: "jpeg",
    timeoutInMilliseconds: 900_000,
    concurrency: 2,
    enableMultiProcessOnLinux: true,
  }) satisfies RenderConfig;

export const createRenderVideoWorkflow = (deps: RenderVideoWorkflowDeps) => {
  const {
    readFile,
    parseEnrichedScript,
    bundleComposition,
    renderVideo,
    downloadFromS3,
    uploadToS3,
    createTempDir,
    cleanupTempDir,
    logger,
    entryPoint,
    publicDir: explicitPublicDir,
  } = deps;

  const renderVideoWorkflow = (
    scriptKey: string,
    audioKey: string,
    outputKey: string,
  ): Effect.Effect<string, VideoWorkflowError> => {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();

    logger.info("Starting video workflow", {
      requestId,
      scriptPath: scriptKey,
      audioPath: audioKey,
      outputPath: outputKey,
    });

    return createTempDir().pipe(
      Effect.flatMap((tempDir) => {
        const scriptLocalPath = join(tempDir, "script.json");
        const audioLocalPath = join(tempDir, "audio.wav");
        const publicDir = explicitPublicDir ?? path.dirname(audioLocalPath);

        const innerWorkflow = Effect.gen(function* () {
          yield* downloadFromS3(scriptKey, scriptLocalPath);

          yield* downloadFromS3(audioKey, audioLocalPath);

          const scriptBuffer = yield* readFile(scriptLocalPath);

          const videoProps = yield* parseEnrichedScript(
            scriptBuffer.toString("utf-8"),
            path.basename(audioLocalPath),
          );

          logger.debug("Script parsed successfully", {
            linesCount: videoProps.lines.length,
            sectionMarkersCount: videoProps.sectionMarkers.length,
          });

          const serveUrl = yield* bundleComposition(entryPoint, publicDir);

          logger.debug("Composition bundled", { serveUrl });

          const renderConfig = buildVideoRenderConfig(videoProps, serveUrl);
          const renderedPath = yield* renderVideo(renderConfig);

          logger.debug("Video rendered", { renderedPath });

          yield* uploadToS3(outputKey, renderedPath, "video/mp4");

          const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
          logger.info("Video workflow completed", {
            requestId,
            outputPath: outputKey,
            elapsedTime: `${elapsedSeconds}s`,
          });

          return outputKey;
        });

        const withCleanupOnSuccess = innerWorkflow.pipe(
          Effect.flatMap((result) =>
            cleanupTempDir(tempDir).pipe(
              Effect.map(() => result),
              Effect.catch((cleanupErr) => {
                logger.warn(
                  "Temp directory cleanup failed after successful render",
                  {
                    tempDir,
                    error: cleanupErr.message,
                  },
                );
                return Effect.succeed(result);
              }),
            ),
          ),
        );

        const withCleanupOnFailure = withCleanupOnSuccess.pipe(
          Effect.catch((error) => {
            logger.error("Video workflow failed", null, {
              requestId,
              errorMessage: error.message,
            });

            return cleanupTempDir(tempDir).pipe(
              Effect.flatMap(() => Effect.fail(error)),
              Effect.catch(() => Effect.fail(error)),
            );
          }),
        );

        return withCleanupOnFailure;
      }),
    );
  };

  return renderVideoWorkflow;
};
