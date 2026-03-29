import { err, fromPromise, ok, type ResultAsync, safeTry } from "neverthrow";
import type { z } from "zod";
import { createMastraInstance } from "./mastra/instance-factory";
import type { TavilyMcpClient } from "./mcp/tavily";
import { type Script, ScriptSchema } from "./schema";
import { toError } from "./shared/errors";
import { WorkflowInputSchema } from "./steps/topic-selection";

export type WorkflowInput = z.infer<typeof WorkflowInputSchema>;

export type WorkflowError = {
  readonly type: "VALIDATION_ERROR" | "WORKFLOW_ERROR";
  readonly message: string;
};

const parseInput = (input: WorkflowInput) => {
  const result = WorkflowInputSchema.safeParse(input);
  if (!result.success) {
    return err<never, WorkflowError>({
      type: "VALIDATION_ERROR",
      message: result.error.message,
    });
  }
  return ok(result.data);
};

const executeWorkflow = (
  mastraInstance: ReturnType<typeof createMastraInstance>,
  input: { readonly genre: string },
) =>
  fromPromise(
    (async () => {
      const workflow = mastraInstance.getWorkflow("generateScriptWorkflow");
      const run = await workflow.createRun();
      const result = await run.start({ inputData: input });

      if (result.status !== "success") {
        throw new Error(`Workflow ${result.status}: ${JSON.stringify(result)}`);
      }

      return result.result;
    })(),
    (e): WorkflowError => ({
      type: "WORKFLOW_ERROR",
      message: toError(e).message,
    }),
  );

const parseOutput = (result: unknown) => {
  const parsed = ScriptSchema.safeParse(result);
  if (!parsed.success) {
    return err<never, WorkflowError>({
      type: "VALIDATION_ERROR",
      message: `Output validation failed: ${parsed.error.message}`,
    });
  }
  return ok(parsed.data);
};

const disconnectMcp = (tavilyClient: TavilyMcpClient) =>
  fromPromise(tavilyClient.disconnect(), (e) => {
    console.error("Failed to disconnect Tavily MCP client:", e);
    return e;
  });

export const runWorkflow = (
  input: WorkflowInput,
  tavilyClient: TavilyMcpClient,
): ResultAsync<Script, WorkflowError> => {
  const mastraInstance = createMastraInstance(tavilyClient);

  return safeTry(async function* () {
    const validated = yield* parseInput(input);
    const workflowResult = yield* executeWorkflow(mastraInstance, validated);
    const script = yield* parseOutput(workflowResult);
    return ok(script);
  })
    .andThen((script) =>
      disconnectMcp(tavilyClient)
        .map(() => script)
        .orElse(() => ok(script)),
    )
    .orElse((error) =>
      disconnectMcp(tavilyClient)
        .andThen(() => err(error))
        .orElse(() => err(error)),
    );
};
