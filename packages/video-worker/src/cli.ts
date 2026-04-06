import { randomUUID } from "node:crypto";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, Option } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import { createDockerDeps } from "./deps";
import { parseDockerEnv } from "./env";
import { createRenderVideoWorkflow } from "./service/video-service";

export const DEFAULT_SCRIPT_KEY = "tts-worker/script.json";
export const DEFAULT_AUDIO_KEY = "tts-worker/audio.wav";
export const DEFAULT_OUTPUT_KEY = "video-worker/video.mp4";

// ---------------------------------------------------------------------------
// Flags
// ---------------------------------------------------------------------------

const scriptKeyFlag = Flag.string("script-key").pipe(
  Flag.withDescription(
    `S3 key of the enriched script JSON (default: "${DEFAULT_SCRIPT_KEY}").`,
  ),
  Flag.optional,
);

const audioKeyFlag = Flag.string("audio-key").pipe(
  Flag.withDescription(
    `S3 key of the input WAV file (default: "${DEFAULT_AUDIO_KEY}").`,
  ),
  Flag.optional,
);

const outputKeyFlag = Flag.string("output-key").pipe(
  Flag.withDescription(
    `S3 key for the output MP4 file (default: "${DEFAULT_OUTPUT_KEY}").`,
  ),
  Flag.optional,
);

// ---------------------------------------------------------------------------
// Program
// ---------------------------------------------------------------------------

type CliOptions = {
  readonly scriptKey: string;
  readonly audioKey: string;
  readonly outputKey: string;
};

export const createMainProgram = (opts: CliOptions) =>
  Effect.gen(function* () {
    const env = yield* parseDockerEnv(process.env);

    const deps = createDockerDeps({
      bucket: env.S3_BUCKET,
      requestId: randomUUID(),
    });

    yield* createRenderVideoWorkflow(deps)(
      opts.scriptKey,
      opts.audioKey,
      opts.outputKey,
    );
  });

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

const rootCommand = Command.make("video-worker", {
  scriptKey: scriptKeyFlag,
  audioKey: audioKeyFlag,
  outputKey: outputKeyFlag,
}).pipe(
  Command.withDescription(
    "Render an MP4 video from enriched script + WAV and upload to S3.",
  ),
  Command.withHandler((flags) =>
    createMainProgram({
      scriptKey: Option.getOrElse(flags.scriptKey, () => DEFAULT_SCRIPT_KEY),
      audioKey: Option.getOrElse(flags.audioKey, () => DEFAULT_AUDIO_KEY),
      outputKey: Option.getOrElse(flags.outputKey, () => DEFAULT_OUTPUT_KEY),
    }),
  ),
);

export const main = () =>
  Command.run(rootCommand, { version: "0.0.0" }).pipe(
    Effect.scoped,
    Effect.provide(NodeServices.layer),
    NodeRuntime.runMain,
  );
