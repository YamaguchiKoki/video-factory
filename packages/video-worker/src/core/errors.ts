import { Schema } from "effect";

// ============================================
// FileSystem Errors
// ============================================

export class FileSystemError extends Schema.TaggedErrorClass<FileSystemError>()(
  "FileSystemError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Defect),
  },
) {}

// ============================================
// Validation Errors
// ============================================

export class ValidationError extends Schema.TaggedErrorClass<ValidationError>()(
  "ValidationError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Defect),
  },
) {}

// ============================================
// Render Errors
// ============================================

export class RenderError extends Schema.TaggedErrorClass<RenderError>()(
  "RenderError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Defect),
  },
) {}

// ============================================
// S3 Errors
// ============================================

export class S3DownloadError extends Schema.TaggedErrorClass<S3DownloadError>()(
  "S3DownloadError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Defect),
  },
) {}

export class S3UploadError extends Schema.TaggedErrorClass<S3UploadError>()(
  "S3UploadError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Defect),
  },
) {}

// ============================================
// Env Errors
// ============================================

export { EnvValidationError } from "@video-factory/shared";
