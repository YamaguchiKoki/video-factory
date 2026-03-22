// Tests for the NEW schema (after schema.ts is rewritten in the implement phase).
// These tests define the expected shape of each schema and will fail until
// schema.ts is updated with the correct fields.

import { describe, expect, it } from "vitest";
import {
  EnrichedLineSchema,
  EnrichedScriptSchema,
  NewsItemSchema,
  ScriptSchema,
} from "../schema";

// ============================================
// ScriptSchema (Layer 1 — mirrors script-generator source of truth)
// ============================================

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
    // Arrange — only intro, missing discussion and outro
    const script = {
      ...buildValidScript(),
      sections: [buildIntroSection()],
    };

    // Act
    const result = ScriptSchema.safeParse(script);

    // Assert
    expect(result.success).toBe(false);
  });

  it("should fail when speaker value is not A or B", () => {
    // Arrange
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

  it("should fail when title is missing", () => {
    // Arrange
    const { title: _omitted, ...withoutTitle } = buildValidScript();

    // Act
    const result = ScriptSchema.safeParse(withoutTitle);

    // Assert
    expect(result.success).toBe(false);
  });

  it("should fail when a discussion block is missing a phase", () => {
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
});

// ============================================
// NewsItemSchema — sourceUrl is optional (matches script-generator source of truth)
// ============================================

describe("NewsItemSchema", () => {
  it("should parse a newsItem with optional sourceUrl", () => {
    // Arrange
    const newsItem = {
      id: "news-1",
      title: "テストニュース",
      sourceUrl: "https://example.com/news",
    };

    // Act
    const result = NewsItemSchema.safeParse(newsItem);

    // Assert
    expect(result.success).toBe(true);
  });

  it("should parse a newsItem without sourceUrl (field is optional)", () => {
    // Arrange
    const newsItem = { id: "news-1", title: "テストニュース" };

    // Act
    const result = NewsItemSchema.safeParse(newsItem);

    // Assert
    expect(result.success).toBe(true);
  });

  it("should fail when sourceUrl is not a valid URL", () => {
    // Arrange
    const newsItem = { id: "news-1", title: "テスト", sourceUrl: "not-a-url" };

    // Act
    const result = NewsItemSchema.safeParse(newsItem);

    // Assert
    expect(result.success).toBe(false);
  });

  it("should fail when id is missing", () => {
    // Arrange
    const newsItem = { title: "テストニュース" };

    // Act
    const result = NewsItemSchema.safeParse(newsItem);

    // Assert
    expect(result.success).toBe(false);
  });
});

// ============================================
// EnrichedLineSchema — Layer 2 fields: voicevoxSpeakerId, offsetSec, durationSec
// ============================================

describe("EnrichedLineSchema", () => {
  it("should parse a valid EnrichedLine with voicevoxSpeakerId and offsetSec", () => {
    // Arrange — new fields: voicevoxSpeakerId (was audioPath), offsetSec (was startSec)
    const line = {
      speaker: "A",
      text: "こんにちは、ニュースラジオへようこそ",
      voicevoxSpeakerId: 0,
      offsetSec: 0.0,
      durationSec: 2.5,
    };

    // Act
    const result = EnrichedLineSchema.safeParse(line);

    // Assert
    expect(result.success).toBe(true);
  });

  it("should fail when voicevoxSpeakerId is missing", () => {
    // Arrange — voicevoxSpeakerId is required in the new schema
    const line = {
      speaker: "A",
      text: "こんにちは",
      offsetSec: 0.0,
      durationSec: 1.5,
    };

    // Act
    const result = EnrichedLineSchema.safeParse(line);

    // Assert
    expect(result.success).toBe(false);
  });

  it("should fail when offsetSec is missing", () => {
    // Arrange — offsetSec is required (replaces startSec)
    const line = {
      speaker: "A",
      text: "こんにちは",
      voicevoxSpeakerId: 0,
      durationSec: 1.5,
    };

    // Act
    const result = EnrichedLineSchema.safeParse(line);

    // Assert
    expect(result.success).toBe(false);
  });

  it("should fail when durationSec is missing", () => {
    // Arrange
    const line = {
      speaker: "A",
      text: "こんにちは",
      voicevoxSpeakerId: 0,
      offsetSec: 0.0,
    };

    // Act
    const result = EnrichedLineSchema.safeParse(line);

    // Assert
    expect(result.success).toBe(false);
  });

  it("should fail when speaker is missing", () => {
    // Arrange
    const line = {
      text: "こんにちは",
      voicevoxSpeakerId: 0,
      offsetSec: 0.0,
      durationSec: 1.5,
    };

    // Act
    const result = EnrichedLineSchema.safeParse(line);

    // Assert
    expect(result.success).toBe(false);
  });

  it("should fail when voicevoxSpeakerId is not a number", () => {
    // Arrange
    const line = {
      speaker: "A",
      text: "こんにちは",
      voicevoxSpeakerId: "zero", // should be a number
      offsetSec: 0.0,
      durationSec: 1.5,
    };

    // Act
    const result = EnrichedLineSchema.safeParse(line);

    // Assert
    expect(result.success).toBe(false);
  });
});

// ============================================
// EnrichedScriptSchema — adds totalDurationSec and outputWavS3Key
// ============================================

describe("EnrichedScriptSchema", () => {
  it("should parse a valid EnrichedScript with outputWavS3Key", () => {
    // Arrange — outputWavS3Key is a new field in the updated schema
    const enrichedScript = buildValidEnrichedScript();

    // Act
    const result = EnrichedScriptSchema.safeParse(enrichedScript);

    // Assert
    expect(result.success).toBe(true);
  });

  it("should fail when outputWavS3Key is missing", () => {
    // Arrange
    const { outputWavS3Key: _omitted, ...withoutKey } =
      buildValidEnrichedScript();

    // Act
    const result = EnrichedScriptSchema.safeParse(withoutKey);

    // Assert
    expect(result.success).toBe(false);
  });

  it("should fail when totalDurationSec is missing", () => {
    // Arrange
    const { totalDurationSec: _omitted, ...withoutDuration } =
      buildValidEnrichedScript();

    // Act
    const result = EnrichedScriptSchema.safeParse(withoutDuration);

    // Assert
    expect(result.success).toBe(false);
  });

  it("should parse EnrichedIntroSection without startSec or endSec", () => {
    // Arrange — section-level startSec/endSec are removed in the new schema
    const enrichedScript = {
      ...buildValidEnrichedScript(),
      sections: [
        {
          // No startSec or endSec — these should not be required
          type: "intro" as const,
          greeting: [buildEnrichedLine("A", "こんにちは", 0)],
          newsOverview: [buildEnrichedLine("A", "今日のニュース", 1.5)],
        },
        buildEnrichedDiscussionSection("news-1", 3.0),
        buildEnrichedDiscussionSection("news-2", 12.0),
        buildEnrichedDiscussionSection("news-3", 21.0),
        {
          type: "outro" as const,
          recap: [buildEnrichedLine("A", "まとめ", 30.0)],
          closing: [buildEnrichedLine("B", "さようなら", 31.5)],
        },
      ],
    };

    // Act
    const result = EnrichedScriptSchema.safeParse(enrichedScript);

    // Assert
    expect(result.success).toBe(true);
  });

  it("should fail when sections tuple has wrong length", () => {
    // Arrange
    const enrichedScript = {
      ...buildValidEnrichedScript(),
      sections: [
        {
          type: "intro" as const,
          greeting: [],
          newsOverview: [],
        },
      ],
    };

    // Act
    const result = EnrichedScriptSchema.safeParse(enrichedScript);

    // Assert
    expect(result.success).toBe(false);
  });
});

// ============================================
// Helpers
// ============================================

const buildLine = (speaker: "A" | "B", text: string) => ({ speaker, text });

const buildEnrichedLine = (
  speaker: "A" | "B",
  text: string,
  offsetSec: number,
) => ({
  speaker,
  text,
  voicevoxSpeakerId: speaker === "A" ? 0 : 1,
  offsetSec,
  durationSec: 1.5,
});

const buildNewsItem = (id: string) => ({
  id,
  title: `${id}のニュース見出し`,
});

const buildDiscussionBlock = (
  phase: "summary" | "background" | "deepDive",
) => ({
  phase,
  lines: [buildLine("A", "解説します"), buildLine("B", "質問があります")],
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
  greeting: [buildLine("A", "こんにちは"), buildLine("B", "よろしくお願いします")],
  newsOverview: [buildLine("A", "今日は3つのニュースをお届けします")],
});

const buildOutroSection = () => ({
  type: "outro" as const,
  recap: [buildLine("A", "本日のまとめです")],
  closing: [buildLine("A", "ありがとうございました"), buildLine("B", "またお会いしましょう")],
});

const buildValidScript = () => ({
  title: "今日の政治経済ニュースラジオ 2026年3月21日号",
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

const buildEnrichedDiscussionBlock = (
  phase: "summary" | "background" | "deepDive",
  startOffset: number,
) => ({
  phase,
  lines: [
    buildEnrichedLine("A", "解説します", startOffset),
    buildEnrichedLine("B", "質問があります", startOffset + 1.5),
  ],
});

const buildEnrichedDiscussionSection = (
  newsId: string,
  startOffset: number,
) => ({
  type: "discussion" as const,
  newsId,
  blocks: [
    buildEnrichedDiscussionBlock("summary", startOffset),
    buildEnrichedDiscussionBlock("background", startOffset + 3.0),
    buildEnrichedDiscussionBlock("deepDive", startOffset + 6.0),
  ],
});

const buildValidEnrichedScript = () => ({
  title: "今日の政治経済ニュースラジオ 2026年3月21日号",
  totalDurationSec: 45.0,
  outputWavS3Key: "audio/2026-03-21/今日の政治経済ニュースラジオ.wav",
  newsItems: [
    buildNewsItem("news-1"),
    buildNewsItem("news-2"),
    buildNewsItem("news-3"),
  ],
  sections: [
    {
      type: "intro" as const,
      greeting: [
        buildEnrichedLine("A", "こんにちは", 0.0),
        buildEnrichedLine("B", "よろしくお願いします", 1.5),
      ],
      newsOverview: [buildEnrichedLine("A", "今日のニュース", 3.0)],
    },
    buildEnrichedDiscussionSection("news-1", 4.5),
    buildEnrichedDiscussionSection("news-2", 13.5),
    buildEnrichedDiscussionSection("news-3", 22.5),
    {
      type: "outro" as const,
      recap: [buildEnrichedLine("A", "まとめ", 31.5)],
      closing: [
        buildEnrichedLine("A", "ありがとうございました", 33.0),
        buildEnrichedLine("B", "またお会いしましょう", 34.5),
      ],
    },
  ],
});
