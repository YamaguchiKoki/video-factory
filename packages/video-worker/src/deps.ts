import fs from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fromPromise } from "neverthrow";
import { parseEnrichedScript } from "./core/enriched-parser";
import {
  readFile,
  createTempDir,
  cleanupTempDir,
  createRenderVideo,
  bundleComposition,
} from "./infrastructure";
import { createLogger } from "./infrastructure/logger";
import { createS3Client, downloadToFile, uploadFromFile } from "./infrastructure/s3";
import type { S3Error } from "./infrastructure/s3";
import type { RenderVideoWorkflowDeps } from "./service/video-service";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const toMessage = (e: unknown): string =>
  e instanceof Error ? e.message : String(e);

type DockerDepsConfig = {
  readonly bucket: string;
  readonly requestId: string;
};

export const createDockerDeps = (config: DockerDepsConfig): RenderVideoWorkflowDeps => {
  const logger = createLogger(config.requestId);
  const s3 = createS3Client();
  const entryPoint = resolve(__dirname, "remotion/index.ts");
  const renderVideo = createRenderVideo(logger);

  return {
    readFile,
    parseEnrichedScript,
    bundleComposition,
    renderVideo,
    downloadFromS3: (key, destPath) => downloadToFile(s3, config.bucket, key, destPath),
    uploadToS3: (key, srcPath, contentType) => uploadFromFile(s3, config.bucket, key, srcPath, contentType),
    createTempDir,
    cleanupTempDir,
    logger,
    entryPoint,
  };
};

type LocalDepsConfig = {
  readonly requestId: string;
};

export const createLocalDeps = (config: LocalDepsConfig): RenderVideoWorkflowDeps => {
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
    createTempDir,
    cleanupTempDir,
    logger,
    entryPoint,
  };
};
