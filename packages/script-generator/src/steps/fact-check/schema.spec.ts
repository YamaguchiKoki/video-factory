import { fc, it } from "@fast-check/vitest";
import { describe, expect } from "vitest";
import { VerifiedTopicSchema, VerifiedTopicsOutputSchema } from "./schema";

describe("VerifiedTopicSchema", () => {
  it("should parse a valid verified topic", () => {
    // Arrange
    const topic = buildVerifiedTopic("news-1");

    // Act
    const result = VerifiedTopicSchema.safeParse(topic);

    // Assert
    expect(result.success).toBe(true);
  });

  it("should parse a topic with an empty contradictions array", () => {
    // Arrange — no contradictions found is valid
    const topic = { ...buildVerifiedTopic("news-1"), contradictions: [] };

    // Act
    const result = VerifiedTopicSchema.safeParse(topic);

    // Assert
    expect(result.success).toBe(true);
  });

  it("should fail when reliabilityScore is below 0", () => {
    // Arrange
    const topic = { ...buildVerifiedTopic("news-1"), reliabilityScore: -0.01 };

    // Act
    const result = VerifiedTopicSchema.safeParse(topic);

    // Assert
    expect(result.success).toBe(false);
  });

  it("should fail when reliabilityScore is above 1", () => {
    // Arrange
    const topic = { ...buildVerifiedTopic("news-1"), reliabilityScore: 1.01 };

    // Act
    const result = VerifiedTopicSchema.safeParse(topic);

    // Assert
    expect(result.success).toBe(false);
  });

  it("should parse reliabilityScore at boundary values 0 and 1", () => {
    // Arrange + Act + Assert — boundary values must be valid
    expect(
      VerifiedTopicSchema.safeParse({
        ...buildVerifiedTopic("news-1"),
        reliabilityScore: 0,
      }).success,
    ).toBe(true);
    expect(
      VerifiedTopicSchema.safeParse({
        ...buildVerifiedTopic("news-1"),
        reliabilityScore: 1,
      }).success,
    ).toBe(true);
  });

  it("should fail when sourceUrls contain an invalid URL", () => {
    // Arrange
    const topic = { ...buildVerifiedTopic("news-1"), sourceUrls: ["bad-url"] };

    // Act
    const result = VerifiedTopicSchema.safeParse(topic);

    // Assert
    expect(result.success).toBe(false);
  });

  it("should fail when required fields are missing", () => {
    // Arrange
    const incomplete = { id: "news-1", title: "タイトル" };

    // Act
    const result = VerifiedTopicSchema.safeParse(incomplete);

    // Assert
    expect(result.success).toBe(false);
  });

  it.prop([fc.float({ min: 0, max: 1, noNaN: true })])(
    "should parse any reliabilityScore in [0, 1]",
    (reliabilityScore) => {
      // Arrange
      const topic = { ...buildVerifiedTopic("news-1"), reliabilityScore };

      // Act
      const result = VerifiedTopicSchema.safeParse(topic);

      // Assert
      expect(result.success).toBe(true);
    },
  );

  it.prop([
    fc
      .oneof(
        fc.float({ max: -Number.EPSILON }),
        fc.float({ min: Math.fround(1 + 2 ** -23) }),
      )
      .filter((n) => !Number.isNaN(n) && Number.isFinite(n)),
  ])(
    "should reject any reliabilityScore outside [0, 1]",
    (reliabilityScore) => {
      // Arrange
      const topic = { ...buildVerifiedTopic("news-1"), reliabilityScore };

      // Act
      const result = VerifiedTopicSchema.safeParse(topic);

      // Assert
      expect(result.success).toBe(false);
    },
  );
});

describe("VerifiedTopicsOutputSchema", () => {
  it("should parse an array of 3 verified topics", () => {
    // Arrange
    const topics = [
      buildVerifiedTopic("news-1"),
      buildVerifiedTopic("news-2"),
      buildVerifiedTopic("news-3"),
    ];

    // Act
    const result = VerifiedTopicsOutputSchema.safeParse(topics);

    // Assert
    expect(result.success).toBe(true);
  });

  it("should parse an empty array", () => {
    // Arrange + Act
    const result = VerifiedTopicsOutputSchema.safeParse([]);

    // Assert
    expect(result.success).toBe(true);
  });

  it("should fail when an element has an invalid reliabilityScore", () => {
    // Arrange — second topic has score above 1
    const topics = [
      buildVerifiedTopic("news-1"),
      { ...buildVerifiedTopic("news-2"), reliabilityScore: 2 },
      buildVerifiedTopic("news-3"),
    ];

    // Act
    const result = VerifiedTopicsOutputSchema.safeParse(topics);

    // Assert
    expect(result.success).toBe(false);
  });
});

// Helpers

const buildVerifiedTopic = (id: string) => ({
  id,
  title: `${id}: 日銀政策の影響`,
  verifiedFacts: [
    "日銀は2025年3月20日に0.25%の利上げを決定した",
    "市場は事前に85%の確率で織り込んでいた",
  ],
  reliabilityScore: 0.87,
  contradictions: [],
  sourceUrls: [
    "https://www.boj.or.jp/en/",
    "https://www.reuters.com/article/japan-boj",
  ],
});
