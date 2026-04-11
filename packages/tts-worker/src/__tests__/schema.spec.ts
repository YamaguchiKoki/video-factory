// Tests for the schema re-exports (schema.ts).
//
// Design contract: validates Script and EnrichedScript shapes via the
// shared zod schemas.

import { describe, expect, it } from "vitest";
import {
  EnrichedLineSchema,
  EnrichedScriptSchema,
  NewsItemSchema,
  ScriptSchema,
} from "../schema.js";

// ============================================
// Script
// ============================================

describe("Script", () => {
  it("should parse a valid complete script", () => {
    const result = ScriptSchema.safeParse(buildValidScript());
    expect(result.success).toBe(true);
  });

  it("should fail when newsItems count is not 3", () => {
    const script = {
      ...buildValidScript(),
      newsItems: [buildNewsItem("news-1"), buildNewsItem("news-2")],
    };
    const result = ScriptSchema.safeParse(script);
    expect(result.success).toBe(false);
  });

  it("should fail when sections tuple has wrong structure", () => {
    const script = {
      ...buildValidScript(),
      sections: [buildIntroSection()],
    };
    const result = ScriptSchema.safeParse(script);
    expect(result.success).toBe(false);
  });

  it("should fail when speaker value is not A or B", () => {
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
    const result = ScriptSchema.safeParse(script);
    expect(result.success).toBe(false);
  });

  it("should fail when title is missing", () => {
    const { title: _omitted, ...withoutTitle } = buildValidScript();
    const result = ScriptSchema.safeParse(withoutTitle);
    expect(result.success).toBe(false);
  });

  it("should fail when a discussion block is missing a phase", () => {
    const incompleteDiscussion = {
      type: "discussion" as const,
      newsId: "news-1",
      blocks: [
        buildDiscussionBlock("summary"),
        buildDiscussionBlock("background"),
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
    const result = ScriptSchema.safeParse(script);
    expect(result.success).toBe(false);
  });
});

// ============================================
// NewsItem
// ============================================

describe("NewsItem", () => {
  it("should parse a newsItem with optional sourceUrl", () => {
    const newsItem = {
      id: "news-1",
      title: "テストニュース",
      sourceUrl: "https://example.com/news",
    };
    const result = NewsItemSchema.safeParse(newsItem);
    expect(result.success).toBe(true);
  });

  it("should parse a newsItem without sourceUrl (field is optional)", () => {
    const newsItem = { id: "news-1", title: "テストニュース" };
    const result = NewsItemSchema.safeParse(newsItem);
    expect(result.success).toBe(true);
  });

  it("should fail when sourceUrl is not a valid URL", () => {
    const newsItem = { id: "news-1", title: "テスト", sourceUrl: "not-a-url" };
    const result = NewsItemSchema.safeParse(newsItem);
    expect(result.success).toBe(false);
  });

  it("should fail when id is missing", () => {
    const newsItem = { title: "テストニュース" };
    const result = NewsItemSchema.safeParse(newsItem);
    expect(result.success).toBe(false);
  });
});

// ============================================
// EnrichedLine
// ============================================

describe("EnrichedLine", () => {
  it("should parse a valid EnrichedLine", () => {
    const line = {
      speaker: "A",
      text: "こんにちは",
      voicevoxSpeakerId: 0,
      offsetSec: 0.0,
      durationSec: 2.5,
    };
    const result = EnrichedLineSchema.safeParse(line);
    expect(result.success).toBe(true);
  });

  it("should fail when voicevoxSpeakerId is missing", () => {
    const line = {
      speaker: "A",
      text: "こんにちは",
      offsetSec: 0.0,
      durationSec: 1.5,
    };
    const result = EnrichedLineSchema.safeParse(line);
    expect(result.success).toBe(false);
  });

  it("should fail when offsetSec is missing", () => {
    const line = {
      speaker: "A",
      text: "こんにちは",
      voicevoxSpeakerId: 0,
      durationSec: 1.5,
    };
    const result = EnrichedLineSchema.safeParse(line);
    expect(result.success).toBe(false);
  });

  it("should fail when durationSec is missing", () => {
    const line = {
      speaker: "A",
      text: "こんにちは",
      voicevoxSpeakerId: 0,
      offsetSec: 0.0,
    };
    const result = EnrichedLineSchema.safeParse(line);
    expect(result.success).toBe(false);
  });

  it("should fail when speaker is missing", () => {
    const line = {
      text: "こんにちは",
      voicevoxSpeakerId: 0,
      offsetSec: 0.0,
      durationSec: 1.5,
    };
    const result = EnrichedLineSchema.safeParse(line);
    expect(result.success).toBe(false);
  });

  it("should fail when voicevoxSpeakerId is not a number", () => {
    const line = {
      speaker: "A",
      text: "こんにちは",
      voicevoxSpeakerId: "zero",
      offsetSec: 0.0,
      durationSec: 1.5,
    };
    const result = EnrichedLineSchema.safeParse(line);
    expect(result.success).toBe(false);
  });
});

// ============================================
// EnrichedScript
// ============================================

describe("EnrichedScript", () => {
  it("should parse a valid EnrichedScript with outputWavS3Key", () => {
    const result = EnrichedScriptSchema.safeParse(buildValidEnrichedScript());
    expect(result.success).toBe(true);
  });

  it("should fail when outputWavS3Key is missing", () => {
    const { outputWavS3Key: _omitted, ...withoutKey } =
      buildValidEnrichedScript();
    const result = EnrichedScriptSchema.safeParse(withoutKey);
    expect(result.success).toBe(false);
  });

  it("should fail when totalDurationSec is missing", () => {
    const { totalDurationSec: _omitted, ...withoutDuration } =
      buildValidEnrichedScript();
    const result = EnrichedScriptSchema.safeParse(withoutDuration);
    expect(result.success).toBe(false);
  });

  it("should parse EnrichedIntroSection without startSec or endSec", () => {
    const enrichedScript = {
      ...buildValidEnrichedScript(),
      sections: [
        {
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
    const result = EnrichedScriptSchema.safeParse(enrichedScript);
    expect(result.success).toBe(true);
  });

  it("should fail when a section type is unknown", () => {
    const enrichedScript = {
      ...buildValidEnrichedScript(),
      sections: [{ type: "unknown" }],
    };
    const result = EnrichedScriptSchema.safeParse(enrichedScript);
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

const buildNewsItem = (id: "news-1" | "news-2" | "news-3") => ({
  id,
  title: `${id}のニュース見出し`,
});

const buildDiscussionBlock = (
  phase: "summary" | "background" | "deepDive",
) => ({
  phase,
  lines: [buildLine("A", "解説します"), buildLine("B", "質問があります")],
});

const buildDiscussionSection = (newsId: "news-1" | "news-2" | "news-3") => ({
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
  greeting: [buildLine("A", "こんにちは"), buildLine("B", "よろしく")],
  newsOverview: [buildLine("A", "今日のニュース")],
});

const buildOutroSection = () => ({
  type: "outro" as const,
  recap: [buildLine("A", "まとめ")],
  closing: [buildLine("A", "ありがとう"), buildLine("B", "またね")],
});

const buildValidScript = () => ({
  title: "今日のラジオ 2026年3月21日号",
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
  newsId: "news-1" | "news-2" | "news-3",
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
  title: "今日のラジオ 2026年3月21日号",
  totalDurationSec: 45.0,
  outputWavS3Key: "audio/2026-03-21/ラジオ.wav",
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
        buildEnrichedLine("B", "よろしく", 1.5),
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
        buildEnrichedLine("A", "ありがとう", 33.0),
        buildEnrichedLine("B", "またね", 34.5),
      ],
    },
  ],
});
