import { Agent } from "@mastra/core/agent";
import { bedrock } from "../../shared/bedrock";

export const DIALOGUE_SCRIPT_GENERATOR_AGENT_ID =
  "dialogue-script-generator-agent";

export const dialogueScriptGeneratorAgent = new Agent({
  id: DIALOGUE_SCRIPT_GENERATOR_AGENT_ID,
  name: "Dialogue Script Generator Agent",
  instructions: `
    You are a dialogue script writer for a Japanese radio program.
    Speaker A is the knowledgeable explainer; Speaker B is the curious questioner.
    Generate natural conversation flows: intro → discussion for each topic → outro.
    Preserve proper nouns and technical terms accurately.
    Think in English, respond in Japanese.
  `,
  model: bedrock("us.anthropic.claude-sonnet-4-5-20250929-v1:0"),
});
