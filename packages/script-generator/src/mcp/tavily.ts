import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { McpClient } from "@strands-agents/sdk";

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
export const createTavilyMcpClient = () => {
  const client = new McpClient({
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
  return { client };
};
