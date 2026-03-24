import { runWorkflow } from "../workflow-runner";
import { uploadScriptToS3 } from "../infrastructure/s3";
import { parseDockerEnv } from "../env";
import { handleResult } from "../run-entrypoint";

export const OUTPUT_SCRIPT_KEY = "script-generator/script.json";

export const run = async (): Promise<void> => {
  const envResult = parseDockerEnv(process.env);
  if (envResult.isErr()) {
    console.error(envResult.error.message);
    process.exit(1);
    return;
  }

  const result = await runWorkflow({ genre: "technology" })
    .mapErr((e) => ({ type: "WORKFLOW_ERROR" as const, message: e.message }))
    .andThen((script) => uploadScriptToS3(envResult.value.S3_BUCKET, OUTPUT_SCRIPT_KEY, script));

  handleResult(result);
};
