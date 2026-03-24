import path from "path";
import { join } from "node:path";
import { Result, ResultAsync, errAsync, okAsync, ok, safeTry } from "neverthrow";
import type { VideoProps } from "../schema/schema";
import type {
  FileSystemError,
  ValidationError,
  RenderError,
  VideoServiceError,
} from "../core/errors";
import { createVideoServiceError } from "../core/errors";
import type { RenderConfig } from "../core/render-config";
import type { Logger } from "../infrastructure/logger";
import type { S3Error } from "../infrastructure/s3";

export type RenderVideoWorkflowDeps = {
  readonly readFile: (path: string) => ResultAsync<Buffer, FileSystemError>;
  readonly parseEnrichedScript: (jsonContent: string, wavPath: string) => Result<VideoProps, ValidationError>;
  readonly bundleComposition: (entryPoint: string, publicDir: string) => ResultAsync<string, RenderError>;
  readonly renderVideo: (config: RenderConfig) => ResultAsync<string, RenderError>;
  readonly downloadFromS3: (key: string, destPath: string) => ResultAsync<void, S3Error>;
  readonly uploadToS3: (key: string, srcPath: string, contentType: string) => ResultAsync<void, S3Error>;
  readonly createTempDir: () => ResultAsync<string, FileSystemError>;
  readonly cleanupTempDir: (path: string) => ResultAsync<void, FileSystemError>;
  readonly logger: Logger;
  readonly entryPoint: string;
  readonly publicDir?: string;
};

const mapFileSystemError = (
  error: FileSystemError,
  context: Record<string, unknown>,
): VideoServiceError =>
  createVideoServiceError(
    "FILE_READ_ERROR",
    error.message,
    error.cause,
    { ...error.context, ...context },
  );

const mapValidationError = (
  error: ValidationError,
  context: Record<string, unknown>,
): VideoServiceError =>
  createVideoServiceError(
    "VALIDATION_ERROR",
    error.message,
    error.cause,
    { ...error.context, ...context },
  );

const mapRenderError = (
  error: RenderError,
  context: Record<string, unknown>,
): VideoServiceError =>
  createVideoServiceError(
    "RENDER_ERROR",
    error.message,
    error.cause,
    { ...error.context, ...context },
  );

const mapS3ToReadError = (
  error: S3Error,
  context: Record<string, unknown>,
): VideoServiceError =>
  createVideoServiceError(
    "FILE_READ_ERROR",
    error.message,
    null,
    context,
  );

const mapS3ToWriteError = (
  error: S3Error,
  context: Record<string, unknown>,
): VideoServiceError =>
  createVideoServiceError(
    "FILE_WRITE_ERROR",
    error.message,
    null,
    context,
  );

const FPS = 30;
const COMPOSITION_ID = "TechNews";

const buildVideoRenderConfig = (videoProps: VideoProps, serveUrl: string): RenderConfig => ({
  composition: {
    id: COMPOSITION_ID,
    width: 1920,
    height: 1080,
    fps: FPS,
    durationInFrames: Math.ceil(videoProps.totalDurationSec * FPS),
  },
  serveUrl,
  inputProps: videoProps as Record<string, unknown>,
  codec: "h264",
  crf: 23,
  imageFormat: "jpeg",
  timeoutInMilliseconds: 900_000,
  concurrency: 2,
  enableMultiProcessOnLinux: true,
});

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
  ): ResultAsync<string, VideoServiceError> => {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();

    logger.info("Starting video workflow", {
      requestId,
      scriptPath: scriptKey,
      audioPath: audioKey,
      outputPath: outputKey,
    });

    return createTempDir()
      .mapErr((err) => mapFileSystemError(err, { step: "createTempDir" }))
      .andThen((tempDir) => {
        const scriptLocalPath = join(tempDir, "script.json");
        const audioLocalPath = join(tempDir, "audio.wav");
        const publicDir = explicitPublicDir ?? path.dirname(audioLocalPath);

        const innerWorkflow = safeTry(async function* () {
          yield* downloadFromS3(scriptKey, scriptLocalPath).mapErr((err) =>
            mapS3ToReadError(err, { step: "downloadScript", scriptKey }),
          );

          yield* downloadFromS3(audioKey, audioLocalPath).mapErr((err) =>
            mapS3ToReadError(err, { step: "downloadAudio", audioKey }),
          );

          const scriptBuffer = yield* readFile(scriptLocalPath).mapErr((err) =>
            mapFileSystemError(err, { step: "readScriptFile", scriptLocalPath }),
          );

          const videoProps = yield* parseEnrichedScript(
            scriptBuffer.toString("utf-8"),
            path.basename(audioLocalPath),
          ).mapErr((err) => mapValidationError(err, { step: "parseEnrichedScript" }));

          logger.debug("Script parsed successfully", {
            linesCount: videoProps.lines.length,
            sectionMarkersCount: videoProps.sectionMarkers.length,
          });

          const serveUrl = yield* bundleComposition(entryPoint, publicDir).mapErr((err) =>
            mapRenderError(err, { step: "bundleComposition" }),
          );

          logger.debug("Composition bundled", { serveUrl });

          const renderConfig = buildVideoRenderConfig(videoProps, serveUrl);
          const renderedPath = yield* renderVideo(renderConfig).mapErr((err) =>
            mapRenderError(err, { step: "renderVideo" }),
          );

          logger.debug("Video rendered", { renderedPath });

          yield* uploadToS3(outputKey, renderedPath, "video/mp4").mapErr((err) =>
            mapS3ToWriteError(err, { step: "uploadVideo", outputKey }),
          );

          const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
          logger.info("Video workflow completed", {
            requestId,
            outputPath: outputKey,
            elapsedTime: `${elapsedSeconds}s`,
          });

          return ok(outputKey);
        });

        return innerWorkflow
          .andThen((result) =>
            cleanupTempDir(tempDir)
              .map(() => result)
              .orElse((cleanupErr) => {
                logger.warn("Temp directory cleanup failed after successful render", {
                  tempDir,
                  error: cleanupErr.message,
                });
                return okAsync(result);
              }),
          )
          .orElse((error) => {
            logger.error("Video workflow failed", error.cause, {
              requestId,
              errorType: error.type,
              errorMessage: error.message,
              context: error.context,
            });

            return cleanupTempDir(tempDir)
              .andThen(() => errAsync(error))
              .orElse(() => errAsync(error));
          });
      });
  };

  return renderVideoWorkflow;
};
