import { Effect, Result } from "effect";
import { parseDockerEnv } from "../env";
import { uploadScriptToS3 } from "../infrastructure/s3";
import { createTavilyMcpClient } from "../mcp/tavily";
import { runWorkflow } from "../workflow-runner";

export const OUTPUT_SCRIPT_KEY = "script-generator/script.json";

const runProgram = (): Effect.Effect<void, Error> =>
  Effect.gen(function* () {
    const envResult = yield* Effect.result(parseDockerEnv(process.env));
    if (Result.isFailure(envResult)) {
      yield* Effect.fail(new Error(envResult.failure.message));
      return;
    }
    const env = envResult.success;

    const tavilyApiKey = process.env.TAVILY_API_KEY;
    if (!tavilyApiKey) {
      yield* Effect.fail(
        new Error("TAVILY_API_KEY environment variable is required"),
      );
      return;
    }

    const tavilyClient = createTavilyMcpClient(tavilyApiKey);

    const script = yield* runWorkflow(
      { genre: "technology" },
      tavilyClient,
    ).pipe(Effect.mapError((e) => new Error(e.message)));

    const uploadResult = yield* Effect.result(
      uploadScriptToS3(env.S3_BUCKET, OUTPUT_SCRIPT_KEY, script),
    );
    if (Result.isFailure(uploadResult)) {
      yield* Effect.fail(new Error(uploadResult.failure.message));
    }
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
