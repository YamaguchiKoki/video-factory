import { err, fromPromise, ok, safeTry, type ResultAsync } from "neverthrow";
import { z } from "zod";
import { mastra } from "./mastra";
import { tavilyMcp } from "./mcp/tavily";
import { WorkflowInputSchema } from "./steps/topic-selection";
import { ScriptSchema, type Script } from "./schema";
import { toError } from "./shared/errors";

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

const executeWorkflow = (input: { readonly genre: string }) =>
  fromPromise(
    (async () => {
      const workflow = mastra.getWorkflow("generateScriptWorkflow");
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

const disconnectMcp = () =>
  fromPromise(tavilyMcp.disconnect(), (e) => {
    console.error("Failed to disconnect Tavily MCP client:", e);
    return e;
  });

export const runWorkflow = (input: WorkflowInput): ResultAsync<Script, WorkflowError> =>
  safeTry(async function* () {
    const validated = yield* parseInput(input);
    const workflowResult = yield* executeWorkflow(validated);
    const script = yield* parseOutput(workflowResult);
    return ok(script);
  })
    .andThen((script) =>
      disconnectMcp()
        .map(() => script)
        .orElse(() => ok(script)),
    )
    .orElse((error) =>
      disconnectMcp()
        .andThen(() => err(error))
        .orElse(() => err(error)),
    );

// Lambda-compatible alias: preserves the external handler function interface
export const handler = runWorkflow;
