import fs from "node:fs/promises";
import path, { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type ResultAsync, fromPromise } from "neverthrow";
import { parseEnrichedScript } from "./core/enriched-parser";
import { createFileSystemError, type FileSystemError } from "./core/errors";
import {
  bundleComposition,
  cleanupTempDir,
  createRenderVideo,
  createTempDir as createTempDirBase,
  readFile,
} from "./infrastructure";
import { createLogger } from "./infrastructure/logger";
import type { S3Error } from "./infrastructure/s3";
import {
  createS3Client,
  downloadToFile,
  uploadFromFile,
} from "./infrastructure/s3";
import type { RenderVideoWorkflowDeps } from "./service/video-service";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PUBLIC_DIR = resolve(__dirname, "../public");

const STATIC_ASSETS = ["left.png", "right.png", "bg.jpeg"] as const;

const toMessage = (e: unknown): string =>
  e instanceof Error ? e.message : String(e);

const copyStaticAssets = (
  destDir: string,
): ResultAsync<void, FileSystemError> =>
  fromPromise(
    Promise.all(
      STATIC_ASSETS.map((file) =>
        fs.copyFile(path.join(PUBLIC_DIR, file), path.join(destDir, file)),
      ),
    ).then(() => undefined),
    (e): FileSystemError =>
      createFileSystemError(
        "IO_ERROR",
        `Failed to copy static assets: ${toMessage(e)}`,
        e instanceof Error ? e : null,
        { destDir },
      ),
  );

const createTempDirWithAssets = (): ResultAsync<string, FileSystemError> =>
  createTempDirBase().andThen((tempDir) =>
    copyStaticAssets(tempDir).map(() => tempDir),
  );

type DockerDepsConfig = {
  readonly bucket: string;
  readonly requestId: string;
};

export const createDockerDeps = (
  config: DockerDepsConfig,
): RenderVideoWorkflowDeps => {
  const logger = createLogger(config.requestId);
  const s3 = createS3Client({
    S3_ENDPOINT_URL: process.env.S3_ENDPOINT_URL,
    S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
  });
  const entryPoint = resolve(__dirname, "remotion/index.ts");
  const renderVideo = createRenderVideo(logger);

  return {
    readFile,
    parseEnrichedScript,
    bundleComposition,
    renderVideo,
    downloadFromS3: (key, destPath) =>
      downloadToFile(s3, config.bucket, key, destPath),
    uploadToS3: (key, srcPath, contentType) =>
      uploadFromFile(s3, config.bucket, key, srcPath, contentType),
    createTempDir: createTempDirWithAssets,
    cleanupTempDir,
    logger,
    entryPoint,
  };
};

type LocalDepsConfig = {
  readonly requestId: string;
};

export const createLocalDeps = (
  config: LocalDepsConfig,
): RenderVideoWorkflowDeps => {
  const logger = createLogger(config.requestId);
  const entryPoint = resolve(__dirname, "remotion/index.ts");
  const renderVideo = createRenderVideo(logger);

  return {
    readFile,
    parseEnrichedScript,
    bundleComposition,
    renderVideo,
    downloadFromS3: (key, destPath) =>
      fromPromise(
        fs.copyFile(key, destPath),
        (e): S3Error => ({ type: "GET_OBJECT_ERROR", message: toMessage(e) }),
      ),
    uploadToS3: (outputKey, srcPath) =>
      fromPromise(
        fs.copyFile(srcPath, outputKey),
        (e): S3Error => ({ type: "PUT_OBJECT_ERROR", message: toMessage(e) }),
      ),
    createTempDir: createTempDirBase,
    cleanupTempDir,
    logger,
    entryPoint,
  };
};
