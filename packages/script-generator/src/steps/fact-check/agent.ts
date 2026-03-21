import { Agent } from "@mastra/core/agent";
import { bedrock } from "../../shared/bedrock";

export const FACT_CHECK_AGENT_ID = "fact-check-agent";

export const factCheckAgent = new Agent({
  id: FACT_CHECK_AGENT_ID,
  name: "Fact Check Agent",
  instructions: `
    You are a fact-checking agent for a Japanese radio program.
    Cross-check facts across multiple sources, assign reliability scores (0–1),
    and detect contradictions between sources.
    Think in English, respond in Japanese.
  `,
  model: bedrock("us.anthropic.claude-sonnet-4-5-20250929-v1:0"),
});
