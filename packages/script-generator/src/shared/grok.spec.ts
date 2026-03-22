import { describe, expect, it, vi } from "vitest";
import { grok } from "./grok";

describe("grok provider", () => {
  it("should be a callable function", () => {
    // Assert — grok must be a function (provider factory), following the same
    // pattern as bedrock in src/shared/bedrock.ts
    expect(typeof grok).toBe("function");
  });

  it("should return a model object when called with a model id", () => {
    const model = grok("grok-3");

    // Assert — calling the provider with a model id must return an object
    // (the language model instance used by Mastra Agent)
    expect(model).toBeDefined();
    expect(typeof model).toBe("object");
  });

  it("should return distinct model instances for different model ids", () => {
    const modelA = grok("grok-3");
    const modelB = grok("grok-3-mini");

    // Assert — each call produces a separate model instance
    expect(modelA).not.toBe(modelB);
  });

  it("should throw when XAI_API_KEY is missing", async () => {
    vi.resetModules();
    vi.stubEnv("XAI_API_KEY", "");
    await expect(() => import("./grok")).rejects.toThrow();
    vi.unstubAllEnvs();
  });
});
