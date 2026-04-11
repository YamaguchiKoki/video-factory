import { describe, expect, it } from "vitest";
import { ScriptSchema } from "../schema.js";

/**
 * Conformance test: ensures the shared Script contract still parses the JSON
 * shape produced by script-generator. If this test fails, the producer and
 * the shared schema have drifted apart.
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

describe("Schema conformance with script-generator", () => {
  it("parses a valid Script JSON produced by script-generator", () => {
    const result = ScriptSchema.safeParse(validScriptFixture);
    expect(result.success).toBe(true);
  });

  it("preserves all required top-level fields", () => {
    const result = ScriptSchema.safeParse(validScriptFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveProperty("title");
      expect(result.data).toHaveProperty("newsItems");
      expect(result.data).toHaveProperty("sections");
      expect(result.data.newsItems).toHaveLength(3);
      expect(result.data.sections).toHaveLength(5);
    }
  });

  it("rejects when a required field is missing", () => {
    const { title: _, ...withoutTitle } = validScriptFixture;
    const result = ScriptSchema.safeParse(withoutTitle);
    expect(result.success).toBe(false);
  });

  it("validates section discriminated union (intro/discussion/outro)", () => {
    const corrupted = {
      ...validScriptFixture,
      sections: [
        { type: "unknown_section" },
        ...validScriptFixture.sections.slice(1),
      ],
    };
    const result = ScriptSchema.safeParse(corrupted);
    expect(result.success).toBe(false);
  });
});
