/**
 * VideoService - Orchestrates the video rendering workflow
 * Coordinates file operations, script parsing, rendering, and output
 */

import { ResultAsync, errAsync, okAsync } from "neverthrow";
import type { Result } from "neverthrow";
import type {
  FileSystemError,
  ValidationError,
  RenderError,
  VideoServiceError,
} from "../core/errors";
import { createVideoServiceError } from "../core/errors";
import type { ParsedScript } from "../core/script-types";
import type { RenderConfig } from "../core/render-config";
import type { Logger } from "../infrastructure/remotion-renderer";

/**
 * Dependencies for renderVideoWorkflow (for dependency injection via currying)
 */
export interface RenderVideoWorkflowDeps {
  readFile: (path: string) => ResultAsync<Buffer, FileSystemError>;
  parseScript: (jsonContent: string) => Result<ParsedScript, ValidationError>;
  buildRenderConfig: (
    script: ParsedScript,
    audioPath: string
  ) => Result<RenderConfig, ValidationError>;
  renderVideo: (config: RenderConfig) => ResultAsync<string, RenderError>;
  writeFile: (path: string, data: Buffer) => ResultAsync<void, FileSystemError>;
  createTempDir: () => ResultAsync<string, FileSystemError>;
  cleanupTempDir: (path: string) => ResultAsync<void, FileSystemError>;
  logger: Logger;
}

/**
 * Map domain errors to VideoServiceError types
 */
const mapFileSystemError = (
  error: FileSystemError,
  context: Record<string, unknown>
): VideoServiceError =>
  createVideoServiceError(
    "FILE_READ_ERROR",
    error.message,
    error.cause,
    { ...error.context, ...context }
  );

const mapValidationError = (
  error: ValidationError,
  context: Record<string, unknown>
): VideoServiceError =>
  createVideoServiceError(
    "VALIDATION_ERROR",
    error.message,
    error.cause,
    { ...error.context, ...context }
  );

const mapRenderError = (
  error: RenderError,
  context: Record<string, unknown>
): VideoServiceError =>
  createVideoServiceError(
    "RENDER_ERROR",
    error.message,
    error.cause,
    { ...error.context, ...context }
  );

/**
 * Create renderVideoWorkflow function with dependencies injected
 * @param deps - Dependencies for the workflow
 * @returns Function that executes the video rendering workflow
 */
export const createRenderVideoWorkflow = (deps: RenderVideoWorkflowDeps) => {
  const {
    readFile,
    parseScript,
    buildRenderConfig,
    renderVideo,
    writeFile,
    createTempDir,
    cleanupTempDir,
    logger,
  } = deps;

  /**
   * Execute the complete video rendering workflow
   * @param scriptPath - Path to script JSON file
   * @param audioPath - Path to audio WAV file
   * @param outputPath - Path to write output MP4 file
   * @returns ResultAsync with output path on success, VideoServiceError on failure
   */
  const renderVideoWorkflow = (
    scriptPath: string,
    audioPath: string,
    outputPath: string
  ): ResultAsync<string, VideoServiceError> => {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();

    logger.info("Starting video workflow", {
      requestId,
      scriptPath,
      audioPath,
      outputPath,
    });

    // Track temp directory for cleanup
    const state = { tempDir: null as string | null };

    // Helper to convert Result to ResultAsync
    const resultToResultAsync = <T, E>(result: Result<T, E>) => {
      return result.isOk()
        ? okAsync<T, E>(result.value)
        : errAsync<T, E>(result.error);
    };

    // Main workflow: create temp dir → read → parse → build config → render → write → cleanup
    const workflow = createTempDir()
      .mapErr((err) => mapFileSystemError(err, { step: "createTempDir" }))
      .andThen((tempDir) => {
        state.tempDir = tempDir;
        logger.debug("Temporary directory created", { tempDir });

        // Read script file
        return readFile(scriptPath)
          .mapErr((err) => mapFileSystemError(err, { step: "readScriptFile", scriptPath }))
          .andThen((scriptBuffer) => {
            const scriptContent = scriptBuffer.toString("utf-8");

            // Parse script (convert Result to ResultAsync)
            const parseResult = parseScript(scriptContent);
            return resultToResultAsync(
              parseResult.mapErr((err) =>
                mapValidationError(err, { step: "parseScript", scriptPath })
              )
            ).andThen((parsedScript) => {
              logger.debug("Script parsed successfully", {
                segmentCount: parsedScript.segments.length,
                speakerCount: parsedScript.speakers.length,
              });

              // Build render config (convert Result to ResultAsync)
              const configResult = buildRenderConfig(parsedScript, audioPath);
              return resultToResultAsync(
                configResult.mapErr((err) =>
                  mapValidationError(err, {
                    step: "buildRenderConfig",
                    audioPath,
                  })
                )
              ).andThen((renderConfig) => {
                logger.debug("Render config built", {
                  composition: renderConfig.composition.id,
                  durationInFrames: renderConfig.composition.durationInFrames,
                });

                // Render video
                return renderVideo(renderConfig)
                  .mapErr((err) => mapRenderError(err, { step: "renderVideo" }))
                  .andThen((renderedPath) => {
                    logger.debug("Video rendered", { renderedPath });

                    // Read rendered file
                    return readFile(renderedPath)
                      .mapErr((err) =>
                        mapFileSystemError(err, { step: "readRenderedFile", renderedPath })
                      )
                      .andThen((videoBuffer) => {
                        // Write to output path
                        return writeFile(outputPath, videoBuffer)
                          .mapErr((err) =>
                            mapFileSystemError(err, { step: "writeOutputFile", outputPath })
                          )
                          .map(() => {
                            const endTime = Date.now();
                            const elapsedSeconds = Math.floor((endTime - startTime) / 1000);

                            logger.info("Video workflow completed", {
                              requestId,
                              outputPath,
                              elapsedTime: `${elapsedSeconds}s`,
                            });

                            return outputPath;
                          });
                      });
                  });
              });
            });
          });
      });

    // Ensure cleanup happens regardless of success or failure
    return workflow
      .andThen((result) => {
        // Cleanup on success
        if (state.tempDir) {
          return cleanupTempDir(state.tempDir)
            .map(() => result)
            .mapErr((cleanupErr) => {
              logger.warn("Failed to cleanup temp directory on success", {
                tempDir: state.tempDir,
                error: cleanupErr.message,
              });
              // Don't fail workflow if cleanup fails on success
              return mapFileSystemError(cleanupErr, { step: "cleanup" });
            })
            .orElse(() => okAsync(result));
        }
        return okAsync(result);
      })
      .orElse((error) => {
        // Cleanup on error
        logger.error("Video workflow failed", error.cause, {
          requestId,
          errorType: error.type,
          errorMessage: error.message,
          context: error.context,
        });

        if (state.tempDir) {
          return cleanupTempDir(state.tempDir)
            .andThen(() => errAsync(error))
            .orElse((cleanupErr) => {
              logger.warn("Failed to cleanup temp directory after error", {
                tempDir: state.tempDir,
                cleanupError: cleanupErr.message,
              });
              // Return original error, not cleanup error
              return errAsync(error);
            });
        }

        return errAsync(error);
      });
  };

  return renderVideoWorkflow;
};
