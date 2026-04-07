import { createStep } from "@mastra/core/workflows";
import { ScriptSchema } from "../../schema";
import type { VerifiedTopicsOutput } from "../fact-check/schema";
import { VerifiedTopicsOutputSchema } from "../fact-check/schema";
import { DIALOGUE_SCRIPT_GENERATOR_AGENT_ID } from "./agent";

export const dialogueScriptGeneratorStep = createStep({
  id: "dialogue-script-generator",
  inputSchema: VerifiedTopicsOutputSchema,
  outputSchema: ScriptSchema,
  execute: async ({ inputData, mastra }) => {
    const agent = mastra.getAgent(DIALOGUE_SCRIPT_GENERATOR_AGENT_ID);
    if (!agent)
      throw new Error(`${DIALOGUE_SCRIPT_GENERATOR_AGENT_ID} not found`);

    const response = await agent.generate(
      buildDialogueScriptPrompt(inputData),
      {
        structuredOutput: { schema: ScriptSchema },
      },
    );

    return response.object;
  },
});

const buildDialogueScriptPrompt = (inputData: VerifiedTopicsOutput): string =>
  `以下のファクトチェック済みトピックを元に、解説役（A）と質問役（B）の対話型ラジオスクリプトを生成してください。導入（intro）→各トピック議論（discussion×3）→まとめ（outro）の構成で作成してください。\n\n${JSON.stringify(inputData, null, 2)}`;
