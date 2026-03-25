/**
 * Domain error types for Video Worker
 * All errors follow Railway Oriented Programming pattern with Result<T, E>
 */

type DomainError<T extends string> = {
  readonly type: T;
  readonly message: string;
  readonly cause: Error | null;
  readonly context: Record<string, unknown>;
};

const createDomainError = <T extends string>(
  type: T,
  message: string,
  cause: Error | null,
  context: Record<string, unknown>,
): DomainError<T> => ({ type, message, cause, context });

/**
 * Validation error types for script parsing and schema validation
 */
export type ValidationErrorType =
  | "JSON_PARSE_ERROR"
  | "SCHEMA_VALIDATION_ERROR"
  | "TIMESTAMP_ERROR";

export type ValidationError = DomainError<ValidationErrorType>;

export const createValidationError = (
  type: ValidationErrorType,
  message: string,
  cause: Error | null,
  context: Record<string, unknown>,
): ValidationError => createDomainError(type, message, cause, context);

/**
 * S3 download error types
 */
export type S3DownloadErrorType =
  | "S3_NOT_FOUND"
  | "S3_ACCESS_DENIED"
  | "S3_NETWORK_ERROR";

export type S3DownloadError = DomainError<S3DownloadErrorType>;

export const createS3DownloadError = (
  type: S3DownloadErrorType,
  message: string,
  cause: Error | null,
  context: Record<string, unknown>,
): S3DownloadError => createDomainError(type, message, cause, context);

/**
 * Remotion rendering error types
 */
export type RenderErrorType =
  | "RENDER_TIMEOUT"
  | "RENDER_FAILED"
  | "BROWSER_ERROR";

export type RenderError = DomainError<RenderErrorType>;

export const createRenderError = (
  type: RenderErrorType,
  message: string,
  cause: Error | null,
  context: Record<string, unknown>,
): RenderError => createDomainError(type, message, cause, context);

/**
 * File system operation error types
 */
export type FileSystemErrorType =
  | "DISK_FULL"
  | "PERMISSION_DENIED"
  | "IO_ERROR";

export type FileSystemError = DomainError<FileSystemErrorType>;

export const createFileSystemError = (
  type: FileSystemErrorType,
  message: string,
  cause: Error | null,
  context: Record<string, unknown>,
): FileSystemError => createDomainError(type, message, cause, context);

/**
 * VideoService error types (high-level workflow errors)
 */
export type VideoServiceErrorType =
  | "FILE_READ_ERROR"
  | "VALIDATION_ERROR"
  | "RENDER_ERROR"
  | "FILE_WRITE_ERROR";

export type VideoServiceError = DomainError<VideoServiceErrorType>;

export const createVideoServiceError = (
  type: VideoServiceErrorType,
  message: string,
  cause: Error | null,
  context: Record<string, unknown>,
): VideoServiceError => createDomainError(type, message, cause, context);
