// Tests for schema.ts
//
// Design contract:
//   ScriptSchema: validates script-generator's JSON output (independently defined)
//     — parses valid Script with all required fields
//     — rejects empty object
//     — rejects Script with wrong number of newsItems
//     — rejects Script with wrong number of sections
//
//   ThumbnailResultSchema: validates thumbnail generation output
//     — parses valid result with imageBase64 and contentType
//     — rejects missing imageBase64
//     — rejects missing contentType
//
//   DescriptionResultSchema: validates YouTube description output
//     — parses valid result with text field
//     — rejects missing text
//
//   CommentResultSchema: validates YouTube comment output
//     — parses valid result with text field
//     — rejects missing text
//
//   MetadataOutputSchema: validates combined metadata output
//     — parses valid combined result
//     — rejects missing thumbnail
//     — rejects missing description
//     — rejects missing comment
//
//   HandlerInputSchema: validates Lambda handler event input
//     — parses valid input with scriptKey
//     — rejects missing scriptKey

import { describe, expect, it } from "vitest";
import {
  CommentResultSchema,
  DescriptionResultSchema,
  HandlerInputSchema,
  MetadataOutputSchema,
  ScriptSchema,
  ThumbnailResultSchema,
} from "./schema";

// ============================================
// Test data builders
// ============================================

const buildLine = (speaker: "A" | "B", text: string) => ({ speaker, text });

const buildDiscussionSection = (newsId: string) => ({
  type: "discussion" as const,
  newsId,
  blocks: [
    { phase: "summary" as const, lines: [buildLine("A", "概要")] },
    { phase: "background" as const, lines: [buildLine("B", "背景")] },
    { phase: "deepDive" as const, lines: [buildLine("A", "深掘り")] },
  ],
});

const buildValidScript = () => ({
  title: "テストラジオ 2026年4月11日号",
  newsItems: [
    { id: "news-1", title: "ニュース1" },
    { id: "news-2", title: "ニュース2" },
    { id: "news-3", title: "ニュース3" },
  ],
  sections: [
    {
      type: "intro" as const,
      greeting: [buildLine("A", "こんにちは")],
      newsOverview: [buildLine("B", "今日のニュース")],
    },
    buildDiscussionSection("news-1"),
    buildDiscussionSection("news-2"),
    buildDiscussionSection("news-3"),
    {
      type: "outro" as const,
      recap: [buildLine("A", "まとめ")],
      closing: [buildLine("B", "さようなら")],
    },
  ],
});

const buildValidThumbnailResult = () => ({
  imageBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk",
  contentType: "image/png" as const,
});

const buildValidDescriptionResult = () => ({
  text: "今日のニュースラジオでは3つのトピックを取り上げます。",
});

const buildValidCommentResult = () => ({
  text: "コメント欄をご覧いただきありがとうございます。",
});

// ============================================
// ScriptSchema
// ============================================

describe("ScriptSchema", () => {
  it("should parse valid Script with all required fields", () => {
    const result = ScriptSchema.safeParse(buildValidScript());
    expect(result.success).toBe(true);
  });

  it("should reject empty object", () => {
    const result = ScriptSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("should reject Script with wrong number of newsItems", () => {
    const script = {
      ...buildValidScript(),
      newsItems: [{ id: "news-1", title: "ニュース1" }],
    };
    const result = ScriptSchema.safeParse(script);
    expect(result.success).toBe(false);
  });

  it("should reject Script with missing title", () => {
    const { title: _, ...scriptWithoutTitle } = buildValidScript();
    const result = ScriptSchema.safeParse(scriptWithoutTitle);
    expect(result.success).toBe(false);
  });

  it("should parse Script with optional sourceUrl in newsItems", () => {
    const script = {
      ...buildValidScript(),
      newsItems: [
        {
          id: "news-1",
          title: "ニュース1",
          sourceUrl: "https://example.com/news-1",
        },
        { id: "news-2", title: "ニュース2" },
        { id: "news-3", title: "ニュース3" },
      ],
    };
    const result = ScriptSchema.safeParse(script);
    expect(result.success).toBe(true);
  });

  it("should reject newsItem with invalid sourceUrl", () => {
    const script = {
      ...buildValidScript(),
      newsItems: [
        { id: "news-1", title: "ニュース1", sourceUrl: "not-a-url" },
        { id: "news-2", title: "ニュース2" },
        { id: "news-3", title: "ニュース3" },
      ],
    };
    const result = ScriptSchema.safeParse(script);
    expect(result.success).toBe(false);
  });
});

// ============================================
// ThumbnailResultSchema
// ============================================

describe("ThumbnailResultSchema", () => {
  it("should parse valid result with imageBase64 and contentType", () => {
    const result = ThumbnailResultSchema.safeParse(buildValidThumbnailResult());
    expect(result.success).toBe(true);
  });

  it("should reject missing imageBase64", () => {
    const result = ThumbnailResultSchema.safeParse({
      contentType: "image/png",
    });
    expect(result.success).toBe(false);
  });

  it("should reject missing contentType", () => {
    const result = ThumbnailResultSchema.safeParse({
      imageBase64: "abc123",
    });
    expect(result.success).toBe(false);
  });
});

// ============================================
// DescriptionResultSchema
// ============================================

describe("DescriptionResultSchema", () => {
  it("should parse valid result with text field", () => {
    const result = DescriptionResultSchema.safeParse(
      buildValidDescriptionResult(),
    );
    expect(result.success).toBe(true);
  });

  it("should reject missing text", () => {
    const result = DescriptionResultSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ============================================
// CommentResultSchema
// ============================================

describe("CommentResultSchema", () => {
  it("should parse valid result with text field", () => {
    const result = CommentResultSchema.safeParse(buildValidCommentResult());
    expect(result.success).toBe(true);
  });

  it("should reject missing text", () => {
    const result = CommentResultSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ============================================
// MetadataOutputSchema
// ============================================

describe("MetadataOutputSchema", () => {
  it("should parse valid combined result", () => {
    const result = MetadataOutputSchema.safeParse({
      thumbnail: buildValidThumbnailResult(),
      description: buildValidDescriptionResult(),
      comment: buildValidCommentResult(),
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing thumbnail", () => {
    const result = MetadataOutputSchema.safeParse({
      description: buildValidDescriptionResult(),
      comment: buildValidCommentResult(),
    });
    expect(result.success).toBe(false);
  });

  it("should reject missing description", () => {
    const result = MetadataOutputSchema.safeParse({
      thumbnail: buildValidThumbnailResult(),
      comment: buildValidCommentResult(),
    });
    expect(result.success).toBe(false);
  });

  it("should reject missing comment", () => {
    const result = MetadataOutputSchema.safeParse({
      thumbnail: buildValidThumbnailResult(),
      description: buildValidDescriptionResult(),
    });
    expect(result.success).toBe(false);
  });
});

// ============================================
// HandlerInputSchema
// ============================================

describe("HandlerInputSchema", () => {
  it("should parse valid input with scriptKey", () => {
    const result = HandlerInputSchema.safeParse({
      scriptKey: "script-generator/script.json",
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing scriptKey", () => {
    const result = HandlerInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("should reject empty scriptKey", () => {
    const result = HandlerInputSchema.safeParse({ scriptKey: "" });
    expect(result.success).toBe(false);
  });
});
