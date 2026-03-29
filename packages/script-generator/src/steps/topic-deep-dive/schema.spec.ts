import { fc, it } from "@fast-check/vitest";
import { describe, expect } from "vitest";
import { EnrichedTopicSchema, EnrichedTopicsOutputSchema } from "./schema";

describe("EnrichedTopicSchema", () => {
  it("should parse a valid enriched topic", () => {
    // Arrange
    const topic = buildEnrichedTopic("news-1");

    // Act
    const result = EnrichedTopicSchema.safeParse(topic);

    // Assert
    expect(result.success).toBe(true);
  });

  it("should fail when xOpinions is missing", () => {
    // Arrange
    const { xOpinions: _omitted, ...withoutOpinions } =
      buildEnrichedTopic("news-1");

    // Act
    const result = EnrichedTopicSchema.safeParse(withoutOpinions);

    // Assert
    expect(result.success).toBe(false);
  });

  it("should fail when detailedContext is missing", () => {
    // Arrange
    const { detailedContext: _omitted, ...withoutContext } =
      buildEnrichedTopic("news-1");

    // Act
    const result = EnrichedTopicSchema.safeParse(withoutContext);

    // Assert
    expect(result.success).toBe(false);
  });

  it("should fail when sourceUrls contain an invalid URL", () => {
    // Arrange
    const topic = {
      ...buildEnrichedTopic("news-1"),
      sourceUrls: ["not-a-url"],
    };

    // Act
    const result = EnrichedTopicSchema.safeParse(topic);

    // Assert
    expect(result.success).toBe(false);
  });

  it("should parse when xOpinions is an empty array", () => {
    // Arrange — no opinions collected is valid (may happen when X search yields nothing)
    const topic = { ...buildEnrichedTopic("news-1"), xOpinions: [] };

    // Act
    const result = EnrichedTopicSchema.safeParse(topic);

    // Assert
    expect(result.success).toBe(true);
  });

  it("should parse when sourceUrls is an empty array", () => {
    // Arrange
    const topic = { ...buildEnrichedTopic("news-1"), sourceUrls: [] };

    // Act
    const result = EnrichedTopicSchema.safeParse(topic);

    // Assert
    expect(result.success).toBe(true);
  });

  it.prop([fc.array(fc.string())])(
    "should accept any array of strings as xOpinions",
    (xOpinions) => {
      // Arrange
      const topic = { ...buildEnrichedTopic("news-1"), xOpinions };

      // Act
      const result = EnrichedTopicSchema.safeParse(topic);

      // Assert
      expect(result.success).toBe(true);
    },
  );
});

describe("EnrichedTopicsOutputSchema", () => {
  it("should parse an array of 3 enriched topics", () => {
    // Arrange
    const topics = [
      buildEnrichedTopic("news-1"),
      buildEnrichedTopic("news-2"),
      buildEnrichedTopic("news-3"),
    ];

    // Act
    const result = EnrichedTopicsOutputSchema.safeParse(topics);

    // Assert
    expect(result.success).toBe(true);
  });

  it("should parse an empty array", () => {
    // Arrange + Act
    const result = EnrichedTopicsOutputSchema.safeParse([]);

    // Assert
    expect(result.success).toBe(true);
  });

  it("should fail when any element is invalid", () => {
    // Arrange — second topic is missing xOpinions
    const topics = [
      buildEnrichedTopic("news-1"),
      {
        id: "news-2",
        title: "タイトル",
        summary: "要約",
        detailedContext: "詳細",
        sourceUrls: [],
      },
      buildEnrichedTopic("news-3"),
    ];

    // Act
    const result = EnrichedTopicsOutputSchema.safeParse(topics);

    // Assert
    expect(result.success).toBe(false);
  });
});

// Helpers

const buildEnrichedTopic = (id: string) => ({
  id,
  title: `${id}: 経済政策の転換`,
  summary: `${id}の概要`,
  xOpinions: ["投資家の反応は概ね肯定的", "一部から懸念の声も"],
  detailedContext: "日銀は2025年以降、段階的な金融政策の正常化を進めている",
  sourceUrls: [
    "https://www.boj.or.jp/en/",
    "https://www.nikkei.com/article/123",
  ],
});
