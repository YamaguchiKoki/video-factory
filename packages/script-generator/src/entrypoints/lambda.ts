import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { err, fromPromise, ok, type ResultAsync } from "neverthrow";
import { uploadScriptToS3 } from "../infrastructure/s3";
import { createTavilyMcpClient } from "../mcp/tavily";
import type { Script } from "../schema";
import { runWorkflow } from "../workflow-runner";

const OUTPUT_SCRIPT_KEY = "script-generator/script.json";

const smClient = new SecretsManagerClient({});

const resolveSecretString = (secretArn: string): ResultAsync<string, Error> =>
  fromPromise(
    smClient.send(new GetSecretValueCommand({ SecretId: secretArn })),
    (e) => (e instanceof Error ? e : new Error(String(e))),
  ).andThen((response) => {
    if (!response.SecretString) {
      return err(new Error(`Secret ${secretArn} has no string value`));
    }
    return ok(response.SecretString);
  });

export const handler = async (event: unknown): Promise<Script> => {
  const secretArn = process.env.TAVILY_SECRET_ARN;
  if (!secretArn) {
    throw new Error("TAVILY_SECRET_ARN environment variable is required");
  }

  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    throw new Error("S3_BUCKET environment variable is required");
  }

  const apiKeyResult = await resolveSecretString(secretArn);
  if (apiKeyResult.isErr()) {
    throw apiKeyResult.error;
  }

  const tavilyClient = createTavilyMcpClient(apiKeyResult.value);
  const workflowResult = await runWorkflow(
    event as Parameters<typeof runWorkflow>[0],
    tavilyClient,
  );

  if (workflowResult.isErr()) {
    throw new Error(workflowResult.error.message);
  }

  const script = workflowResult.value;

  const uploadResult = await uploadScriptToS3(bucket, OUTPUT_SCRIPT_KEY, script);
  if (uploadResult.isErr()) {
    throw new Error(uploadResult.error.message);
  }

  return script;
};
