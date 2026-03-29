import { fc, it } from "@fast-check/vitest";
import { describe, expect } from "vitest";
import { TopicSchema, TopicsOutputSchema, WorkflowInputSchema } from "./schema";

describe("WorkflowInputSchema", () => {
  it("should parse valid genre input", () => {
    // Arrange
    const input = { genre: "政治経済" };

    // Act
    const result = WorkflowInputSchema.safeParse(input);

    // Assert
    expect(result.success).toBe(true);
  });

  it("should fail when genre is missing", () => {
    // Arrange
    const input = {};

    // Act
    const result = WorkflowInputSchema.safeParse(input);

    // Assert
    expect(result.success).toBe(false);
  });

  it("should fail when genre is not a string", () => {
    // Arrange
    const input = { genre: 42 };

    // Act
    const result = WorkflowInputSchema.safeParse(input);

    // Assert
    expect(result.success).toBe(false);
  });

  it.prop([fc.string({ minLength: 1 })])(
    "should parse any non-empty genre string",
    (genre) => {
      // Arrange + Act
      const result = WorkflowInputSchema.safeParse({ genre });

      // Assert
      expect(result.success).toBe(true);
    },
  );
});

describe("TopicSchema", () => {
  it("should parse a valid topic without optional sourceUrls", () => {
    // Arrange
    const topic = {
      id: "news-1",
      title: "日銀、追加利上げを決定",
      summary: "日本銀行は政策会合で追加利上げを決定した",
    };

    // Act
    const result = TopicSchema.safeParse(topic);

    // Assert
    expect(result.success).toBe(true);
  });

  it("should parse a topic with valid sourceUrls", () => {
    // Arrange
    const topic = {
      id: "news-1",
      title: "日銀、追加利上げを決定",
      summary: "日本銀行は政策会合で追加利上げを決定した",
      sourceUrls: [
        "https://www.nhk.or.jp/news/article1",
        "https://www.boj.or.jp/en/",
      ],
    };

    // Act
    const result = TopicSchema.safeParse(topic);

    // Assert
    expect(result.success).toBe(true);
  });

  it("should fail when sourceUrls contain an invalid URL", () => {
    // Arrange
    const topic = {
      id: "news-1",
      title: "タイトル",
      summary: "要約",
      sourceUrls: ["not-a-valid-url"],
    };

    // Act
    const result = TopicSchema.safeParse(topic);

    // Assert
    expect(result.success).toBe(false);
  });

  it("should fail when required fields are missing", () => {
    // Arrange
    const incomplete = { id: "news-1" };

    // Act
    const result = TopicSchema.safeParse(incomplete);

    // Assert
    expect(result.success).toBe(false);
  });

  it("should fail when id is missing", () => {
    // Arrange
    const topic = { title: "タイトル", summary: "要約" };

    // Act
    const result = TopicSchema.safeParse(topic);

    // Assert
    expect(result.success).toBe(false);
  });
});

describe("TopicsOutputSchema", () => {
  it("should parse an array of exactly 3 topics", () => {
    // Arrange
    const topics = [
      buildTopic("news-1"),
      buildTopic("news-2"),
      buildTopic("news-3"),
    ];

    // Act
    const result = TopicsOutputSchema.safeParse(topics);

    // Assert
    expect(result.success).toBe(true);
  });

  it("should fail for fewer than 3 topics", () => {
    // Arrange
    const topics = [buildTopic("news-1"), buildTopic("news-2")];

    // Act
    const result = TopicsOutputSchema.safeParse(topics);

    // Assert
    expect(result.success).toBe(false);
  });

  it("should fail for more than 3 topics", () => {
    // Arrange
    const topics = [
      buildTopic("news-1"),
      buildTopic("news-2"),
      buildTopic("news-3"),
      buildTopic("news-4"),
    ];

    // Act
    const result = TopicsOutputSchema.safeParse(topics);

    // Assert
    expect(result.success).toBe(false);
  });

  it("should fail for non-array input", () => {
    // Arrange
    const notAnArray = buildTopic("news-1");

    // Act
    const result = TopicsOutputSchema.safeParse(notAnArray);

    // Assert
    expect(result.success).toBe(false);
  });

  it("should fail when any topic in the array is invalid", () => {
    // Arrange — second topic is missing title
    const topics = [
      buildTopic("news-1"),
      { id: "news-2", summary: "要約" },
      buildTopic("news-3"),
    ];

    // Act
    const result = TopicsOutputSchema.safeParse(topics);

    // Assert
    expect(result.success).toBe(false);
  });
});

// Helpers

const buildTopic = (id: string) => ({
  id,
  title: `ニュース: ${id}`,
  summary: `${id}の要約`,
});
