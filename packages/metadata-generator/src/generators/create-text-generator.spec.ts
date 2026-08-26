import type { Mastra } from "@mastra/core/mastra";
import { Cause, Effect, type Exit, Option } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createTextGenerator } from "./create-text-generator";

const ResultSchema = z.object({ text: z.string() });
const VALID = { text: "概要欄テキスト" };

const TEST_AGENT_ID = "test-agent";

type TestError = { readonly message: string };

// Proves the failure travelled through the typed error channel
// (Effect.fail via config.createError), not an escaped exception
// (Effect.die). `runPromiseExit`'s `_tag: "Failure"` is true for both, so
// asserting only that would still pass if the implementation regressed to
// throwing. Cause.findErrorOption returns Some only when the cause
// contains a Fail reason; it returns None for a cause made only of Die
// (or Interrupt) reasons.
const expectTypedFailureMessage = (
  exit: Exit.Exit<unknown, TestError>,
  expectedSubstring: string,
): void => {
  expect(exit._tag).toBe("Failure");
  if (exit._tag !== "Failure") return;

  const errorOption = Cause.findErrorOption(exit.cause);
  expect(Option.isSome(errorOption)).toBe(true);
  if (!Option.isSome(errorOption)) return;

  expect(errorOption.value.message).toContain(expectedSubstring);
};

const buildScript = () =>
  ({ title: "タイトル", newsItems: [], sections: [] }) as never;

const buildMastra = (generate: ReturnType<typeof vi.fn>): Mastra =>
  ({ getAgent: vi.fn().mockReturnValue({ generate }) }) as unknown as Mastra;

const buildMastraWithNoAgent = (): Mastra =>
  ({ getAgent: vi.fn().mockReturnValue(undefined) }) as unknown as Mastra;

const generator = createTextGenerator({
  agentId: TEST_AGENT_ID,
  schema: ResultSchema,
  createError: (message: string) => ({ message }),
  buildPrompt: () => "prompt",
});

describe("createTextGenerator", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should return the parsed value on the first attempt without retrying", async () => {
    // Arrange
    const generate = vi.fn().mockResolvedValue({ object: VALID });

    // Act
    const result = await Effect.runPromise(
      generator(buildScript(), buildMastra(generate)),
    );

    // Assert
    expect(result).toEqual(VALID);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("should recover a wrapped response without retrying", async () => {
    // Arrange
    const generate = vi
      .fn()
      .mockResolvedValue({ object: { $schema: JSON.stringify(VALID) } });

    // Act
    const result = await Effect.runPromise(
      generator(buildScript(), buildMastra(generate)),
    );

    // Assert
    expect(result).toEqual(VALID);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("should retry when the response is undefined and succeed on the second attempt", async () => {
    // Arrange
    const generate = vi
      .fn()
      .mockResolvedValueOnce({ object: undefined })
      .mockResolvedValueOnce({ object: VALID });

    // Act
    const result = await Effect.runPromise(
      generator(buildScript(), buildMastra(generate)),
    );

    // Assert
    expect(result).toEqual(VALID);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("should fail after three failed attempts, and identify the agent in the failure", async () => {
    // Arrange
    const generate = vi.fn().mockResolvedValue({ object: undefined });

    // Act
    const exit = await Effect.runPromiseExit(
      generator(buildScript(), buildMastra(generate)),
    );

    // Assert
    expect(generate).toHaveBeenCalledTimes(3);
    expectTypedFailureMessage(exit, TEST_AGENT_ID);
  });

  it("should fail after three attempts when the object is schema-invalid on every attempt", async () => {
    // Arrange — right key, wrong value type: a plausible near-miss from the
    // model, not garbage. Populated-but-wrong travels a different path
    // through parseStructuredOutput than `undefined` (it attempts unwrap
    // recovery first), so this exercises a distinct branch from the
    // "three failed attempts" test above.
    const generate = vi.fn().mockResolvedValue({ object: { text: 42 } });

    // Act
    const exit = await Effect.runPromiseExit(
      generator(buildScript(), buildMastra(generate)),
    );

    // Assert
    expect(generate).toHaveBeenCalledTimes(3);
    expectTypedFailureMessage(exit, "Structured output validation failed");
  });

  it("should fail after three attempts when the object is null on every attempt", async () => {
    // Arrange
    const generate = vi.fn().mockResolvedValue({ object: null });

    // Act
    const exit = await Effect.runPromiseExit(
      generator(buildScript(), buildMastra(generate)),
    );

    // Assert
    expect(generate).toHaveBeenCalledTimes(3);
    expectTypedFailureMessage(exit, "Structured output validation failed");
  });

  it("should fail with configured error when agent is not found, without calling generate", async () => {
    // Arrange
    const mastra = buildMastraWithNoAgent();

    // Act
    const exit = await Effect.runPromiseExit(generator(buildScript(), mastra));

    // Assert
    expectTypedFailureMessage(exit, TEST_AGENT_ID);
  });

  it("should fail immediately (no retry) when agent.generate rejects", async () => {
    // Arrange
    const generate = vi.fn().mockRejectedValue(new Error("Model throttled"));

    // Act
    const exit = await Effect.runPromiseExit(
      generator(buildScript(), buildMastra(generate)),
    );

    // Assert
    expect(generate).toHaveBeenCalledTimes(1);
    expectTypedFailureMessage(exit, "Model throttled");
  });

  it("should call getAgent with configured agentId", async () => {
    // Arrange
    const generate = vi.fn().mockResolvedValue({ object: VALID });
    const mastra = buildMastra(generate);

    // Act
    await Effect.runPromise(generator(buildScript(), mastra));

    // Assert
    expect(mastra.getAgent).toHaveBeenCalledWith(TEST_AGENT_ID);
  });

  it("should use structuredOutput with the configured schema", async () => {
    // Arrange
    const generate = vi.fn().mockResolvedValue({ object: VALID });
    const mastra = buildMastra(generate);

    // Act
    await Effect.runPromise(generator(buildScript(), mastra));

    // Assert
    const [[, options]] = generate.mock.calls as [
      [string, { structuredOutput: { schema: unknown } }],
    ];
    expect(options.structuredOutput.schema).toBe(ResultSchema);
  });
});
