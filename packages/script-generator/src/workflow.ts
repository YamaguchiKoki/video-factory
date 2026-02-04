import { createTopicDetermineAgent } from "./agents/topic/createAgents";
import { createTavilyMcpClient } from "./mcp/tavily";
import { TOPIC_DETERMINE_USER_PROMPT } from "./prompts/topic";

export const execute = async () => {
  const { client: tavilyMcpClient } = createTavilyMcpClient();
  const { agent: topicDeterminer } = createTopicDetermineAgent(tavilyMcpClient);
  const topicResult = await topicDeterminer.invoke(TOPIC_DETERMINE_USER_PROMPT);
};
