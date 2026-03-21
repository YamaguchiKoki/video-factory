import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Mastra } from "@mastra/core/mastra";
import { factCheckStep } from "./executor";

describe("factCheckStep", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should return verified topics when agent generates successfully", async () => {
    // Arrange
    const verifiedTopics = [
      buildVerifiedTopic("news-1"),
      buildVerifiedTopic("news-2"),
      buildVerifiedTopic("news-3"),
    ];
    const mockMastra = buildMockMastra({ object: verifiedTopics });

    // Act
    const result = await factCheckStep.execute(
      buildParams(buildEnrichedTopics(), mockMastra),
    );

    // Assert
    expect(result).toEqual(verifiedTopics);
  });

  it("should throw when fact-check-agent is not registered in mastra", async () => {
    // Arrange
    const mockMastra = buildMockMastraWithNoAgent();

    // Act + Assert
    await expect(
      factCheckStep.execute(buildParams(buildEnrichedTopics(), mockMastra)),
    ).rejects.toThrow("fact-check-agent not found");
  });

  it("should throw when agent.generate rejects", async () => {
    // Arrange
    const mockMastra = buildMockMastraWithFailingGenerate(
      new Error("Rate limit exceeded"),
    );

    // Act + Assert
    await expect(
      factCheckStep.execute(buildParams(buildEnrichedTopics(), mockMastra)),
    ).rejects.toThrow("Rate limit exceeded");
  });

  it("should call getAgent with the correct agent id", async () => {
    // Arrange
    const mockAgent = {
      generate: vi.fn().mockResolvedValue({
        object: [buildVerifiedTopic("news-1")],
      }),
    };
    const mockGetAgent = vi.fn().mockReturnValue(mockAgent);
    const mockMastra = { getAgent: mockGetAgent } as unknown as Mastra;

    // Act
    await factCheckStep.execute(buildParams(buildEnrichedTopics(), mockMastra));

    // Assert
    expect(mockGetAgent).toHaveBeenCalledWith("fact-check-agent");
  });
});

// Helpers

type EnrichedTopic = {
  id: string;
  title: string;
  summary: string;
  xOpinions: string[];
  detailedContext: string;
  sourceUrls: string[];
};

const buildEnrichedTopics = (): EnrichedTopic[] => [
  {
    id: "news-1",
    title: "日銀追加利上げ",
    summary: "0.25%の利上げ決定",
    xOpinions: ["市場は概ね織り込み済み"],
    detailedContext: "2025年3月20日の政策決定会合にて",
    sourceUrls: ["https://www.boj.or.jp/en/"],
  },
  {
    id: "news-2",
    title: "円相場の動向",
    summary: "利上げ後に円高が進む",
    xOpinions: ["輸出企業への影響が懸念される"],
    detailedContext: "利上げ発表後、ドル円は1ドル142円台に",
    sourceUrls: ["https://www.nikkei.com/markets/"],
  },
  {
    id: "news-3",
    title: "政府の財政政策",
    summary: "予算案が国会で審議中",
    xOpinions: ["野党は増税を懸念"],
    detailedContext: "2025年度補正予算について与野党が議論",
    sourceUrls: ["https://www.sangiin.go.jp/"],
  },
];

const buildVerifiedTopic = (id: string) => ({
  id,
  title: `${id}: 検証済みニュース`,
  verifiedFacts: ["確認済み事実"],
  reliabilityScore: 0.9,
  contradictions: [],
  sourceUrls: ["https://example.com/verified"],
});

const buildParams = (
  inputData: EnrichedTopic[],
  mastra: Mastra,
) =>
  ({ inputData, mastra }) as unknown as Parameters<
    typeof factCheckStep.execute
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
