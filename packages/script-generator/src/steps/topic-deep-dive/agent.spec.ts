import { describe, expect, it, vi, beforeEach } from "vitest";
import { topicDeepDiveAgent, TOPIC_DEEP_DIVE_AGENT_ID } from "./agent";

// Model objects from @ai-sdk providers expose provider and modelId properties.
type ModelLike = {
  provider: string;
  modelId: string;
};

describe("topicDeepDiveAgent", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should have the correct agent id", () => {
    // Assert — agent id must remain stable so mastra registry lookup works
    expect(topicDeepDiveAgent.id).toBe(TOPIC_DEEP_DIVE_AGENT_ID);
    expect(topicDeepDiveAgent.id).toBe("topic-deep-dive-agent");
  });

  it("should have a model configured", () => {
    // Assert — agent must have a model to be able to generate responses
    expect(topicDeepDiveAgent.model).toBeDefined();
  });

  it("should use the xai (Grok) provider", () => {
    // Assert — the model must come from the xai provider.
    // The @ai-sdk/xai provider sets provider to "xai.chat" on the model object
    // (the chat namespace is appended by createXai internally).
    const model = topicDeepDiveAgent.model as unknown as ModelLike;
    expect(model.provider).toMatch(/^xai/);
  });

  it("should use the grok-3 model", () => {
    // Assert — the specific model id must be grok-3
    const model = topicDeepDiveAgent.model as unknown as ModelLike;
    expect(model.modelId).toBe("grok-3");
  });
});
