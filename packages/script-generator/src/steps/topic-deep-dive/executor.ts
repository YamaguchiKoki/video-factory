import { createStep } from "@mastra/core/workflows";
import { err, fromPromise, ok, safeTry } from "neverthrow";
import { TopicSchema } from "../topic-selection/schema";
import { EnrichedTopicSchema } from "./schema";
import { TOPIC_DEEP_DIVE_AGENT_ID } from "./agent";
import { toError } from "../../shared/errors";
import type { Topic } from "../topic-selection/schema";

export const topicDeepDiveStep = createStep({
  id: "topic-deep-dive",
  inputSchema: TopicSchema,
  outputSchema: EnrichedTopicSchema,
  execute: async ({ inputData, mastra }) => {
    const result = await safeTry(async function* () {
      const agent = mastra.getAgent(TOPIC_DEEP_DIVE_AGENT_ID);
      if (!agent) return err(new Error(`${TOPIC_DEEP_DIVE_AGENT_ID} not found`));

      const response = yield* fromPromise(
        agent.generate(buildTopicDeepDivePrompt(inputData), {
          structuredOutput: { schema: EnrichedTopicSchema },
        }),
        toError,
      );

      return ok(response.object);
    });

    if (result.isErr()) throw result.error;
    return result.value;
  },
});

const buildTopicDeepDivePrompt = (inputData: Topic): string =>
  `トピック「${inputData.title}」について詳細なリサーチを実施してください。X上の意見、詳細なコンテキスト・背景情報、信頼性の高いソースURLを収集してください。`;
