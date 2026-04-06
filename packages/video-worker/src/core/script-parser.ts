/**
 * ScriptParser - Parse and validate script JSON files
 * Pure function implementation (no side effects)
 */

import { Result, Schema } from "effect";
import type { z } from "zod";
import { type ParsedScript, parsedScriptSchema } from "./script-types";

class ScriptParseError extends Schema.TaggedErrorClass<ScriptParseError>()(
  "ScriptParseError",
  {
    type: Schema.Literals([
      "JSON_PARSE_ERROR",
      "SCHEMA_VALIDATION_ERROR",
      "TIMESTAMP_ERROR",
    ]),
    message: Schema.String,
  },
) {}

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
 * Parse JSON string
 * @param jsonContent - Raw JSON string
 * @returns Result containing parsed JSON or ScriptParseError
 */
function parseJson(
  jsonContent: string,
): Result.Result<unknown, ScriptParseError> {
  return Result.try({
    try: () => JSON.parse(jsonContent) as unknown,
    catch: (e) =>
      new ScriptParseError({
        type: "JSON_PARSE_ERROR",
        message: `Invalid JSON format: ${e instanceof Error ? e.message : "Unknown error"}`,
      }),
  });
}

/**
 * Validate script against Zod schema
 * @param jsonData - Parsed JSON data
 * @returns Result containing ParsedScript or ScriptParseError
 */
function validateSchema(
  jsonData: unknown,
): Result.Result<ParsedScript, ScriptParseError> {
  const schemaResult = parsedScriptSchema.safeParse(jsonData);

  if (!schemaResult.success) {
    const zodError = schemaResult.error;
    const firstIssue = zodError.issues[0];

    // Check if this is a timestamp error (startTime >= endTime)
    if (
      firstIssue.path.includes("endTime") &&
      firstIssue.message.includes("Start time must be less than end time")
    ) {
      return Result.fail(
        new ScriptParseError({
          type: "TIMESTAMP_ERROR",
          message: firstIssue.message,
        }),
      );
    }

    return Result.fail(
      new ScriptParseError({
        type: "SCHEMA_VALIDATION_ERROR",
        message: formatZodError(zodError),
      }),
    );
  }

  return Result.succeed(schemaResult.data);
}

/**
 * Validate that all segment speakerIds reference existing speakers
 * @param script - Parsed script
 * @returns Result indicating success or ScriptParseError
 */
function validateSpeakerReferences(
  script: ParsedScript,
): Result.Result<void, ScriptParseError> {
  const speakerIds = new Set(script.speakers.map((s) => s.id));

  for (const segment of script.segments) {
    if (!speakerIds.has(segment.speakerId)) {
      return Result.fail(
        new ScriptParseError({
          type: "SCHEMA_VALIDATION_ERROR",
          message: `Segment references non-existent speaker: ${segment.speakerId}`,
        }),
      );
    }
  }

  return Result.succeed(undefined);
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
 * @returns Result indicating success or ScriptParseError
 */
function validateTimestampConsistency(
  sortedSegments: ParsedScript["segments"],
): Result.Result<void, ScriptParseError> {
  // Create pairs of adjacent segments for validation
  const segmentPairs = sortedSegments.slice(0, -1).map((current, index) => ({
    current,
    next: sortedSegments[index + 1],
  }));

  for (const { current, next } of segmentPairs) {
    // Check for overlap: current.endTime > next.startTime
    if (current.endTime > next.startTime) {
      return Result.fail(
        new ScriptParseError({
          type: "TIMESTAMP_ERROR",
          message: `Segments overlap: segment '${current.id}' (${current.startTime}-${current.endTime}) overlaps with segment '${next.id}' (${next.startTime}-${next.endTime})`,
        }),
      );
    }
  }

  return Result.succeed(undefined);
}

/**
 * Parse a JSON string and validate it against the script schema
 * @param jsonContent - Raw JSON string containing script data
 * @returns Result containing ParsedScript or ScriptParseError
 */
export function parseScript(
  jsonContent: string,
): Result.Result<ParsedScript, ScriptParseError> {
  // Step 1: Parse JSON
  const parseResult = parseJson(jsonContent);
  if (Result.isFailure(parseResult)) {
    return Result.fail(parseResult.failure);
  }

  // Step 2: Validate schema using Zod
  const schemaResult = validateSchema(parseResult.success);
  if (Result.isFailure(schemaResult)) {
    return Result.fail(schemaResult.failure);
  }

  const parsedScript = schemaResult.success;

  // Step 3: Validate speaker reference integrity
  const speakerValidation = validateSpeakerReferences(parsedScript);
  if (Result.isFailure(speakerValidation)) {
    return Result.fail(speakerValidation.failure);
  }

  // Step 4: Sort segments and validate timestamp consistency
  const sortedSegments = sortSegmentsByStartTime(parsedScript.segments);
  const timestampValidation = validateTimestampConsistency(sortedSegments);
  if (Result.isFailure(timestampValidation)) {
    return Result.fail(timestampValidation.failure);
  }

  // Step 5: Return sorted script
  return Result.succeed({
    ...parsedScript,
    segments: sortedSegments,
  });
}
