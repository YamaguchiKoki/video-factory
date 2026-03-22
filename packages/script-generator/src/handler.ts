import { err, fromPromise, ok, safeTry } from "neverthrow";
import { mastra } from "./mastra";
import { tavilyMcp } from "./mcp/tavily";
import { WorkflowInputSchema } from "./steps/topic-selection";
import { ScriptSchema, type Script } from "./schema";
import { toError } from "./shared/errors";

type HandlerEvent = {
  readonly genre: string;
};

type HandlerError = {
  readonly type: "VALIDATION_ERROR" | "WORKFLOW_ERROR";
  readonly message: string;
};

const parseInput = (event: HandlerEvent) => {
  const result = WorkflowInputSchema.safeParse(event);
  if (!result.success) {
    return err<never, HandlerError>({
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
    (e): HandlerError => ({
      type: "WORKFLOW_ERROR",
      message: toError(e).message,
    }),
  );

const parseOutput = (result: unknown) => {
  const parsed = ScriptSchema.safeParse(result);
  if (!parsed.success) {
    return err<never, HandlerError>({
      type: "VALIDATION_ERROR",
      message: `Output validation failed: ${parsed.error.message}`,
    });
  }
  return ok(parsed.data);
};

export const handler = async (event: HandlerEvent): Promise<Script> => {
  const result = await safeTry(async function* () {
    const input = yield* parseInput(event);
    const workflowResult = yield* executeWorkflow(input);
    const script = yield* parseOutput(workflowResult);
    return ok(script);
  });

  // Disconnect MCP client regardless of success/failure to prevent stale
  // connections across Lambda freeze/thaw cycles.
  await tavilyMcp.disconnect();

  return result.match(
    (script) => script,
    (error) => {
      throw new Error(`[${error.type}] ${error.message}`);
    },
  );
};
