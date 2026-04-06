import { Result, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { Script } from "../schema.js";

/**
 * Conformance test: ensures tts-worker's Script schema stays compatible
 * with the JSON contract produced by script-generator.
 *
 * If this test fails, the schemas have drifted apart.
 * Fix by syncing tts-worker/schema.ts with script-generator/schema.ts.
 */

const validScriptFixture = {
  title: "テストラジオ 2026年3月24日号",
  newsItems: [
    { id: "news-1", title: "ニュース1" },
    { id: "news-2", title: "ニュース2" },
    { id: "news-3", title: "ニュース3" },
  ],
  sections: [
    {
      type: "intro",
      greeting: [{ speaker: "A", text: "こんにちは" }],
      newsOverview: [{ speaker: "B", text: "今日のニュース" }],
    },
    {
      type: "discussion",
      newsId: "news-1",
      blocks: [
        { phase: "summary", lines: [{ speaker: "A", text: "概要1" }] },
        { phase: "background", lines: [{ speaker: "B", text: "背景1" }] },
        { phase: "deepDive", lines: [{ speaker: "A", text: "深掘り1" }] },
      ],
    },
    {
      type: "discussion",
      newsId: "news-2",
      blocks: [
        { phase: "summary", lines: [{ speaker: "A", text: "概要2" }] },
        { phase: "background", lines: [{ speaker: "B", text: "背景2" }] },
        { phase: "deepDive", lines: [{ speaker: "A", text: "深掘り2" }] },
      ],
    },
    {
      type: "discussion",
      newsId: "news-3",
      blocks: [
        { phase: "summary", lines: [{ speaker: "A", text: "概要3" }] },
        { phase: "background", lines: [{ speaker: "B", text: "背景3" }] },
        { phase: "deepDive", lines: [{ speaker: "A", text: "深掘り3" }] },
      ],
    },
    {
      type: "outro",
      recap: [{ speaker: "A", text: "まとめ" }],
      closing: [{ speaker: "B", text: "さようなら" }],
    },
  ],
};

const decode = Schema.decodeUnknownResult(Script);

describe("Schema conformance with script-generator", () => {
  it("parses a valid Script JSON produced by script-generator", () => {
    const result = decode(validScriptFixture);
    expect(Result.isSuccess(result)).toBe(true);
  });

  it("preserves all required top-level fields", () => {
    const result = decode(validScriptFixture);
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(result.success).toHaveProperty("title");
      expect(result.success).toHaveProperty("newsItems");
      expect(result.success).toHaveProperty("sections");
      expect(result.success.newsItems).toHaveLength(3);
      expect(result.success.sections).toHaveLength(5);
    }
  });

  it("rejects when a required field is missing", () => {
    const { title: _, ...withoutTitle } = validScriptFixture;
    const result = decode(withoutTitle);
    expect(Result.isFailure(result)).toBe(true);
  });

  it("validates section discriminated union (intro/discussion/outro)", () => {
    const corrupted = {
      ...validScriptFixture,
      sections: [
        { type: "unknown_section" },
        ...validScriptFixture.sections.slice(1),
      ],
    };
    const result = decode(corrupted);
    expect(Result.isFailure(result)).toBe(true);
  });
});
