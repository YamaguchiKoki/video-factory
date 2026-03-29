import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { err, fromPromise, ok, type ResultAsync } from "neverthrow";
import { createTavilyMcpClient } from "../mcp/tavily";
import { runWorkflow } from "../workflow-runner";

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

export const handler = async (event: unknown): Promise<unknown> => {
  const secretArn = process.env.TAVILY_SECRET_ARN;
  if (!secretArn) {
    throw new Error("TAVILY_SECRET_ARN environment variable is required");
  }

  const apiKeyResult = await resolveSecretString(secretArn);
  if (apiKeyResult.isErr()) {
    throw apiKeyResult.error;
  }

  const tavilyClient = createTavilyMcpClient(apiKeyResult.value);
  return runWorkflow(event as Parameters<typeof runWorkflow>[0], tavilyClient);
};
