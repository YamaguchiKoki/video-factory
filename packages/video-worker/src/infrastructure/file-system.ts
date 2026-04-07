import { constants } from "node:fs";
import {
  access,
  readFile as fsReadFile,
  writeFile as fsWriteFile,
} from "node:fs/promises";
import { isNodeError, toMessage } from "@video-factory/shared";
import { Effect } from "effect";
import { FileSystemError } from "../core/errors";

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
// Functions
// ---------------------------------------------------------------------------

export const readFile = (
  path: string,
): Effect.Effect<Buffer, FileSystemError> =>
  Effect.tryPromise({
    try: () => fsReadFile(path),
    catch: toFileSystemError("read file", path),
  });

export const writeFile = (
  path: string,
  data: Buffer,
): Effect.Effect<void, FileSystemError> =>
  Effect.tryPromise({
    try: () => fsWriteFile(path, data),
    catch: toFileSystemError("write file", path),
  });

export const fileExists = (
  path: string,
): Effect.Effect<boolean, FileSystemError> =>
  Effect.tryPromise({
    try: () =>
      access(path, constants.F_OK)
        .then(() => true)
        .catch((error: NodeJS.ErrnoException) => {
          if (error.code === "ENOENT") {
            return false;
          }
          throw error;
        }),
    catch: toFileSystemError("check file existence", path),
  });
