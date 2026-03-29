import { runWorkflow } from "../workflow-runner";
import { createTavilyMcpClient } from "../mcp/tavily";

const genre = process.argv[2] ?? "テクノロジー";
const tavilyApiKey = process.env.TAVILY_API_KEY;
if (!tavilyApiKey) {
  console.error("TAVILY_API_KEY environment variable is required");
  process.exit(1);
}

console.log(`Starting workflow with genre: ${genre}`);

const tavilyClient = createTavilyMcpClient(tavilyApiKey);
const result = await runWorkflow({ genre }, tavilyClient);

result.match(
  (script) => console.log(JSON.stringify(script, null, 2)),
  (error) => {
    console.error(`[${error.type}] ${error.message}`);
    process.exit(1);
  },
);
