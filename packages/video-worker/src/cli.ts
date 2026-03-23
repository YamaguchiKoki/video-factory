import { Command } from "commander";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { parseEnrichedScript } from "./core/enriched-parser";
import {
  readFile,
  createTempDir,
  cleanupTempDir,
  createRenderVideo,
  bundleComposition,
  writeFile,
} from "./infrastructure";
import { createRenderVideoWorkflow } from "./service/video-service";
import { createLogger } from "./infrastructure/logger";
import { createS3Client, downloadToFile, uploadFromFile } from "./infrastructure/s3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const DEFAULT_SCRIPT_KEY = "tts-worker/script.json";
export const DEFAULT_AUDIO_KEY = "tts-worker/audio.wav";
export const DEFAULT_OUTPUT_KEY = "video-worker/video.mp4";

type CliOptions = {
  readonly scriptKey: string;
  readonly audioKey: string;
  readonly outputKey: string;
};

export const createProgram = () =>
  new Command()
    .description("Render video from enriched script and audio")
    .option("--script-key <key>", "S3 key for input enriched script", DEFAULT_SCRIPT_KEY)
    .option("--audio-key <key>", "S3 key for input audio WAV", DEFAULT_AUDIO_KEY)
    .option("--output-key <key>", "S3 key for output video MP4", DEFAULT_OUTPUT_KEY)
    .action(async (opts: CliOptions) => {
      const bucket = process.env["S3_BUCKET"];
      if (!bucket) {
        console.error("S3_BUCKET environment variable is not set");
        process.exit(1);
      }

      const requestId = randomUUID();
      const logger = createLogger(requestId);
      const s3 = createS3Client();

      const tempDirResult = await createTempDir();
      if (tempDirResult.isErr()) {
        console.error("Failed to create temp dir:", tempDirResult.error.message);
        process.exit(1);
      }
      const tempDir = tempDirResult.value;
      const scriptPath = join(tempDir, "script.json");
      const audioPath = join(tempDir, "audio.wav");
      const outputPath = join(tempDir, "video.mp4");

      const downloadScriptResult = await downloadToFile(s3, bucket, opts.scriptKey, scriptPath);
      if (downloadScriptResult.isErr()) {
        console.error(`Failed to download ${opts.scriptKey}:`, downloadScriptResult.error.message);
        process.exit(1);
      }

      const downloadAudioResult = await downloadToFile(s3, bucket, opts.audioKey, audioPath);
      if (downloadAudioResult.isErr()) {
        console.error(`Failed to download ${opts.audioKey}:`, downloadAudioResult.error.message);
        process.exit(1);
      }

      const entryPoint = resolve(__dirname, "remotion/index.ts");
      const publicDir = resolve(__dirname, "../public");
      const renderVideo = createRenderVideo(logger);
      const renderWorkflow = createRenderVideoWorkflow({
        readFile,
        parseEnrichedScript,
        bundleComposition,
        renderVideo,
        writeFile,
        createTempDir,
        cleanupTempDir,
        logger,
        entryPoint,
        publicDir,
      });

      const renderResult = await renderWorkflow(scriptPath, audioPath, outputPath);
      if (renderResult.isErr()) {
        console.error(`Render failed [${renderResult.error.type}]:`, renderResult.error.message);
        await cleanupTempDir(tempDir);
        process.exit(1);
      }

      const uploadResult = await uploadFromFile(s3, bucket, opts.outputKey, outputPath, "video/mp4");
      if (uploadResult.isErr()) {
        console.error(`Failed to upload ${opts.outputKey}:`, uploadResult.error.message);
        await cleanupTempDir(tempDir);
        process.exit(1);
      }

      await cleanupTempDir(tempDir);
      logger.info("Video rendering and upload successful", { outputKey: opts.outputKey });
    });

