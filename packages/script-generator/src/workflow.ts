import { createWorkflow } from "@mastra/core/workflows";
import { WorkflowInputSchema, topicSelectionStep } from "./steps/topic-selection";
import { ScriptSchema } from "./schema";
import { topicDeepDiveStep } from "./steps/topic-deep-dive";
import { factCheckStep } from "./steps/fact-check";
import { dialogueScriptGeneratorStep } from "./steps/dialogue-script-generator";

export const generateScriptWorkflow = createWorkflow({
  id: "generate-script",
  inputSchema: WorkflowInputSchema,
  outputSchema: ScriptSchema,
})
  .then(topicSelectionStep)
  .foreach(topicDeepDiveStep)
  .then(factCheckStep)
  .then(dialogueScriptGeneratorStep)
  .commit();
