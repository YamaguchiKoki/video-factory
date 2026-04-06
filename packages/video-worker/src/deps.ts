import fs from "node:fs/promises";
import path, { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { toMessage } from "@video-factory/shared";
import { Effect } from "effect";
import { parseEnrichedScript } from "./core/enriched-parser";
import { FileSystemError, S3DownloadError, S3UploadError } from "./core/errors";
import {
  bundleComposition,
  cleanupTempDir,
  createRenderVideo,
  createTempDir as createTempDirBase,
  readFile,
} from "./infrastructure";
import { createLogger } from "./infrastructure/logger";
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

const copyStaticAssets = (
  destDir: string,
): Effect.Effect<void, FileSystemError> =>
  Effect.tryPromise({
    try: () =>
      Promise.all(
        STATIC_ASSETS.map((file) =>
          fs.copyFile(path.join(PUBLIC_DIR, file), path.join(destDir, file)),
        ),
      ).then(() => undefined),
    catch: (e): FileSystemError =>
      new FileSystemError({
        message: `Failed to copy static assets: ${toMessage(e)}`,
        cause: e instanceof Error ? e : undefined,
      }),
  });

const createTempDirWithAssets = (): Effect.Effect<string, FileSystemError> =>
  createTempDirBase().pipe(
    Effect.flatMap((tempDir) =>
      copyStaticAssets(tempDir).pipe(Effect.map(() => tempDir)),
    ),
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
      Effect.tryPromise({
        try: () => fs.copyFile(key, destPath),
        catch: (e): S3DownloadError =>
          new S3DownloadError({
            message: `Failed to copy file: ${toMessage(e)}`,
            cause: e instanceof Error ? e : undefined,
          }),
      }),
    uploadToS3: (outputKey, srcPath) =>
      Effect.tryPromise({
        try: () => fs.copyFile(srcPath, outputKey),
        catch: (e): S3UploadError =>
          new S3UploadError({
            message: `Failed to copy file: ${toMessage(e)}`,
            cause: e instanceof Error ? e : undefined,
          }),
      }),
    createTempDir: createTempDirBase,
    cleanupTempDir,
    logger,
    entryPoint,
  };
};
