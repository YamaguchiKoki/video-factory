import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { Effect, Result } from "effect";
import { uploadScriptToS3 } from "../infrastructure/s3";
import { createTavilyMcpClient } from "../mcp/tavily";
import type { Script } from "../schema";
import { WorkflowInputSchema } from "../steps/topic-selection";
import { runWorkflow } from "../workflow-runner";

const OUTPUT_SCRIPT_KEY = "script-generator/script.json";
const smClient = new SecretsManagerClient({});

const resolveSecretString = (secretArn: string): Promise<string> =>
  smClient
    .send(new GetSecretValueCommand({ SecretId: secretArn }))
    .then((response) => {
      if (!response.SecretString) {
        throw new Error(`Secret ${secretArn} has no string value`);
      }
      return response.SecretString;
    });

export const handler = async (event: unknown): Promise<Script> => {
  const secretArn = process.env.TAVILY_SECRET_ARN;
  if (!secretArn)
    throw new Error("TAVILY_SECRET_ARN environment variable is required");

  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("S3_BUCKET environment variable is required");

  const inputResult = WorkflowInputSchema.safeParse(event);
  if (!inputResult.success) {
    throw new Error(`Invalid event input: ${inputResult.error.message}`);
  }

  const apiKey = await resolveSecretString(secretArn);
  const tavilyClient = createTavilyMcpClient(apiKey);

  const script = await Effect.runPromise(
    runWorkflow(inputResult.data, tavilyClient).pipe(
      Effect.mapError((e) => new Error(e.message)),
    ),
  );

  const uploadResult = await Effect.runPromise(
    Effect.result(uploadScriptToS3(bucket, OUTPUT_SCRIPT_KEY, script)),
  );
  if (Result.isFailure(uploadResult)) {
    throw new Error(uploadResult.failure.message);
  }

  return script;
};
