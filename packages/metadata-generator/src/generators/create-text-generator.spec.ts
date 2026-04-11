// Tests for generators/create-text-generator.ts
//
// Design contract:
//   createTextGenerator(config): (script, mastra) => Effect<T, E>
//     — returns parsed data on success
//     — fails with configured error when agent is not found
//     — fails with configured error when agent.generate rejects
//     — fails with configured error when response.object fails schema validation
//     — fails with configured error when response.object is null
//     — calls getAgent with configured agentId
//     — uses structuredOutput with configured schema

import type { Mastra } from "@mastra/core/mastra";
import { Effect, Result, Schema } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { Script } from "../schema";
import { createTextGenerator } from "./create-text-generator";

// ============================================
// Test-only types
// ============================================

const TestResultSchema = z.object({ text: z.string() });

class TestError extends Schema.TaggedErrorClass<TestError>()("TestError", {
  message: Schema.String,
}) {}

// ============================================
// Test config
// ============================================

const TEST_AGENT_ID = "test-agent";
const TEST_PROMPT = "test prompt for generation";

const testGenerator = createTextGenerator({
  agentId: TEST_AGENT_ID,
  schema: TestResultSchema,
  createError: (message: string) => new TestError({ message }),
  buildPrompt: (_script: Script) => TEST_PROMPT,
});

// ============================================
// Test data
// ============================================

const VALID_RESULT = { text: "generated text" };

const buildValidScript = (): Script =>
  ({
    title: "テストラジオ",
    newsItems: [
      { id: "news-1", title: "ニュース1" },
      { id: "news-2", title: "ニュース2" },
      { id: "news-3", title: "ニュース3" },
    ],
    sections: [],
  }) as unknown as Script;

// ============================================
// Helpers
// ============================================

const buildMockMastra = (generateResponse: unknown): Mastra => {
  const mockAgent = { generate: vi.fn().mockResolvedValue(generateResponse) };
  return { getAgent: vi.fn().mockReturnValue(mockAgent) } as unknown as Mastra;
};

const buildMockMastraWithNoAgent = (): Mastra =>
  ({ getAgent: vi.fn().mockReturnValue(undefined) }) as unknown as Mastra;

const buildMockMastraWithFailingGenerate = (error: Error): Mastra => {
  const mockAgent = { generate: vi.fn().mockRejectedValue(error) };
  return { getAgent: vi.fn().mockReturnValue(mockAgent) } as unknown as Mastra;
};

// ============================================
// Tests
// ============================================

describe("createTextGenerator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return parsed data on success", async () => {
    // Given
    const mockMastra = buildMockMastra({ object: VALID_RESULT });
    const script = buildValidScript();

    // When
    const result = await Effect.runPromise(
      Effect.result(testGenerator(script, mockMastra)),
    );

    // Then
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(result.success.text).toBe(VALID_RESULT.text);
    }
  });

  it("should fail with configured error when agent is not found", async () => {
    // Given
    const mockMastra = buildMockMastraWithNoAgent();
    const script = buildValidScript();

    // When
    const result = await Effect.runPromise(
      Effect.result(testGenerator(script, mockMastra)),
    );

    // Then
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("TestError");
      expect(result.failure.message).toContain(TEST_AGENT_ID);
    }
  });

  it("should fail with configured error when agent.generate rejects", async () => {
    // Given
    const mockMastra = buildMockMastraWithFailingGenerate(
      new Error("Model throttled"),
    );
    const script = buildValidScript();

    // When
    const result = await Effect.runPromise(
      Effect.result(testGenerator(script, mockMastra)),
    );

    // Then
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("TestError");
      expect(result.failure.message).toContain("Model throttled");
    }
  });

  it("should fail with configured error when response.object fails schema validation", async () => {
    // Given — response.object has invalid shape (missing required 'text' field)
    const mockMastra = buildMockMastra({ object: { invalid: true } });
    const script = buildValidScript();

    // When
    const result = await Effect.runPromise(
      Effect.result(testGenerator(script, mockMastra)),
    );

    // Then
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("TestError");
      expect(result.failure.message).toContain(
        "Structured output validation failed",
      );
    }
  });

  it("should fail with configured error when response.object is null", async () => {
    // Given — null object simulates a model returning no structured output
    const mockMastra = buildMockMastra({ object: null });
    const script = buildValidScript();

    // When
    const result = await Effect.runPromise(
      Effect.result(testGenerator(script, mockMastra)),
    );

    // Then
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("TestError");
      expect(result.failure.message).toContain(
        "Structured output validation failed",
      );
    }
  });

  it("should call getAgent with configured agentId", async () => {
    // Given
    const mockMastra = buildMockMastra({ object: VALID_RESULT });
    const script = buildValidScript();

    // When
    await Effect.runPromise(testGenerator(script, mockMastra));

    // Then
    expect(mockMastra.getAgent).toHaveBeenCalledWith(TEST_AGENT_ID);
  });

  it("should use structuredOutput with configured schema", async () => {
    // Given
    const mockAgent = {
      generate: vi.fn().mockResolvedValue({ object: VALID_RESULT }),
    };
    const mockMastra = {
      getAgent: vi.fn().mockReturnValue(mockAgent),
    } as unknown as Mastra;
    const script = buildValidScript();

    // When
    await Effect.runPromise(testGenerator(script, mockMastra));

    // Then
    const [[, options]] = (mockAgent.generate as ReturnType<typeof vi.fn>).mock
      .calls as [[string, { structuredOutput: { schema: unknown } }]];
    expect(options.structuredOutput.schema).toBe(TestResultSchema);
  });
});
