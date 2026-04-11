import { Agent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { COMMENT_AGENT_ID } from "../generators/comment";
import { DESCRIPTION_AGENT_ID } from "../generators/description";
import { bedrock } from "../shared/bedrock";

const TEXT_MODEL_ID = "us.anthropic.claude-sonnet-4-5-20250929-v1:0";

export const createMastraInstance = (): Mastra =>
  new Mastra({
    agents: {
      [DESCRIPTION_AGENT_ID]: new Agent({
        id: DESCRIPTION_AGENT_ID,
        name: "Description Agent",
        instructions:
          "You are a YouTube video description writer for a Japanese news radio program. Generate concise, engaging descriptions in Japanese.",
        model: bedrock(TEXT_MODEL_ID),
      }),
      [COMMENT_AGENT_ID]: new Agent({
        id: COMMENT_AGENT_ID,
        name: "Comment Agent",
        instructions:
          "You are a YouTube comment writer for a Japanese news radio program. Generate engaging pinned comments in Japanese that encourage viewer interaction.",
        model: bedrock(TEXT_MODEL_ID),
      }),
    },
    logger: new PinoLogger({
      name: "Mastra",
      level: "info",
    }),
  });
