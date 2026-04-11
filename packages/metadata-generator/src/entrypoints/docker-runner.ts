import { fileURLToPath } from "node:url";
import { parseDockerEnv } from "@video-factory/shared";
import { Effect, Result } from "effect";
import {
  downloadScriptFromS3,
  uploadTextToS3,
  uploadThumbnailToS3,
} from "../infrastructure/s3";
import { createMastraInstance } from "../mastra/instance-factory";
import { generateMetadata } from "../pipeline/generate-metadata";

export const DEFAULT_INPUT_SCRIPT_KEY = "script-generator/script.json";
export const THUMBNAIL_S3_KEY = "metadata-generator/thumbnail.png";
export const DESCRIPTION_S3_KEY = "metadata-generator/description.json";
export const COMMENT_S3_KEY = "metadata-generator/comment.json";

const runProgram = (): Effect.Effect<void, Error> =>
  Effect.gen(function* () {
    const envResult = yield* Effect.result(parseDockerEnv(process.env));
    if (Result.isFailure(envResult)) {
      yield* Effect.fail(new Error(envResult.failure.message));
      return;
    }
    const env = envResult.success;

    const scriptKey = process.env.INPUT_SCRIPT_KEY ?? DEFAULT_INPUT_SCRIPT_KEY;

    const mastra = createMastraInstance();

    yield* downloadScriptFromS3(env.S3_BUCKET, scriptKey).pipe(
      Effect.flatMap((script) => generateMetadata(script, mastra)),
      Effect.flatMap((metadata) =>
        Effect.all([
          uploadThumbnailToS3(
            env.S3_BUCKET,
            THUMBNAIL_S3_KEY,
            Buffer.from(metadata.thumbnail.imageBase64, "base64"),
          ),
          uploadTextToS3(
            env.S3_BUCKET,
            DESCRIPTION_S3_KEY,
            JSON.stringify(metadata.description),
          ),
          uploadTextToS3(
            env.S3_BUCKET,
            COMMENT_S3_KEY,
            JSON.stringify(metadata.comment),
          ),
        ]),
      ),
      Effect.mapError((e) => new Error(e.message)),
    );
  });

export const run = async (): Promise<void> => {
  const result = await Effect.runPromise(Effect.result(runProgram()));

  if (Result.isFailure(result)) {
    const error = result.failure;
    console.error(
      JSON.stringify({ level: "ERROR", type: "Error", message: error.message }),
    );
    process.exit(1);
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error: unknown) => {
    console.error(
      JSON.stringify({
        level: "ERROR",
        type: "UnhandledError",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    process.exit(1);
  });
}
