import { fc, it } from "@fast-check/vitest";
import type { Agent } from "@mastra/core/agent";
import { beforeEach, describe, expect, vi } from "vitest";
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

  it("should propagate an error thrown by agent.generate without retrying", async () => {
    // Arrange
    const generate = vi.fn().mockRejectedValue(new Error("Bedrock timeout"));

    // Act + Assert
    await expect(
      generateStructured(buildAgent(generate), "prompt", TopicSchema),
    ).rejects.toThrow("Bedrock timeout");
    expect(generate).toHaveBeenCalledTimes(1);
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

  it.prop([
    fc.integer({ min: 1, max: 5 }).chain((maxAttempts) =>
      fc.record({
        maxAttempts: fc.constant(maxAttempts),
        attemptToSucceed: fc.integer({ min: 1, max: maxAttempts }),
      }),
    ),
  ])(
    "should succeed exactly on attemptToSucceed and call agent.generate that many times",
    async ({ maxAttempts, attemptToSucceed }) => {
      // Arrange — undefined for every attempt before attemptToSucceed, then a valid object
      const generate = vi.fn();
      Array.from({ length: attemptToSucceed - 1 }).forEach(() => {
        generate.mockResolvedValueOnce({
          object: undefined,
          finishReason: "length",
        });
      });
      generate.mockResolvedValueOnce({ object: VALID, finishReason: "stop" });

      // Act
      const result = await generateStructured(
        buildAgent(generate),
        "prompt",
        TopicSchema,
        maxAttempts,
      );

      // Assert
      expect(result).toEqual(VALID);
      expect(generate).toHaveBeenCalledTimes(attemptToSucceed);
    },
  );

  // 上記の property は成功パスしか踏まないため、n >= maxAttempts の境界
  // （呼び出し回数を maxAttempts で必ず打ち切る、という不変条件）を検出
  // できない。succeedsOnAttempt が maxAttempts を超えるケース（予算内で
  // 一度も成功しない）まで含めることで境界を直接検証する。
  it.prop([
    fc.integer({ min: 1, max: 5 }).chain((maxAttempts) =>
      fc.record({
        maxAttempts: fc.constant(maxAttempts),
        succeedsOnAttempt: fc.integer({ min: 1, max: maxAttempts + 1 }),
      }),
    ),
  ])(
    "should never call agent.generate more than maxAttempts times",
    async ({ maxAttempts, succeedsOnAttempt }) => {
      // Arrange — succeedsOnAttempt > maxAttempts means it never succeeds
      const neverSucceeds = succeedsOnAttempt > maxAttempts;
      const failingCalls = neverSucceeds ? maxAttempts : succeedsOnAttempt - 1;
      const generate = vi.fn();
      Array.from({ length: failingCalls }).forEach(() => {
        generate.mockResolvedValueOnce({
          object: undefined,
          finishReason: "length",
        });
      });
      if (!neverSucceeds) {
        generate.mockResolvedValueOnce({ object: VALID, finishReason: "stop" });
      } else {
        // Fallback for any surplus call beyond maxAttempts: a well-formed
        // failing response, so an over-calling regression fails on the
        // toHaveBeenCalledTimes assertion below instead of crashing on
        // response.object being read off an exhausted mock's `undefined`.
        generate.mockResolvedValue({
          object: undefined,
          finishReason: "length",
        });
      }

      // Act + Assert
      if (neverSucceeds) {
        await expect(
          generateStructured(
            buildAgent(generate),
            "prompt",
            TopicSchema,
            maxAttempts,
          ),
        ).rejects.toThrow(/Structured output validation failed/);
      } else {
        const result = await generateStructured(
          buildAgent(generate),
          "prompt",
          TopicSchema,
          maxAttempts,
        );
        expect(result).toEqual(VALID);
      }
      expect(generate).toHaveBeenCalledTimes(
        neverSucceeds ? maxAttempts : succeedsOnAttempt,
      );
    },
  );
});

// Helpers

const buildAgent = (generate: ReturnType<typeof vi.fn>): Agent =>
  ({ generate }) as unknown as Agent;
