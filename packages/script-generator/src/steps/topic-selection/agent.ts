import { Agent } from "@mastra/core/agent";
import type { TavilyMcpClient } from "../../mcp/tavily";
import { bedrock } from "../../shared/bedrock";

export const TOPIC_SELECTION_AGENT_ID = "topic-selection-agent";

export const createTopicSelectionAgent = (
  tavilyClient: TavilyMcpClient,
): Agent =>
  new Agent({
    id: TOPIC_SELECTION_AGENT_ID,
    name: "Topic Selection Agent",
    instructions: `
      You are a news topic selection agent for a Japanese radio program.
      Search for today's top news topics in the specified genre using Tavily.
      Select the top 3 most significant and interesting topics.
      Think in English, respond in Japanese.
    `,
    model: bedrock("us.anthropic.claude-sonnet-4-5-20250929-v1:0"),
    tools: async () => tavilyClient.listTools(),
  });
