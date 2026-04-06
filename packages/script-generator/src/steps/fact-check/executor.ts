import { createStep } from "@mastra/core/workflows";
import type { EnrichedTopicsOutput } from "../topic-deep-dive/schema";
import { EnrichedTopicsOutputSchema } from "../topic-deep-dive/schema";
import { FACT_CHECK_AGENT_ID } from "./agent";
import {
  VerifiedTopicsLLMOutputSchema,
  VerifiedTopicsOutputSchema,
} from "./schema";

export const factCheckStep = createStep({
  id: "fact-check",
  inputSchema: EnrichedTopicsOutputSchema,
  outputSchema: VerifiedTopicsOutputSchema,
  execute: async ({ inputData, mastra }) => {
    const agent = mastra.getAgent(FACT_CHECK_AGENT_ID);
    if (!agent) throw new Error(`${FACT_CHECK_AGENT_ID} not found`);

    const response = await agent.generate(buildFactCheckPrompt(inputData), {
      structuredOutput: { schema: VerifiedTopicsLLMOutputSchema },
    });

    return response.object.topics;
  },
});

const buildFactCheckPrompt = (inputData: EnrichedTopicsOutput): string =>
  `以下のトピックについてファクトチェックを実施してください。複数ソース間のクロスチェック、信頼性スコアリング（0〜1）、矛盾検出を行ってください。\n\n${JSON.stringify(inputData, null, 2)}`;
