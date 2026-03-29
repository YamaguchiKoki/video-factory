import { createTavilyMcpClient } from "../mcp/tavily";
import { createMastraInstance } from "./instance-factory";

// Singleton for the Mastra dev server (`mastra dev`).
// TAVILY_API_KEY is required and must be set via the .env file when using dev mode.
const devApiKey = process.env.TAVILY_API_KEY;
if (!devApiKey) {
  throw new Error("TAVILY_API_KEY environment variable is required");
}

export const mastra = createMastraInstance(createTavilyMcpClient(devApiKey));
