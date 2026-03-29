/**
 * File system operations (Infrastructure Layer)
 * Wraps Node.js fs operations with neverthrow Result type
 */

import { constants } from "node:fs";
import {
  access,
  readFile as fsReadFile,
  writeFile as fsWriteFile,
} from "node:fs/promises";
import { ResultAsync } from "neverthrow";
import { createFileSystemError, type FileSystemError } from "../core/errors";

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
 * Read file content from file system
 * @param path - File path to read
 * @returns ResultAsync containing Buffer or FileSystemError
 */
export const readFile = (path: string): ResultAsync<Buffer, FileSystemError> =>
  ResultAsync.fromPromise(fsReadFile(path), (error) => {
    const errorType = getErrorType(error);
    return createFileSystemError(
      errorType,
      `Failed to read file: ${error instanceof Error ? error.message : "Unknown error"}`,
      error instanceof Error ? error : null,
      { path },
    );
  });

/**
 * Write file content to file system
 * @param path - File path to write
 * @param data - Buffer data to write
 * @returns ResultAsync indicating success or FileSystemError
 */
export const writeFile = (
  path: string,
  data: Buffer,
): ResultAsync<void, FileSystemError> =>
  ResultAsync.fromPromise(fsWriteFile(path, data), (error) => {
    const errorType = getErrorType(error);
    return createFileSystemError(
      errorType,
      `Failed to write file: ${error instanceof Error ? error.message : "Unknown error"}`,
      error instanceof Error ? error : null,
      { path },
    );
  });

/**
 * Check if file exists at given path
 * @param path - File path to check
 * @returns ResultAsync containing boolean or FileSystemError
 */
export const fileExists = (
  path: string,
): ResultAsync<boolean, FileSystemError> =>
  ResultAsync.fromPromise(
    access(path, constants.F_OK)
      .then(() => true)
      .catch((error) => {
        // ENOENT means file does not exist - this is not an error case
        if (error.code === "ENOENT") {
          return false;
        }
        // Other errors should be thrown and handled by outer catch
        throw error;
      }),
    (error) => {
      const errorType = getErrorType(error);
      return createFileSystemError(
        errorType,
        `Failed to check file existence: ${error instanceof Error ? error.message : "Unknown error"}`,
        error instanceof Error ? error : null,
        { path },
      );
    },
  );
