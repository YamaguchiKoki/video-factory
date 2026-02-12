import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import { Agent } from "@mastra/core/agent";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { MCPClient } from "@mastra/mcp";
import z from "zod";

const bedrock = createAmazonBedrock({
  region: "us-east-1",
  credentialProvider: fromNodeProviderChain(),
});

const TAVILY_API_KEY = process.env.TAVILY_API_KEY!!;
const tavilyMcp = new MCPClient({
  servers: {
    tavily: {
      command: "npx",
      args: ["-y", "tavily-mcp@0.1.4"],
      env: {
        TAVILY_API_KEY: TAVILY_API_KEY,
      },
    },
  },
});

export const fetchInformationAgent = new Agent({
  id: "fetch-information-agent",
  name: "MCP Agent",
  instructions: `
      You are a Researcher Agent that gathers information from the web.

      Use Tavily MCP to fetch data.

      Think in English, Response in Japanese
  `,
  model: bedrock("us.anthropic.claude-sonnet-4-5-20250929-v1:0"),
  tools: await tavilyMcp.listTools(),
});
const topicSchema = z.object({
  header: z.string(),
  summary: z.string(),
});

const decidedTopicSchema = z.array(topicSchema).length(3);

const dicisionTopics = createStep({
  id: "decision-topics",
  description: "今日話題のニューストピックについて３つピックアップする",
  inputSchema: z.object({
    genre: z.string().describe("e.g. 政治経済"),
  }),
  outputSchema: decidedTopicSchema,
  execute: async ({ inputData, mastra }) => {
    const genre = inputData;
    if (!genre) {
      throw new Error("No Genre Given.");
    }
    const agent = mastra?.getAgent("fetch-information-agent");
    if (!agent) {
      throw new Error("Weather agent not found");
    }
    const prompt = `政治経済系の〜〜`;
    const response = await agent.generate(prompt, {
      structuredOutput: {
        schema: decidedTopicSchema,
      },
    });
    return response.object;
  },
});

const generateScriptWorkflow = createWorkflow({
  id: "generate-script",
  inputSchema: z.object({
    genre: z.string().describe("e.g. 政治経済"),
  }),
  outputSchema: decidedTopicSchema,
}).then(dicisionTopics);
