import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";

import {
  topicSelectionAgent,
  TOPIC_SELECTION_AGENT_ID,
} from "../steps/topic-selection";
import {
  topicDeepDiveAgent,
  TOPIC_DEEP_DIVE_AGENT_ID,
} from "../steps/topic-deep-dive";
import { factCheckAgent, FACT_CHECK_AGENT_ID } from "../steps/fact-check";
import {
  dialogueScriptGeneratorAgent,
  DIALOGUE_SCRIPT_GENERATOR_AGENT_ID,
} from "../steps/dialogue-script-generator";
import { generateScriptWorkflow } from "../workflow";

export const mastra = new Mastra({
  agents: {
    [TOPIC_SELECTION_AGENT_ID]: topicSelectionAgent,
    [TOPIC_DEEP_DIVE_AGENT_ID]: topicDeepDiveAgent,
    [FACT_CHECK_AGENT_ID]: factCheckAgent,
    [DIALOGUE_SCRIPT_GENERATOR_AGENT_ID]: dialogueScriptGeneratorAgent,
  },
  workflows: {
    generateScriptWorkflow,
  },
  logger: new PinoLogger({
    name: "Mastra",
    level: "info",
  }),
});
