import { createWorkflow } from "@mastra/core/workflows";
import { ScriptSchema } from "./schema";
import { dialogueScriptGeneratorStep } from "./steps/dialogue-script-generator";
import { factCheckStep } from "./steps/fact-check";
import { topicDeepDiveStep } from "./steps/topic-deep-dive";
import {
  topicSelectionStep,
  WorkflowInputSchema,
} from "./steps/topic-selection";

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
