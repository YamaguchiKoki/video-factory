import { runWorkflow } from "../workflow-runner";
import { uploadScriptToS3 } from "../infrastructure/s3";
import { parseDockerEnv } from "../env";
import { handleResult } from "../run-entrypoint";
import { createTavilyMcpClient } from "../mcp/tavily";

export const OUTPUT_SCRIPT_KEY = "script-generator/script.json";

export const run = async (): Promise<void> => {
  const envResult = parseDockerEnv(process.env);
  if (envResult.isErr()) {
    console.error(envResult.error.message);
    process.exit(1);
    return;
  }

  const tavilyApiKey = process.env.TAVILY_API_KEY;
  if (!tavilyApiKey) {
    console.error("TAVILY_API_KEY environment variable is required");
    process.exit(1);
    return;
  }

  const tavilyClient = createTavilyMcpClient(tavilyApiKey);

  const result = await runWorkflow({ genre: "technology" }, tavilyClient)
    .mapErr((e) => ({ type: "WORKFLOW_ERROR" as const, message: e.message }))
    .andThen((script) =>
      uploadScriptToS3(envResult.value.S3_BUCKET, OUTPUT_SCRIPT_KEY, script),
    );

  handleResult(result);
};
