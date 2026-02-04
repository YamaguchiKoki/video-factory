import { Agent, BedrockModel, McpClient } from "@strands-agents/sdk";
import { TOPIC_DETERMINE_SYSTEM_PROMPT } from "../../prompts/topic";

export const createTopicDetermineAgent = (mcpClient: McpClient) => {
  const model = new BedrockModel({
    region: "us-east-1",
    modelId: "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
  });
  const agent = new Agent({
    model: model,
    tools: [mcpClient],
    // 構造化出力頑張る. tool使えば無理ではないらしい
    systemPrompt: TOPIC_DETERMINE_SYSTEM_PROMPT,
  });
  return { agent };
};
