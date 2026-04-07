import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, Layer, Option } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import { parseDockerEnv } from "./env.js";
import { runPipeline } from "./pipeline.js";
import { createStorageServiceLive } from "./s3.js";
import { VoicevoxServiceLive } from "./voicevox.js";

export const DEFAULT_INPUT_KEY = "script-generator/script.json";
export const DEFAULT_OUTPUT_WAV_KEY = "tts-worker/audio.wav";
export const DEFAULT_OUTPUT_SCRIPT_KEY = "tts-worker/script.json";

// ---------------------------------------------------------------------------
// Flags
// ---------------------------------------------------------------------------

const inputKeyFlag = Flag.string("input-key").pipe(
  Flag.withDescription(
    `S3 key of the input script JSON (default: "${DEFAULT_INPUT_KEY}").`,
  ),
  Flag.optional,
);

const outputWavKeyFlag = Flag.string("output-wav-key").pipe(
  Flag.withDescription(
    `S3 key for the output WAV file (default: "${DEFAULT_OUTPUT_WAV_KEY}").`,
  ),
  Flag.optional,
);

const outputScriptKeyFlag = Flag.string("output-script-key").pipe(
  Flag.withDescription(
    `S3 key for the output enriched script JSON (default: "${DEFAULT_OUTPUT_SCRIPT_KEY}").`,
  ),
  Flag.optional,
);

// ---------------------------------------------------------------------------
// Program
// ---------------------------------------------------------------------------

type CliOptions = {
  readonly inputKey: string;
  readonly outputWavKey: string;
  readonly outputScriptKey: string;
};

export const createMainProgram = (opts: CliOptions) =>
  Effect.gen(function* () {
    const env = yield* parseDockerEnv(process.env);

    const storageLayer = createStorageServiceLive(
      env.S3_BUCKET,
      opts.outputWavKey,
      opts.outputScriptKey,
      {
        S3_ENDPOINT_URL: env.S3_ENDPOINT_URL,
        S3_ACCESS_KEY_ID: env.S3_ACCESS_KEY_ID,
        S3_SECRET_ACCESS_KEY: env.S3_SECRET_ACCESS_KEY,
      },
    );

    yield* runPipeline(opts.inputKey).pipe(
      Effect.provide(Layer.merge(storageLayer, VoicevoxServiceLive)),
    );
  });

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

const rootCommand = Command.make("tts-worker", {
  inputKey: inputKeyFlag,
  outputWavKey: outputWavKeyFlag,
  outputScriptKey: outputScriptKeyFlag,
}).pipe(
  Command.withDescription(
    "Convert a radio script JSON to WAV via VOICEVOX and upload to S3.",
  ),
  Command.withHandler((flags) =>
    createMainProgram({
      inputKey: Option.getOrElse(flags.inputKey, () => DEFAULT_INPUT_KEY),
      outputWavKey: Option.getOrElse(
        flags.outputWavKey,
        () => DEFAULT_OUTPUT_WAV_KEY,
      ),
      outputScriptKey: Option.getOrElse(
        flags.outputScriptKey,
        () => DEFAULT_OUTPUT_SCRIPT_KEY,
      ),
    }),
  ),
);

export const main = () =>
  Command.run(rootCommand, { version: "0.0.0" }).pipe(
    Effect.scoped,
    Effect.provide(NodeServices.layer),
    NodeRuntime.runMain,
  );
