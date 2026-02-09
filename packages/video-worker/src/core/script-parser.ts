/**
 * ScriptParser - Parse and validate script JSON files
 * Pure function implementation (no side effects)
 */

import { err, fromThrowable, ok, type Result } from "neverthrow";
import type { z } from "zod";
import { createValidationError, type ValidationError } from "./errors";
import { type ParsedScript, parsedScriptSchema } from "./script-types";

/**
 * Safe JSON parser wrapped with fromThrowable
 */
const safeJsonParse = fromThrowable(JSON.parse, (error) =>
  createValidationError(
    "JSON_PARSE_ERROR",
    `Invalid JSON format: ${error instanceof Error ? error.message : "Unknown error"}`,
    error instanceof Error ? error : null,
    {},
  ),
);

/**
 * Parse JSON string
 * @param jsonContent - Raw JSON string
 * @returns Result containing parsed JSON or ValidationError
 */
function parseJson(jsonContent: string): Result<unknown, ValidationError> {
  return safeJsonParse(jsonContent);
}

/**
 * Format Zod validation errors into human-readable messages
 * @param error - Zod error object
 * @returns Formatted error message
 */
function formatZodError(error: z.ZodError): string {
  const messages = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return `${path}${issue.message}`;
  });

  return messages.join("; ");
}

/**
 * Validate script against Zod schema
 * @param jsonData - Parsed JSON data
 * @returns Result containing ParsedScript or ValidationError
 */
function validateSchema(
  jsonData: unknown,
): Result<ParsedScript, ValidationError> {
  const schemaResult = parsedScriptSchema.safeParse(jsonData);

  if (!schemaResult.success) {
    const zodError = schemaResult.error;
    const firstIssue = zodError.issues[0];

    // Check if this is a timestamp error (startTime >= endTime)
    if (
      firstIssue.path.includes("endTime") &&
      firstIssue.message.includes("Start time must be less than end time")
    ) {
      return err(
        createValidationError("TIMESTAMP_ERROR", firstIssue.message, null, {
          fieldPath: firstIssue.path.join("."),
        }),
      );
    }

    return err(
      createValidationError(
        "SCHEMA_VALIDATION_ERROR",
        formatZodError(zodError),
        null,
        { fieldPath: firstIssue.path.join(".") },
      ),
    );
  }

  return ok(schemaResult.data);
}

/**
 * Validate that all segment speakerIds reference existing speakers
 * @param script - Parsed script
 * @returns Result indicating success or ValidationError
 */
function validateSpeakerReferences(
  script: ParsedScript,
): Result<void, ValidationError> {
  const speakerIds = new Set(script.speakers.map((s) => s.id));

  for (const segment of script.segments) {
    if (!speakerIds.has(segment.speakerId)) {
      return err(
        createValidationError(
          "SCHEMA_VALIDATION_ERROR",
          `Segment references non-existent speaker: ${segment.speakerId}`,
          null,
          {
            fieldPath: `segments[${segment.id}].speakerId`,
            speakerId: segment.speakerId,
          },
        ),
      );
    }
  }

  return ok(undefined);
}

/**
 * Sort segments by startTime in ascending order
 * @param segments - Array of segments
 * @returns Sorted array of segments
 */
function sortSegmentsByStartTime(
  segments: ParsedScript["segments"],
): ParsedScript["segments"] {
  return [...segments].sort((a, b) => a.startTime - b.startTime);
}

/**
 * Validate that segments do not overlap
 * @param sortedSegments - Segments sorted by startTime
 * @returns Result indicating success or ValidationError
 */
function validateTimestampConsistency(
  sortedSegments: ParsedScript["segments"],
): Result<void, ValidationError> {
  // Create pairs of adjacent segments for validation
  const segmentPairs = sortedSegments.slice(0, -1).map((current, index) => ({
    current,
    next: sortedSegments[index + 1],
  }));

  for (const { current, next } of segmentPairs) {
    // Check for overlap: current.endTime > next.startTime
    if (current.endTime > next.startTime) {
      return err(
        createValidationError(
          "TIMESTAMP_ERROR",
          `Segments overlap: segment '${current.id}' (${current.startTime}-${current.endTime}) overlaps with segment '${next.id}' (${next.startTime}-${next.endTime})`,
          null,
          {
            fieldPath: `segments[${next.id}].startTime`,
            currentSegment: {
              id: current.id,
              startTime: current.startTime,
              endTime: current.endTime,
            },
            nextSegment: {
              id: next.id,
              startTime: next.startTime,
              endTime: next.endTime,
            },
          },
        ),
      );
    }
  }

  return ok(undefined);
}

/**
 * Parse a JSON string and validate it against the script schema
 * @param jsonContent - Raw JSON string containing script data
 * @returns Result containing ParsedScript or ValidationError
 */
export function parseScript(
  jsonContent: string,
): Result<ParsedScript, ValidationError> {
  // Step 1: Parse JSON
  const parseResult = parseJson(jsonContent);
  if (parseResult.isErr()) {
    return err(parseResult.error);
  }

  // Step 2: Validate schema using Zod
  const schemaResult = validateSchema(parseResult.value);
  if (schemaResult.isErr()) {
    return err(schemaResult.error);
  }

  const parsedScript = schemaResult.value;

  // Step 3: Validate speaker reference integrity
  const speakerValidation = validateSpeakerReferences(parsedScript);
  if (speakerValidation.isErr()) {
    return err(speakerValidation.error);
  }

  // Step 4: Sort segments and validate timestamp consistency
  const sortedSegments = sortSegmentsByStartTime(parsedScript.segments);
  const timestampValidation = validateTimestampConsistency(sortedSegments);
  if (timestampValidation.isErr()) {
    return err(timestampValidation.error);
  }

  // Step 5: Return sorted script
  return ok({
    ...parsedScript,
    segments: sortedSegments,
  });
}
