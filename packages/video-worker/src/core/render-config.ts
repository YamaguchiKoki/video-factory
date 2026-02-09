/**
 * RenderConfigBuilder - Build Remotion rendering configuration
 * Pure function implementation (no side effects, no external dependencies)
 */

import { err, ok, type Result } from "neverthrow";
import { createValidationError, type ValidationError } from "./errors";
import type { ParsedScript, Segment, Speaker } from "./script-types";

/**
 * Remotion composition configuration
 */
export interface CompositionConfig {
  id: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}

/**
 * Input properties for Remotion composition
 */
export interface InputProps {
  audioPath: string;
  segments: Segment[];
  speakers: Speaker[];
  [key: string]: unknown; // Index signature for Remotion compatibility
}

/**
 * Complete Remotion rendering configuration
 */
export interface RenderConfig {
  composition: CompositionConfig;
  inputProps: InputProps;
  codec: "h264";
  crf: number;
  imageFormat: "jpeg";
  timeoutInMilliseconds: number;
  concurrency: number;
  enableMultiProcessOnLinux: boolean;
}

/**
 * Build Remotion rendering configuration from parsed script and audio path
 * @param script - Parsed and validated script data
 * @param audioPath - File path to audio file
 * @returns Result containing RenderConfig or ValidationError
 */
export function buildRenderConfig(
  script: ParsedScript,
  audioPath: string,
): Result<RenderConfig, ValidationError> {
  const { metadata, speakers, segments } = script;

  // Validate durationSeconds is positive
  if (metadata.durationSeconds <= 0) {
    return err(
      createValidationError(
        "SCHEMA_VALIDATION_ERROR",
        `Invalid durationSeconds: must be positive (received: ${metadata.durationSeconds})`,
        null,
        {
          fieldPath: "metadata.durationSeconds",
          value: metadata.durationSeconds,
        },
      ),
    );
  }

  // Calculate duration in frames (30 fps)
  const fps = 30;
  const durationInFrames = Math.ceil(metadata.durationSeconds * fps);

  // Build composition configuration
  const composition: CompositionConfig = {
    id: "RadioVideo",
    width: 1920,
    height: 1080,
    fps,
    durationInFrames,
  };

  // Build input props
  const inputProps: InputProps = {
    audioPath,
    segments,
    speakers,
  };

  // Build complete render configuration
  const renderConfig: RenderConfig = {
    composition,
    inputProps,
    codec: "h264",
    crf: 23,
    imageFormat: "jpeg",
    timeoutInMilliseconds: 900000, // 15 minutes
    concurrency: 2,
    enableMultiProcessOnLinux: true,
  };

  return ok(renderConfig);
}
