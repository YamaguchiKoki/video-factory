import { Agent } from "@mastra/core/agent";
import { grok } from "../../shared/grok";

export const TOPIC_DEEP_DIVE_AGENT_ID = "topic-deep-dive-agent";

// grok-3 is chosen because it has access to real-time X (Twitter) data via
// xAI's live search capability, which is essential for collecting diverse
// social opinions alongside news facts.
const GROK_MODEL_ID = "grok-3";

export const topicDeepDiveAgent = new Agent({
  id: TOPIC_DEEP_DIVE_AGENT_ID,
  name: "Topic Deep Dive Agent",
  instructions: `
    You are a deep research agent for a Japanese radio program.
    For a given topic, collect detailed context, X (Twitter) opinions, and credible source URLs.
    Prioritize content that shows diverse perspectives and retains proper nouns.
    Think in English, respond in Japanese.
  `,
  model: grok(GROK_MODEL_ID),
});
