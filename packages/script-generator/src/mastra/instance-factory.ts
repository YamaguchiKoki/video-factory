import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import type { TavilyMcpClient } from "../mcp/tavily";
import {
  DIALOGUE_SCRIPT_GENERATOR_AGENT_ID,
  dialogueScriptGeneratorAgent,
} from "../steps/dialogue-script-generator";
import { createFactCheckAgent, FACT_CHECK_AGENT_ID } from "../steps/fact-check";
import {
  TOPIC_DEEP_DIVE_AGENT_ID,
  topicDeepDiveAgent,
} from "../steps/topic-deep-dive";
import {
  createTopicSelectionAgent,
  TOPIC_SELECTION_AGENT_ID,
} from "../steps/topic-selection";
import { generateScriptWorkflow } from "../workflow";

export const createMastraInstance = (tavilyClient: TavilyMcpClient): Mastra =>
  new Mastra({
    agents: {
      [TOPIC_SELECTION_AGENT_ID]: createTopicSelectionAgent(tavilyClient),
      [TOPIC_DEEP_DIVE_AGENT_ID]: topicDeepDiveAgent,
      [FACT_CHECK_AGENT_ID]: createFactCheckAgent(tavilyClient),
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
