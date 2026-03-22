import { MCPClient } from "@mastra/mcp";
import { z } from "zod";

// Validate required environment variables at startup to fail fast
// rather than sending "Bearer undefined" to the Tavily API.
const envSchema = z.object({
  TAVILY_API_KEY: z.string().min(1, "TAVILY_API_KEY is required"),
});

const env = envSchema.safeParse(process.env);
if (!env.success) {
  throw new Error(
    `Missing environment variable: ${env.error.issues.map((i) => i.message).join(", ")}`,
  );
}

export const createTavilyMcpClient = () =>
  new MCPClient({
    servers: {
      tavily: {
        url: new URL("https://mcp.tavily.com/mcp/"),
        requestInit: {
          headers: {
            Authorization: `Bearer ${env.data.TAVILY_API_KEY}`,
          },
        },
      },
    },
    timeout: 300_000,
  });

// Shared singleton instance — imported by all agents that need Tavily tools.
// This avoids creating multiple independent HTTP connections.
export const tavilyMcp = createTavilyMcpClient();
