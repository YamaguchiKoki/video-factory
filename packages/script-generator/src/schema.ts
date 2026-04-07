import { z } from "zod";

// ============================================
// Speaker
// ============================================
const SpeakerSchema = z.enum(["A", "B"]);

// ============================================
// Layer 1: LLM出力（スクリプト）
// ============================================

/** LLMが生成する1発話 */
const LineSchema = z.object({
  speaker: SpeakerSchema,
  text: z.string(),
});

/** ニュースアイテム（導入〜掘り下げを横断するエンティティ） */
const NewsItemSchema = z.object({
  id: z.enum(["news-1", "news-2", "news-3"]),
  title: z.string().describe("ニュースの見出し"),
  sourceUrl: z.string().url().optional(),
});

/** 導入: 挨拶 → ニュース一覧紹介 */
const IntroSectionSchema = z.object({
  type: z.literal("intro"),
  greeting: z.array(LineSchema),
  newsOverview: z.array(LineSchema).describe("今日の3つのニュースを軽く紹介"),
});

/** 対話フロー: 1ニュースにつき1つ */
const DiscussionPhaseSchema = z.enum([
  "summary", // 概要説明
  "background", // 前提確認
  "deepDive", // 掘り下げ
]);

const DiscussionBlockSchema = z.object({
  phase: DiscussionPhaseSchema,
  lines: z.array(LineSchema),
});

const DiscussionSectionSchema = z.object({
  type: z.literal("discussion"),
  newsId: z.enum(["news-1", "news-2", "news-3"]).describe("対象ニュースのID"),
  blocks: z.tuple([
    DiscussionBlockSchema, // summary
    DiscussionBlockSchema, // background
    DiscussionBlockSchema, // deepDive
  ]),
});

/** まとめ */
const OutroSectionSchema = z.object({
  type: z.literal("outro"),
  recap: z.array(LineSchema),
  closing: z.array(LineSchema),
});

/** スクリプト全体 */
export const ScriptSchema = z.object({
  title: z.string(),
  newsItems: z.array(NewsItemSchema).length(3),
  sections: z.tuple([
    IntroSectionSchema,
    DiscussionSectionSchema, // news-1
    DiscussionSectionSchema, // news-2
    DiscussionSectionSchema, // news-3
    OutroSectionSchema,
  ]),
});
export type Script = z.infer<typeof ScriptSchema>;
