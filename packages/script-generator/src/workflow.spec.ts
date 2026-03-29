/**
 * Integration tests for generateScriptWorkflow.
 *
 * These tests verify:
 * 1. The workflow's own properties (id, inputSchema, outputSchema).
 * 2. Schema compatibility at each step boundary — ensuring the output type
 *    of step N is accepted by the input schema of step N+1.
 *
 * No Mastra runtime is invoked; these are purely structural / schema-level checks.
 */

import { it } from "@fast-check/vitest";
import { describe, expect } from "vitest";
import { ScriptSchema } from "./schema";
import { VerifiedTopicsOutputSchema } from "./steps/fact-check/schema";
import {
  EnrichedTopicSchema,
  EnrichedTopicsOutputSchema,
} from "./steps/topic-deep-dive/schema";
import {
  TopicSchema,
  TopicsOutputSchema,
} from "./steps/topic-selection/schema";
import { generateScriptWorkflow } from "./workflow";

describe("generateScriptWorkflow", () => {
  it("should have the correct workflow id", () => {
    // Assert
    expect(generateScriptWorkflow.id).toBe("generate-script");
  });

  it("should accept a valid genre as workflow input", () => {
    // Arrange
    const input = { genre: "政治経済" };

    // Act
    const result = generateScriptWorkflow.inputSchema.safeParse(input);

    // Assert
    expect(result.success).toBe(true);
  });

  it("should reject workflow input missing genre", () => {
    // Arrange
    const input = {};

    // Act
    const result = generateScriptWorkflow.inputSchema.safeParse(input);

    // Assert
    expect(result.success).toBe(false);
  });

  it("should reject an empty object as workflow output (Script shape is required)", () => {
    // Act
    const result = generateScriptWorkflow.outputSchema.safeParse({});

    // Assert
    expect(result.success).toBe(false);
  });

  it("should accept a valid Script as workflow output", () => {
    // Arrange
    const script = buildValidScript();

    // Act
    const result = generateScriptWorkflow.outputSchema.safeParse(script);

    // Assert
    expect(result.success).toBe(true);
  });
});

describe("step boundary schema compatibility", () => {
  // Step 1 output → Step 2 (forEach) input
  it("each element of TopicsOutputSchema should be parsed by TopicSchema (step-1 → step-2 boundary)", () => {
    // Arrange
    const topics = [
      buildTopic("news-1"),
      buildTopic("news-2"),
      buildTopic("news-3"),
    ];

    // Act — TopicsOutputSchema is an array; each element must satisfy TopicSchema
    const topicsResult = TopicsOutputSchema.safeParse(topics);
    const singleResult = TopicSchema.safeParse(topics[0]);

    // Assert
    expect(topicsResult.success).toBe(true);
    expect(singleResult.success).toBe(true);
  });

  // Step 2 output → Step 3 input
  it("EnrichedTopicSchema elements should be parseable by EnrichedTopicsOutputSchema (step-2 → step-3 boundary)", () => {
    // Arrange
    const enriched = buildEnrichedTopic("news-1");

    // Act — step-3 receives the array collected from foreach
    const singleResult = EnrichedTopicSchema.safeParse(enriched);
    const arrayResult = EnrichedTopicsOutputSchema.safeParse([enriched]);

    // Assert
    expect(singleResult.success).toBe(true);
    expect(arrayResult.success).toBe(true);
  });

  // Step 3 output → Step 4 input
  it("VerifiedTopicsOutputSchema should accept verified topics as step-4 input (step-3 → step-4 boundary)", () => {
    // Arrange
    const verified = [
      buildVerifiedTopic("news-1"),
      buildVerifiedTopic("news-2"),
      buildVerifiedTopic("news-3"),
    ];

    // Act
    const result = VerifiedTopicsOutputSchema.safeParse(verified);

    // Assert
    expect(result.success).toBe(true);
  });

  // Step 4 output → Workflow output
  it("ScriptSchema should match the workflow outputSchema (step-4 → workflow output boundary)", () => {
    // Arrange
    const script = buildValidScript();

    // Act
    const stepOutputResult = ScriptSchema.safeParse(script);
    const workflowOutputResult =
      generateScriptWorkflow.outputSchema.safeParse(script);

    // Assert — both schemas must agree on the same value
    expect(stepOutputResult.success).toBe(workflowOutputResult.success);
  });
});

// Helpers

const buildTopic = (id: string) => ({
  id,
  title: `${id}: 日銀政策`,
  summary: `${id}の要約`,
});

const buildEnrichedTopic = (id: string) => ({
  id,
  title: `${id}: 日銀政策`,
  summary: `${id}の要約`,
  xOpinions: ["意見1"],
  detailedContext: "詳細な背景",
  sourceUrls: ["https://www.boj.or.jp/en/"],
});

const buildVerifiedTopic = (id: string) => ({
  id,
  title: `${id}: 日銀政策`,
  verifiedFacts: ["確認事実"],
  reliabilityScore: 0.9,
  contradictions: [],
  sourceUrls: ["https://www.boj.or.jp/en/"],
});

const buildLine = (speaker: "A" | "B", text: string) => ({ speaker, text });

const buildDiscussionSection = (newsId: string) => ({
  type: "discussion" as const,
  newsId,
  blocks: [
    {
      phase: "summary" as const,
      lines: [buildLine("A", "解説"), buildLine("B", "質問")],
    },
    {
      phase: "background" as const,
      lines: [buildLine("A", "背景"), buildLine("B", "確認")],
    },
    {
      phase: "deepDive" as const,
      lines: [buildLine("A", "深掘り"), buildLine("B", "感想")],
    },
  ],
});

const buildValidScript = () => ({
  title: "今日の政治経済ニュースラジオ",
  newsItems: [
    { id: "news-1", title: "日銀追加利上げ" },
    { id: "news-2", title: "円相場急伸" },
    { id: "news-3", title: "補正予算審議" },
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
