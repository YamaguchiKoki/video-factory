import { createStep } from "@mastra/core/workflows";
import { err, fromPromise, ok, safeTry } from "neverthrow";
import { EnrichedTopicsOutputSchema } from "../topic-deep-dive/schema";
import { VerifiedTopicsOutputSchema } from "./schema";
import { FACT_CHECK_AGENT_ID } from "./agent";
import { toError } from "../../shared/errors";
import type { EnrichedTopicsOutput } from "../topic-deep-dive/schema";

export const factCheckStep = createStep({
  id: "fact-check",
  inputSchema: EnrichedTopicsOutputSchema,
  outputSchema: VerifiedTopicsOutputSchema,
  execute: async ({ inputData, mastra }) => {
    const result = await safeTry(async function* () {
      const agent = mastra.getAgent(FACT_CHECK_AGENT_ID);
      if (!agent) return err(new Error(`${FACT_CHECK_AGENT_ID} not found`));

      const response = yield* fromPromise(
        agent.generate(buildFactCheckPrompt(inputData), {
          structuredOutput: { schema: VerifiedTopicsOutputSchema },
        }),
        toError,
      );

      return ok(response.object);
    });

    if (result.isErr()) throw result.error;
    return result.value;
  },
});

const buildFactCheckPrompt = (inputData: EnrichedTopicsOutput): string =>
  `以下のトピックについてファクトチェックを実施してください。複数ソース間のクロスチェック、信頼性スコアリング（0〜1）、矛盾検出を行ってください。\n\n${JSON.stringify(inputData, null, 2)}`;
