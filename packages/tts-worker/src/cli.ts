import { Command } from "commander";
import { runPipeline } from "./pipeline.js";
import { getScriptFromS3, uploadEnrichedScriptToS3, uploadWavToS3 } from "./s3.js";
import type { StorageDeps } from "./storage.js";

export const DEFAULT_INPUT_KEY = "script-generator/script.json";
export const DEFAULT_OUTPUT_WAV_KEY = "tts-worker/audio.wav";
export const DEFAULT_OUTPUT_SCRIPT_KEY = "tts-worker/script.json";

export const createDockerStorage = (bucket: string, outputWavKey: string): StorageDeps => ({
  getScript: (key) => getScriptFromS3(bucket, key),
  uploadWav: (key, data) => uploadWavToS3(bucket, key, data),
  buildOutputKey: (_date, _title) => outputWavKey,
});

type CliOptions = {
  readonly inputKey: string;
  readonly outputWavKey: string;
  readonly outputScriptKey: string;
};

export const createProgram = () =>
  new Command()
    .description("Convert script to speech audio via VOICEVOX")
    .option("--input-key <key>", "S3 key for input script JSON", DEFAULT_INPUT_KEY)
    .option("--output-wav-key <key>", "S3 key for output WAV", DEFAULT_OUTPUT_WAV_KEY)
    .option("--output-script-key <key>", "S3 key for output enriched script", DEFAULT_OUTPUT_SCRIPT_KEY)
    .action(async (opts: CliOptions) => {
      const bucket = process.env["S3_BUCKET"];
      if (!bucket) {
        console.error("S3_BUCKET environment variable is not set");
        process.exit(1);
      }

      const storage = createDockerStorage(bucket, opts.outputWavKey);

      const pipelineResult = await runPipeline(storage, opts.inputKey);
      if (pipelineResult.isErr()) {
        console.error(`Pipeline failed: [${pipelineResult.error.type}] ${pipelineResult.error.message}`);
        process.exit(1);
      }

      const enrichedScript = pipelineResult.value;

      const uploadResult = await uploadEnrichedScriptToS3(bucket, opts.outputScriptKey, enrichedScript);
      if (uploadResult.isErr()) {
        console.error(`Upload failed: [${uploadResult.error.type}] ${uploadResult.error.message}`);
        process.exit(1);
      }
    });

