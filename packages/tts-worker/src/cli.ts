import { Command } from "commander";
import { runPipeline } from "./pipeline.js";
import { createDockerStorage } from "./s3.js";
import { parseDockerEnv } from "./env.js";
import { handleResult } from "./run-entrypoint.js";

export const DEFAULT_INPUT_KEY = "script-generator/script.json";
export const DEFAULT_OUTPUT_WAV_KEY = "tts-worker/audio.wav";
export const DEFAULT_OUTPUT_SCRIPT_KEY = "tts-worker/script.json";

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
      const envResult = parseDockerEnv(process.env);
      if (envResult.isErr()) {
        console.error(envResult.error.message);
        process.exit(1);
        return;
      }

      const storage = createDockerStorage(envResult.value.S3_BUCKET, opts.outputWavKey, opts.outputScriptKey);

      const pipelineResult = await runPipeline(storage, opts.inputKey);
      handleResult(pipelineResult);
    });
