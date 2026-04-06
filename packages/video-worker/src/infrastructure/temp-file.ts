import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isNodeError, toMessage } from "@video-factory/shared";
import { Effect } from "effect";
import { FileSystemError } from "../core/errors";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const toFileSystemError =
  (operation: string, _path: string) =>
  (error: unknown): FileSystemError => {
    const message = `Failed to ${operation}: ${toMessage(error)}`;
    if (isNodeError(error)) {
      if (error.code === "EACCES" || error.code === "EPERM") {
        return new FileSystemError({ message, cause: error });
      }
    }
    return new FileSystemError({
      message,
      cause: error instanceof Error ? error : undefined,
    });
  };

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const createTempDir = (): Effect.Effect<string, FileSystemError> => {
  const dirPath = join(tmpdir(), `video-worker-${randomUUID()}`);
  return Effect.tryPromise({
    try: () => mkdir(dirPath, { recursive: true }).then(() => dirPath),
    catch: toFileSystemError("create temporary directory", dirPath),
  });
};

export const cleanupTempDir = (
  path: string,
): Effect.Effect<void, FileSystemError> =>
  Effect.tryPromise({
    try: () => rm(path, { recursive: true, force: true }),
    catch: toFileSystemError("cleanup temporary directory", path),
  });
