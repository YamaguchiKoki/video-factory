import { createStep } from "@mastra/core/workflows";
import { err, fromPromise, ok, safeTry } from "neverthrow";
import { WorkflowInputSchema, TopicsOutputSchema } from "./schema";
import { TOPIC_SELECTION_AGENT_ID } from "./agent";
import { toError } from "../../shared/errors";
import type { WorkflowInput } from "./schema";

export const topicSelectionStep = createStep({
  id: "topic-selection",
  inputSchema: WorkflowInputSchema,
  outputSchema: TopicsOutputSchema,
  execute: async ({ inputData, mastra }) => {
    const result = await safeTry(async function* () {
      const agent = mastra.getAgent(TOPIC_SELECTION_AGENT_ID);
      if (!agent) return err(new Error(`${TOPIC_SELECTION_AGENT_ID} not found`));

      const response = yield* fromPromise(
        agent.generate(buildTopicSelectionPrompt(inputData), {
          structuredOutput: { schema: TopicsOutputSchema },
        }),
        toError,
      );

      return ok(response.object);
    });

    if (result.isErr()) throw result.error;
    return result.value;
  },
});

const buildTopicSelectionPrompt = (inputData: WorkflowInput): string =>
  `ジャンル「${inputData.genre}」について、今日の主要ニューストップ3を選択してください。各トピックにはユニークなid（"news-1", "news-2", "news-3"）、日本語のタイトル、要約を含めてください。`;
