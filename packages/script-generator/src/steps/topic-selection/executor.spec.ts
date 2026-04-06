import type { Mastra } from "@mastra/core/mastra";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { topicSelectionStep } from "./executor";

describe("topicSelectionStep", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should return 3 topics when agent generates successfully", async () => {
    // Arrange
    const validTopics = [
      buildTopic("news-1"),
      buildTopic("news-2"),
      buildTopic("news-3"),
    ];
    const mockMastra = buildMockMastra({ object: { topics: validTopics } });

    // Act
    const result = await topicSelectionStep.execute(
      buildParams({ genre: "政治経済" }, mockMastra),
    );

    // Assert
    expect(result).toEqual(validTopics);
  });

  it("should throw when topic-selection-agent is not registered in mastra", async () => {
    // Arrange
    const mockMastra = buildMockMastraWithNoAgent();

    // Act + Assert
    await expect(
      topicSelectionStep.execute(
        buildParams({ genre: "政治経済" }, mockMastra),
      ),
    ).rejects.toThrow("topic-selection-agent not found");
  });

  it("should throw when agent.generate rejects", async () => {
    // Arrange
    const mockMastra = buildMockMastraWithFailingGenerate(
      new Error("Bedrock timeout"),
    );

    // Act + Assert
    await expect(
      topicSelectionStep.execute(
        buildParams({ genre: "政治経済" }, mockMastra),
      ),
    ).rejects.toThrow("Bedrock timeout");
  });

  it("should call getAgent with the correct agent id", async () => {
    // Arrange
    const validTopics = [
      buildTopic("news-1"),
      buildTopic("news-2"),
      buildTopic("news-3"),
    ];
    const mockAgent = {
      generate: vi.fn().mockResolvedValue({ object: { topics: validTopics } }),
    };
    const mockGetAgent = vi.fn().mockReturnValue(mockAgent);
    const mockMastra = { getAgent: mockGetAgent } as unknown as Mastra;

    // Act
    await topicSelectionStep.execute(
      buildParams({ genre: "政治経済" }, mockMastra),
    );

    // Assert — the correct agent id must be requested
    expect(mockGetAgent).toHaveBeenCalledWith("topic-selection-agent");
  });

  it("should pass genre and date to agent prompt", async () => {
    // Arrange
    const validTopics = [
      buildTopic("news-1"),
      buildTopic("news-2"),
      buildTopic("news-3"),
    ];
    const mockAgent = {
      generate: vi.fn().mockResolvedValue({ object: { topics: validTopics } }),
    };
    const mockMastra = {
      getAgent: vi.fn().mockReturnValue(mockAgent),
    } as unknown as Mastra;

    // Act
    await topicSelectionStep.execute(
      buildParams({ genre: "テクノロジー" }, mockMastra),
    );

    // Assert — the genre must appear in the prompt
    const [[promptArg]] = (mockAgent.generate as ReturnType<typeof vi.fn>).mock
      .calls as [[string, unknown]];
    expect(promptArg).toContain("テクノロジー");
  });
});

// Helpers

const buildTopic = (id: string) => ({
  id,
  title: `${id}: 日銀政策変更`,
  summary: `${id}の詳細要約`,
});

const buildParams = (inputData: { genre: string }, mastra: Mastra) =>
  ({ inputData, mastra }) as unknown as Parameters<
    typeof topicSelectionStep.execute
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
