import path from "path";
import { ResultAsync, errAsync, okAsync, Result } from "neverthrow";
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

export interface RenderVideoWorkflowDeps {
  readFile: (path: string) => ResultAsync<Buffer, FileSystemError>;
  parseEnrichedScript: (jsonContent: string, wavPath: string) => Result<VideoProps, ValidationError>;
  bundleComposition: (entryPoint: string, publicDir: string) => ResultAsync<string, RenderError>;
  renderVideo: (config: RenderConfig) => ResultAsync<string, RenderError>;
  writeFile: (path: string, data: Buffer) => ResultAsync<void, FileSystemError>;
  createTempDir: () => ResultAsync<string, FileSystemError>;
  cleanupTempDir: (path: string) => ResultAsync<void, FileSystemError>;
  logger: Logger;
  entryPoint: string;
  publicDir?: string;
}

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
    writeFile,
    createTempDir,
    cleanupTempDir,
    logger,
    entryPoint,
    publicDir: explicitPublicDir,
  } = deps;

  const renderVideoWorkflow = (
    scriptPath: string,
    audioPath: string,
    outputPath: string,
  ): ResultAsync<string, VideoServiceError> => {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();

    logger.info("Starting video workflow", {
      requestId,
      scriptPath,
      audioPath,
      outputPath,
    });

    return createTempDir()
      .mapErr((err) => mapFileSystemError(err, { step: "createTempDir" }))
      .andThen((tempDir) => {
        logger.debug("Temporary directory created", { tempDir });

        const innerWorkflow = readFile(scriptPath)
          .mapErr((err) => mapFileSystemError(err, { step: "readScriptFile", scriptPath }))
          .andThen((scriptBuffer) => {
            const scriptContent = scriptBuffer.toString("utf-8");
            const publicDir = explicitPublicDir ?? path.dirname(audioPath);

            return parseEnrichedScript(scriptContent, path.basename(audioPath))
              .mapErr((err) => mapValidationError(err, { step: "parseEnrichedScript", scriptPath }))
              .asyncAndThen((videoProps) => {
                logger.debug("Script parsed successfully", {
                  linesCount: videoProps.lines.length,
                  sectionMarkersCount: videoProps.sectionMarkers.length,
                });

                return bundleComposition(entryPoint, publicDir)
                  .mapErr((err) => mapRenderError(err, { step: "bundleComposition" }))
                  .andThen((serveUrl) => {
                    logger.debug("Composition bundled", { serveUrl });

                    const renderConfig = buildVideoRenderConfig(videoProps, serveUrl);

                    return renderVideo(renderConfig)
                      .mapErr((err) => mapRenderError(err, { step: "renderVideo" }))
                      .andThen((renderedPath) => {
                        logger.debug("Video rendered", { renderedPath });

                        return readFile(renderedPath)
                          .mapErr((err) =>
                            mapFileSystemError(err, { step: "readRenderedFile", renderedPath }),
                          )
                          .andThen((videoBuffer) =>
                            writeFile(outputPath, videoBuffer)
                              .mapErr((err) =>
                                mapFileSystemError(err, { step: "writeOutputFile", outputPath }),
                              )
                              .map(() => {
                                const elapsedSeconds = Math.floor(
                                  (Date.now() - startTime) / 1000,
                                );
                                logger.info("Video workflow completed", {
                                  requestId,
                                  outputPath,
                                  elapsedTime: `${elapsedSeconds}s`,
                                });
                                return outputPath;
                              }),
                          );
                      });
                  });
              });
          });

        return innerWorkflow
          .andThen((result) =>
            cleanupTempDir(tempDir)
              .map(() => result)
              .mapErr((cleanupErr) => {
                logger.warn("Failed to cleanup temp directory on success", {
                  tempDir,
                  error: cleanupErr.message,
                });
                return mapFileSystemError(cleanupErr, { step: "cleanup" });
              })
              .orElse(() => okAsync(result)),
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
              .orElse((cleanupErr) => {
                logger.warn("Failed to cleanup temp directory after error", {
                  tempDir,
                  cleanupError: cleanupErr.message,
                });
                return errAsync(error);
              });
          });
      });
  };

  return renderVideoWorkflow;
};
