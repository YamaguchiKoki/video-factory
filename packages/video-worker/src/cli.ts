import { Command } from "commander";
import { randomUUID } from "node:crypto";
import { createRenderVideoWorkflow } from "./service/video-service";
import { createDockerDeps } from "./deps";
import { parseDockerEnv } from "./env";
import { handleResult } from "./run-entrypoint";

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
      const envResult = parseDockerEnv(process.env);
      if (envResult.isErr()) {
        console.error(envResult.error.message);
        process.exit(1);
        return;
      }

      const deps = createDockerDeps({ bucket: envResult.value.S3_BUCKET, requestId: randomUUID() });
      const renderWorkflow = createRenderVideoWorkflow(deps);
      const result = await renderWorkflow(opts.scriptKey, opts.audioKey, opts.outputKey);

      handleResult(result);

      deps.logger.info("Video rendering and upload successful", { outputKey: opts.outputKey });
    });
