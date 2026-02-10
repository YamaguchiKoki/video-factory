import { z } from "zod";

// ============================================
// Speaker
// ============================================
export const SpeakerSchema = z.enum(["A", "B"]);
export type Speaker = z.infer<typeof SpeakerSchema>;

// ============================================
// Layer 1: LLM出力（スクリプト）
// ============================================

/** LLMが生成する1発話 */
export const LineSchema = z.object({
  speaker: SpeakerSchema,
  text: z.string(),
});
export type Line = z.infer<typeof LineSchema>;

/** ニュースアイテム（導入〜掘り下げを横断するエンティティ） */
export const NewsItemSchema = z.object({
  id: z.string().describe("news-1, news-2, news-3"),
  title: z.string().describe("ニュースの見出し"),
  sourceUrl: z.string().url().optional(),
});
export type NewsItem = z.infer<typeof NewsItemSchema>;

/** 導入: 挨拶 → ニュース一覧紹介 */
export const IntroSectionSchema = z.object({
  type: z.literal("intro"),
  greeting: z.array(LineSchema),
  newsOverview: z.array(LineSchema).describe("今日の3つのニュースを軽く紹介"),
});

/** 対話フロー: 1ニュースにつき1つ */
export const DiscussionPhaseSchema = z.enum([
  "summary", // 概要説明
  "background", // 前提確認
  "deepDive", // 掘り下げ
]);

export const DiscussionBlockSchema = z.object({
  phase: DiscussionPhaseSchema,
  lines: z.array(LineSchema),
});

export const DiscussionSectionSchema = z.object({
  type: z.literal("discussion"),
  newsId: z.string().describe("対象ニュースのID"),
  blocks: z.tuple([
    DiscussionBlockSchema, // summary
    DiscussionBlockSchema, // background
    DiscussionBlockSchema, // deepDive
  ]),
});

/** まとめ */
export const OutroSectionSchema = z.object({
  type: z.literal("outro"),
  recap: z.array(LineSchema),
  closing: z.array(LineSchema),
});

/** セクション（discriminated union） */
export const SectionSchema = z.discriminatedUnion("type", [
  IntroSectionSchema,
  DiscussionSectionSchema,
  OutroSectionSchema,
]);
export type Section = z.infer<typeof SectionSchema>;

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
