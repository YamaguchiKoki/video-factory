import { Schema } from "effect";

// ============================================
// Voicevox Errors
// ============================================

export class AudioQueryError extends Schema.TaggedErrorClass<AudioQueryError>()(
  "AudioQueryError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Defect),
  },
) {}

export class SynthesisError extends Schema.TaggedErrorClass<SynthesisError>()(
  "SynthesisError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Defect),
  },
) {}

export type VoicevoxError = AudioQueryError | SynthesisError;

// ============================================
// WAV Errors
// ============================================

export class InvalidHeaderError extends Schema.TaggedErrorClass<InvalidHeaderError>()(
  "InvalidHeaderError",
  {
    message: Schema.String,
  },
) {}

export class FormatMismatchError extends Schema.TaggedErrorClass<FormatMismatchError>()(
  "FormatMismatchError",
  {
    message: Schema.String,
  },
) {}

export class EmptyInputError extends Schema.TaggedErrorClass<EmptyInputError>()(
  "EmptyInputError",
  {
    message: Schema.String,
  },
) {}

export type WavError =
  | InvalidHeaderError
  | FormatMismatchError
  | EmptyInputError;

// ============================================
// S3 Errors
// ============================================

export class S3GetObjectError extends Schema.TaggedErrorClass<S3GetObjectError>()(
  "S3GetObjectError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Defect),
  },
) {}

export class S3PutObjectError extends Schema.TaggedErrorClass<S3PutObjectError>()(
  "S3PutObjectError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Defect),
  },
) {}

export class S3ValidationError extends Schema.TaggedErrorClass<S3ValidationError>()(
  "S3ValidationError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Defect),
  },
) {}

export type S3Error = S3GetObjectError | S3PutObjectError | S3ValidationError;

// ============================================
// Env Error
// ============================================

export { EnvValidationError } from "@video-factory/shared";
