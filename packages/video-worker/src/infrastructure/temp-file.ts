/**
 * Temporary file management (Infrastructure Layer)
 * Provides functions for creating and cleaning up temporary directories
 */

import { ResultAsync } from "neverthrow";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import {
  createFileSystemError,
  type FileSystemError,
} from "../core/errors";

/**
 * Determine FileSystemError type from Node.js error code
 * @param error - Error from fs operation
 * @returns FileSystemError type
 */
const getErrorType = (error: unknown): FileSystemError["type"] => {
  if (error instanceof Error && "code" in error) {
    const code = (error as NodeJS.ErrnoException).code;
    switch (code) {
      case "EACCES":
      case "EPERM":
        return "PERMISSION_DENIED";
      case "ENOSPC":
        return "DISK_FULL";
      default:
        return "IO_ERROR";
    }
  }
  return "IO_ERROR";
};

/**
 * Create a temporary directory with unique UUID
 * @returns ResultAsync containing directory path or FileSystemError
 */
export const createTempDir = (): ResultAsync<string, FileSystemError> => {
  const dirPath = join(tmpdir(), `video-worker-${randomUUID()}`);

  return ResultAsync.fromPromise(
    mkdir(dirPath, { recursive: true }).then(() => dirPath),
    (error) => {
      const errorType = getErrorType(error);
      return createFileSystemError(
        errorType,
        `Failed to create temporary directory: ${error instanceof Error ? error.message : "Unknown error"}`,
        error instanceof Error ? error : null,
        { path: dirPath },
      );
    },
  );
};

/**
 * Clean up temporary directory (recursive deletion)
 * Idempotent - safe to call multiple times, succeeds even if directory doesn't exist
 * @param path - Directory path to delete
 * @returns ResultAsync indicating success or FileSystemError
 */
export const cleanupTempDir = (
  path: string,
): ResultAsync<void, FileSystemError> =>
  ResultAsync.fromPromise(
    rm(path, { recursive: true, force: true }),
    (error) => {
      const errorType = getErrorType(error);
      return createFileSystemError(
        errorType,
        `Failed to cleanup temporary directory: ${error instanceof Error ? error.message : "Unknown error"}`,
        error instanceof Error ? error : null,
        { path },
      );
    },
  );
