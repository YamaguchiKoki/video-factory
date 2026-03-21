import { describe, expect } from "vitest";
import { it } from "@fast-check/vitest";
import { ScriptSchema } from "./schema";

// ScriptSchema is the final output of the entire pipeline.
// These tests document the exact shape the dialogue-script-generator must produce.

describe("ScriptSchema", () => {
  it("should parse a valid complete script", () => {
    // Arrange
    const script = buildValidScript();

    // Act
    const result = ScriptSchema.safeParse(script);

    // Assert
    expect(result.success).toBe(true);
  });

  it("should fail when newsItems count is not 3", () => {
    // Arrange — only 2 news items
    const script = {
      ...buildValidScript(),
      newsItems: [buildNewsItem("news-1"), buildNewsItem("news-2")],
    };

    // Act
    const result = ScriptSchema.safeParse(script);

    // Assert
    expect(result.success).toBe(false);
  });

  it("should fail when sections tuple has wrong structure", () => {
    // Arrange — only intro section, missing discussion and outro
    const script = {
      ...buildValidScript(),
      sections: [buildIntroSection()],
    };

    // Act
    const result = ScriptSchema.safeParse(script);

    // Assert
    expect(result.success).toBe(false);
  });

  it("should fail when sections tuple has wrong section order", () => {
    // Arrange — outro placed before discussions
    const script = {
      ...buildValidScript(),
      sections: [
        buildIntroSection(),
        buildOutroSection(),
        buildDiscussionSection("news-1"),
        buildDiscussionSection("news-2"),
        buildDiscussionSection("news-3"),
      ],
    };

    // Act
    const result = ScriptSchema.safeParse(script);

    // Assert
    expect(result.success).toBe(false);
  });

  it("should fail when a speaker value is not 'A' or 'B'", () => {
    // Arrange — speaker 'C' is invalid
    const script = {
      ...buildValidScript(),
      sections: [
        {
          ...buildIntroSection(),
          greeting: [{ speaker: "C", text: "こんにちは" }],
        },
        buildDiscussionSection("news-1"),
        buildDiscussionSection("news-2"),
        buildDiscussionSection("news-3"),
        buildOutroSection(),
      ],
    };

    // Act
    const result = ScriptSchema.safeParse(script);

    // Assert
    expect(result.success).toBe(false);
  });

  it("should fail when a discussion section is missing a phase block", () => {
    // Arrange — blocks tuple has only 2 elements instead of 3
    const incompleteDiscussion = {
      type: "discussion" as const,
      newsId: "news-1",
      blocks: [
        buildDiscussionBlock("summary"),
        buildDiscussionBlock("background"),
        // deepDive is missing
      ],
    };
    const script = {
      ...buildValidScript(),
      sections: [
        buildIntroSection(),
        incompleteDiscussion,
        buildDiscussionSection("news-2"),
        buildDiscussionSection("news-3"),
        buildOutroSection(),
      ],
    };

    // Act
    const result = ScriptSchema.safeParse(script);

    // Assert
    expect(result.success).toBe(false);
  });

  it("should fail when title is missing", () => {
    // Arrange
    const { title: _omitted, ...withoutTitle } = buildValidScript();

    // Act
    const result = ScriptSchema.safeParse(withoutTitle);

    // Assert
    expect(result.success).toBe(false);
  });
});

// Helpers

const buildLine = (speaker: "A" | "B", text: string) => ({ speaker, text });

const buildNewsItem = (id: string) => ({
  id,
  title: `${id}のニュース見出し`,
});

const buildDiscussionBlock = (phase: "summary" | "background" | "deepDive") => ({
  phase,
  lines: [
    buildLine("A", "解説します"),
    buildLine("B", "質問があります"),
  ],
});

const buildDiscussionSection = (newsId: string) => ({
  type: "discussion" as const,
  newsId,
  blocks: [
    buildDiscussionBlock("summary"),
    buildDiscussionBlock("background"),
    buildDiscussionBlock("deepDive"),
  ],
});

const buildIntroSection = () => ({
  type: "intro" as const,
  greeting: [
    buildLine("A", "こんにちは、ニュースラジオへようこそ"),
    buildLine("B", "本日もよろしくお願いします"),
  ],
  newsOverview: [
    buildLine("A", "今日は3つのニュースをお届けします"),
    buildLine("B", "最初は日銀の政策についてです"),
  ],
});

const buildOutroSection = () => ({
  type: "outro" as const,
  recap: [
    buildLine("A", "本日は3つのニュースをお伝えしました"),
    buildLine("B", "どれも重要なテーマでしたね"),
  ],
  closing: [
    buildLine("A", "ご清聴ありがとうございました"),
    buildLine("B", "またお会いしましょう"),
  ],
});

const buildValidScript = () => ({
  title: "今日の政治経済ニュースラジオ 2025年3月21日号",
  newsItems: [
    buildNewsItem("news-1"),
    buildNewsItem("news-2"),
    buildNewsItem("news-3"),
  ],
  sections: [
    buildIntroSection(),
    buildDiscussionSection("news-1"),
    buildDiscussionSection("news-2"),
    buildDiscussionSection("news-3"),
    buildOutroSection(),
  ],
});
