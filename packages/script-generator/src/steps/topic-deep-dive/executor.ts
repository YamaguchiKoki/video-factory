import { createStep } from "@mastra/core/workflows";
import type { Topic } from "../topic-selection/schema";
import { TopicSchema } from "../topic-selection/schema";
import { TOPIC_DEEP_DIVE_AGENT_ID } from "./agent";
import { EnrichedTopicSchema } from "./schema";

export const topicDeepDiveStep = createStep({
  id: "topic-deep-dive",
  inputSchema: TopicSchema,
  outputSchema: EnrichedTopicSchema,
  execute: async ({ inputData, mastra }) => {
    const agent = mastra.getAgent(TOPIC_DEEP_DIVE_AGENT_ID);
    if (!agent) throw new Error(`${TOPIC_DEEP_DIVE_AGENT_ID} not found`);

    const response = await agent.generate(buildTopicDeepDivePrompt(inputData), {
      structuredOutput: { schema: EnrichedTopicSchema },
    });

    const parsed = EnrichedTopicSchema.safeParse(response.object);
    if (!parsed.success)
      throw new Error(
        `Structured output validation failed: ${parsed.error.message}`,
      );
    return parsed.data;
  },
});

const buildTopicDeepDivePrompt = (inputData: Topic): string =>
  `トピック「${inputData.title}」について詳細なリサーチを実施してください。X上の意見、詳細なコンテキスト・背景情報、信頼性の高いソースURLを収集してください。`;
