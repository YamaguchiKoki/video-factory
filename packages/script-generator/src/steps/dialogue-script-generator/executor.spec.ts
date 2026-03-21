import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Mastra } from "@mastra/core/mastra";
import { dialogueScriptGeneratorStep } from "./executor";

describe("dialogueScriptGeneratorStep", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should return a Script when agent generates successfully", async () => {
    // Arrange
    const validScript = buildValidScript();
    const mockMastra = buildMockMastra({ object: validScript });

    // Act
    const result = await dialogueScriptGeneratorStep.execute(
      buildParams(buildVerifiedTopics(), mockMastra),
    );

    // Assert
    expect(result).toEqual(validScript);
  });

  it("should throw when dialogue-script-generator-agent is not registered in mastra", async () => {
    // Arrange
    const mockMastra = buildMockMastraWithNoAgent();

    // Act + Assert
    await expect(
      dialogueScriptGeneratorStep.execute(
        buildParams(buildVerifiedTopics(), mockMastra),
      ),
    ).rejects.toThrow("dialogue-script-generator-agent not found");
  });

  it("should throw when agent.generate rejects", async () => {
    // Arrange
    const mockMastra = buildMockMastraWithFailingGenerate(
      new Error("Context window exceeded"),
    );

    // Act + Assert
    await expect(
      dialogueScriptGeneratorStep.execute(
        buildParams(buildVerifiedTopics(), mockMastra),
      ),
    ).rejects.toThrow("Context window exceeded");
  });

  it("should call getAgent with the correct agent id", async () => {
    // Arrange
    const mockAgent = {
      generate: vi.fn().mockResolvedValue({ object: buildValidScript() }),
    };
    const mockGetAgent = vi.fn().mockReturnValue(mockAgent);
    const mockMastra = { getAgent: mockGetAgent } as unknown as Mastra;

    // Act
    await dialogueScriptGeneratorStep.execute(
      buildParams(buildVerifiedTopics(), mockMastra),
    );

    // Assert
    expect(mockGetAgent).toHaveBeenCalledWith("dialogue-script-generator-agent");
  });
});

// Helpers

type VerifiedTopic = {
  id: string;
  title: string;
  verifiedFacts: string[];
  reliabilityScore: number;
  contradictions: string[];
  sourceUrls: string[];
};

const buildVerifiedTopics = (): VerifiedTopic[] => [
  {
    id: "news-1",
    title: "日銀追加利上げ決定",
    verifiedFacts: ["2025年3月20日に0.25%利上げを決定", "市場はほぼ織り込み済み"],
    reliabilityScore: 0.93,
    contradictions: [],
    sourceUrls: ["https://www.boj.or.jp/en/"],
  },
  {
    id: "news-2",
    title: "円相場の急伸",
    verifiedFacts: ["ドル円が142円台へ", "3ヶ月ぶりの円高水準"],
    reliabilityScore: 0.88,
    contradictions: [],
    sourceUrls: ["https://www.nikkei.com/markets/"],
  },
  {
    id: "news-3",
    title: "政府の補正予算審議",
    verifiedFacts: ["総額15兆円規模", "国会で与野党攻防"],
    reliabilityScore: 0.82,
    contradictions: ["財務省と内閣府で試算に差異"],
    sourceUrls: ["https://www.sangiin.go.jp/"],
  },
];

const buildLine = (speaker: "A" | "B", text: string) => ({ speaker, text });

const buildDiscussionSection = (newsId: string) => ({
  type: "discussion" as const,
  newsId,
  blocks: [
    { phase: "summary" as const, lines: [buildLine("A", "解説"), buildLine("B", "質問")] },
    { phase: "background" as const, lines: [buildLine("A", "背景"), buildLine("B", "確認")] },
    { phase: "deepDive" as const, lines: [buildLine("A", "深掘り"), buildLine("B", "感想")] },
  ],
});

const buildValidScript = () => ({
  title: "今日の政治経済ニュースラジオ",
  newsItems: [
    { id: "news-1", title: "日銀追加利上げ決定" },
    { id: "news-2", title: "円相場の急伸" },
    { id: "news-3", title: "政府の補正予算審議" },
  ],
  sections: [
    {
      type: "intro" as const,
      greeting: [buildLine("A", "こんにちは"), buildLine("B", "よろしく")],
      newsOverview: [buildLine("A", "今日の3ニュース")],
    },
    buildDiscussionSection("news-1"),
    buildDiscussionSection("news-2"),
    buildDiscussionSection("news-3"),
    {
      type: "outro" as const,
      recap: [buildLine("A", "まとめ")],
      closing: [buildLine("A", "さようなら"), buildLine("B", "また明日")],
    },
  ],
});

const buildParams = (
  inputData: VerifiedTopic[],
  mastra: Mastra,
) =>
  ({ inputData, mastra }) as unknown as Parameters<
    typeof dialogueScriptGeneratorStep.execute
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
