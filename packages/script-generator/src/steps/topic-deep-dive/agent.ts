import { Agent } from "@mastra/core/agent";
import { bedrock } from "../../shared/bedrock";

export const TOPIC_DEEP_DIVE_AGENT_ID = "topic-deep-dive-agent";

export const topicDeepDiveAgent = new Agent({
  id: TOPIC_DEEP_DIVE_AGENT_ID,
  name: "Topic Deep Dive Agent",
  instructions: `
    You are a deep research agent for a Japanese radio program.
    For a given topic, collect detailed context, X (Twitter) opinions, and credible source URLs.
    Prioritize content that shows diverse perspectives and retains proper nouns.
    Think in English, respond in Japanese.
  `,
  model: bedrock("us.anthropic.claude-sonnet-4-5-20250929-v1:0"),
});
