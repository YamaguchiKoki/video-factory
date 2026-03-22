import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Mastra } from "@mastra/core/mastra";
import { topicDeepDiveStep } from "./executor";

describe("topicDeepDiveStep", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should return an enriched topic when agent generates successfully", async () => {
    // Arrange
    const validEnrichedTopic = buildEnrichedTopic("news-1");
    const mockMastra = buildMockMastra({ object: validEnrichedTopic });

    // Act
    const result = await topicDeepDiveStep.execute(
      buildParams(buildInputTopic("news-1"), mockMastra),
    );

    // Assert
    expect(result).toEqual(validEnrichedTopic);
  });

  it("should throw when topic-deep-dive-agent is not registered in mastra", async () => {
    // Arrange
    const mockMastra = buildMockMastraWithNoAgent();

    // Act + Assert
    await expect(
      topicDeepDiveStep.execute(
        buildParams(buildInputTopic("news-1"), mockMastra),
      ),
    ).rejects.toThrow("topic-deep-dive-agent not found");
  });

  it("should throw when agent.generate rejects", async () => {
    // Arrange
    const mockMastra = buildMockMastraWithFailingGenerate(
      new Error("Model overloaded"),
    );

    // Act + Assert
    await expect(
      topicDeepDiveStep.execute(
        buildParams(buildInputTopic("news-1"), mockMastra),
      ),
    ).rejects.toThrow("Model overloaded");
  });

  it("should throw when response.object fails EnrichedTopicSchema validation", async () => {
    // Arrange — response.object is missing required fields (xOpinions, detailedContext, sourceUrls)
    const invalidObject = { id: "news-1", title: "some title" };
    const mockMastra = buildMockMastra({ object: invalidObject });

    // Act + Assert — validation failure must propagate as a thrown error
    await expect(
      topicDeepDiveStep.execute(
        buildParams(buildInputTopic("news-1"), mockMastra),
      ),
    ).rejects.toThrow(/Structured output validation failed/);
  });

  it("should throw when response.object is null", async () => {
    // Arrange — null object simulates a model returning no structured output
    const mockMastra = buildMockMastra({ object: null });

    // Act + Assert
    await expect(
      topicDeepDiveStep.execute(
        buildParams(buildInputTopic("news-1"), mockMastra),
      ),
    ).rejects.toThrow(/Structured output validation failed/);
  });

  it("should call getAgent with the correct agent id", async () => {
    // Arrange
    const mockAgent = {
      generate: vi.fn().mockResolvedValue({ object: buildEnrichedTopic("news-1") }),
    };
    const mockGetAgent = vi.fn().mockReturnValue(mockAgent);
    const mockMastra = { getAgent: mockGetAgent } as unknown as Mastra;

    // Act
    await topicDeepDiveStep.execute(buildParams(buildInputTopic("news-1"), mockMastra));

    // Assert
    expect(mockGetAgent).toHaveBeenCalledWith("topic-deep-dive-agent");
  });

  it("should include the topic title in the agent prompt", async () => {
    // Arrange
    const mockAgent = {
      generate: vi.fn().mockResolvedValue({ object: buildEnrichedTopic("news-1") }),
    };
    const mockMastra = { getAgent: vi.fn().mockReturnValue(mockAgent) } as unknown as Mastra;
    const topic = buildInputTopic("news-1");

    // Act
    await topicDeepDiveStep.execute(buildParams(topic, mockMastra));

    // Assert — topic title must appear in the prompt to scope the search
    const [[promptArg]] = (mockAgent.generate as ReturnType<typeof vi.fn>).mock.calls as [[string, unknown]];
    expect(promptArg).toContain(topic.title);
  });
});

// Helpers

const buildInputTopic = (id: string) => ({
  id,
  title: `${id}: 日銀追加利上げ`,
  summary: `${id}の要約`,
});

const buildEnrichedTopic = (id: string) => ({
  id,
  title: `${id}: 日銀追加利上げ`,
  summary: `${id}の要約`,
  xOpinions: ["市場は概ね織り込み済み", "円高が進む可能性"],
  detailedContext: "日銀は2025年3月の政策会合で0.25%の追加利上げを決定した",
  sourceUrls: ["https://www.boj.or.jp/en/mopo/mpmdeci/mpr_2025/", "https://x.com/search?q=日銀利上げ"],
});

const buildParams = (
  inputData: ReturnType<typeof buildInputTopic>,
  mastra: Mastra,
) =>
  ({ inputData, mastra }) as unknown as Parameters<
    typeof topicDeepDiveStep.execute
  >[0];

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
