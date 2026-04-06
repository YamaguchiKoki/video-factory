import { Effect } from "effect";
import type { z } from "zod";
import { createMastraInstance } from "./mastra/instance-factory";
import type { TavilyMcpClient } from "./mcp/tavily";
import { type Script, ScriptSchema } from "./schema";
import { toError } from "./shared/errors";
import { WorkflowInputSchema } from "./steps/topic-selection";

type WorkflowInput = z.infer<typeof WorkflowInputSchema>;

type WorkflowError = {
  readonly type: "VALIDATION_ERROR" | "WORKFLOW_ERROR";
  readonly message: string;
};

export const runWorkflow = (
  input: WorkflowInput,
  tavilyClient: TavilyMcpClient,
): Effect.Effect<Script, WorkflowError> => {
  const mastraInstance = createMastraInstance(tavilyClient);

  const parseInput = (): Effect.Effect<WorkflowInput, WorkflowError> => {
    const result = WorkflowInputSchema.safeParse(input);
    if (!result.success) {
      return Effect.fail({
        type: "VALIDATION_ERROR",
        message: result.error.message,
      } satisfies WorkflowError);
    }
    return Effect.succeed(result.data);
  };

  const executeWorkflow = (
    validated: WorkflowInput,
  ): Effect.Effect<unknown, WorkflowError> =>
    Effect.tryPromise({
      try: async () => {
        const workflow = mastraInstance.getWorkflow("generateScriptWorkflow");
        const run = await workflow.createRun();
        const result = await run.start({ inputData: validated });
        if (result.status !== "success") {
          throw new Error(
            `Workflow ${result.status}: ${JSON.stringify(result)}`,
          );
        }
        return result.result;
      },
      catch: (e) =>
        ({
          type: "WORKFLOW_ERROR",
          message: toError(e).message,
        }) satisfies WorkflowError,
    });

  const parseOutput = (raw: unknown): Effect.Effect<Script, WorkflowError> => {
    const result = ScriptSchema.safeParse(raw);
    if (!result.success) {
      return Effect.fail({
        type: "VALIDATION_ERROR",
        message: `Output validation failed: ${result.error.message}`,
      } satisfies WorkflowError);
    }
    return Effect.succeed(result.data);
  };

  const disconnect = Effect.promise(() =>
    tavilyClient.disconnect().catch(() => {}),
  );

  return Effect.gen(function* () {
    const validated = yield* parseInput();
    const workflowResult = yield* executeWorkflow(validated);
    const script = yield* parseOutput(workflowResult);
    return script;
  }).pipe(Effect.ensuring(disconnect));
};
