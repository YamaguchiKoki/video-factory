import { MCPClient } from "@mastra/mcp";

// Re-exported as a domain-specific alias so callers do not need to import
// @mastra/mcp directly.
export type TavilyMcpClient = MCPClient;

export const createTavilyMcpClient = (apiKey: string): MCPClient =>
  new MCPClient({
    servers: {
      tavily: {
        url: new URL("https://mcp.tavily.com/mcp/"),
        requestInit: {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        },
      },
    },
    timeout: 300_000,
  });
