import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Agent, BedrockModel, McpClient } from "@strands-agents/sdk";

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const main = async () => {
  const model = new BedrockModel({
    region: "us-east-1",
    modelId: "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
  });
  const tavilyMcpClient = new McpClient({
    transport: new StreamableHTTPClientTransport(
      new URL("https://mcp.tavily.com/mcp/"),
      {
        requestInit: {
          headers: {
            Authorization: `Bearer ${TAVILY_API_KEY}`,
          },
        },
      },
    ),
  });
  const agent = new Agent({
    model: model,
    tools: [tavilyMcpClient],
    systemPrompt:
      "You are a Researcher Agent that gathers information from the web. ",
  });

  const result = await agent.invoke(
    "今日話題のニューストピックについて３つピックアップして",
  );
  console.log(result);
};

main();
