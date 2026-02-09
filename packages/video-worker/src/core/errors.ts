/**
 * Domain error types for Video Worker
 * All errors follow Railway Oriented Programming pattern with Result<T, E>
 */

/**
 * Validation error types for script parsing and schema validation
 */
export type ValidationErrorType =
  | 'JSON_PARSE_ERROR'
  | 'SCHEMA_VALIDATION_ERROR'
  | 'TIMESTAMP_ERROR';

export interface ValidationError {
  type: ValidationErrorType;
  message: string;
  cause: Error | null;
  context: Record<string, unknown>;
}

/**
 * S3 download error types
 */
export type S3DownloadErrorType =
  | 'S3_NOT_FOUND'
  | 'S3_ACCESS_DENIED'
  | 'S3_NETWORK_ERROR';

export interface S3DownloadError {
  type: S3DownloadErrorType;
  message: string;
  cause: Error | null;
  context: Record<string, unknown>;
}

/**
 * Remotion rendering error types
 */
export type RenderErrorType = 'RENDER_TIMEOUT' | 'RENDER_FAILED' | 'BROWSER_ERROR';

export interface RenderError {
  type: RenderErrorType;
  message: string;
  cause: Error | null;
  context: Record<string, unknown>;
}

/**
 * File system operation error types
 */
export type FileSystemErrorType = 'DISK_FULL' | 'PERMISSION_DENIED' | 'IO_ERROR';

export interface FileSystemError {
  type: FileSystemErrorType;
  message: string;
  cause: Error | null;
  context: Record<string, unknown>;
}

/**
 * Helper function to create ValidationError
 */
export function createValidationError(
  type: ValidationErrorType,
  message: string,
  cause: Error | null,
  context: Record<string, unknown>
): ValidationError {
  return { type, message, cause, context };
}

/**
 * Helper function to create S3DownloadError
 */
export function createS3DownloadError(
  type: S3DownloadErrorType,
  message: string,
  cause: Error | null,
  context: Record<string, unknown>
): S3DownloadError {
  return { type, message, cause, context };
}

/**
 * Helper function to create RenderError
 */
export function createRenderError(
  type: RenderErrorType,
  message: string,
  cause: Error | null,
  context: Record<string, unknown>
): RenderError {
  return { type, message, cause, context };
}

/**
 * Helper function to create FileSystemError
 */
export function createFileSystemError(
  type: FileSystemErrorType,
  message: string,
  cause: Error | null,
  context: Record<string, unknown>
): FileSystemError {
  return { type, message, cause, context };
}
