import type { Agent } from "@mastra/core/agent";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { generateStructured } from "./structured-output";

const TopicSchema = z.object({ id: z.string(), title: z.string() });
const VALID = { id: "news-1", title: "見出し" };

describe("generateStructured", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should return the parsed object on the first attempt", async () => {
    // Arrange
    const generate = vi.fn().mockResolvedValue({ object: VALID });

    // Act
    const result = await generateStructured(
      buildAgent(generate),
      "prompt",
      TopicSchema,
    );

    // Assert
    expect(result).toEqual(VALID);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("should recover a wrapped response without retrying", async () => {
    // Arrange — 1回目から $schema 包み。復旧できるので再実行してはならない
    const generate = vi
      .fn()
      .mockResolvedValue({ object: { $schema: JSON.stringify(VALID) } });

    // Act
    const result = await generateStructured(
      buildAgent(generate),
      "prompt",
      TopicSchema,
    );

    // Assert
    expect(result).toEqual(VALID);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("should retry when the first attempt yields undefined", async () => {
    // Arrange
    const generate = vi
      .fn()
      .mockResolvedValueOnce({ object: undefined })
      .mockResolvedValueOnce({ object: VALID });

    // Act
    const result = await generateStructured(
      buildAgent(generate),
      "prompt",
      TopicSchema,
    );

    // Assert
    expect(result).toEqual(VALID);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("should throw after exhausting all attempts", async () => {
    // Arrange
    const generate = vi.fn().mockResolvedValue({ object: undefined });

    // Act + Assert
    await expect(
      generateStructured(buildAgent(generate), "prompt", TopicSchema),
    ).rejects.toThrow(/Structured output validation failed/);
    expect(generate).toHaveBeenCalledTimes(3);
  });

  it("should propagate an error thrown by agent.generate", async () => {
    // Arrange
    const generate = vi.fn().mockRejectedValue(new Error("Bedrock timeout"));

    // Act + Assert
    await expect(
      generateStructured(buildAgent(generate), "prompt", TopicSchema),
    ).rejects.toThrow("Bedrock timeout");
  });

  it("should respect a custom maxAttempts", async () => {
    // Arrange
    const generate = vi.fn().mockResolvedValue({ object: undefined });

    // Act + Assert
    await expect(
      generateStructured(buildAgent(generate), "prompt", TopicSchema, 1),
    ).rejects.toThrow(/Structured output validation failed/);
    expect(generate).toHaveBeenCalledTimes(1);
  });
});

// Helpers

const buildAgent = (generate: ReturnType<typeof vi.fn>): Agent =>
  ({ generate }) as unknown as Agent;
