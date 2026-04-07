import { Effect } from "effect";
import { createTavilyMcpClient } from "../mcp/tavily";
import { runWorkflow } from "../workflow-runner";

const genre = process.argv[2] ?? "テクノロジー";
const tavilyApiKey = process.env.TAVILY_API_KEY;
if (!tavilyApiKey) {
  console.error("TAVILY_API_KEY environment variable is required");
  process.exit(1);
}

console.log(`Starting workflow with genre: ${genre}`);

const tavilyClient = createTavilyMcpClient(tavilyApiKey);

Effect.runPromise(runWorkflow({ genre }, tavilyClient)).then(
  (script) => console.log(JSON.stringify(script, null, 2)),
  (error: unknown) => {
    const e = error instanceof Error ? error : new Error(String(error));
    console.error(e.message);
    process.exit(1);
  },
);
