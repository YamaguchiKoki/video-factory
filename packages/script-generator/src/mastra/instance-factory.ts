import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import {
  createTopicSelectionAgent,
  TOPIC_SELECTION_AGENT_ID,
} from "../steps/topic-selection";
import {
  topicDeepDiveAgent,
  TOPIC_DEEP_DIVE_AGENT_ID,
} from "../steps/topic-deep-dive";
import { createFactCheckAgent, FACT_CHECK_AGENT_ID } from "../steps/fact-check";
import {
  dialogueScriptGeneratorAgent,
  DIALOGUE_SCRIPT_GENERATOR_AGENT_ID,
} from "../steps/dialogue-script-generator";
import { generateScriptWorkflow } from "../workflow";
import type { TavilyMcpClient } from "../mcp/tavily";

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
