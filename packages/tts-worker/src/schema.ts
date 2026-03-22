import { z } from "zod";

// ============================================
// Speaker
// ============================================
export const SpeakerSchema = z.enum(["A", "B"]);
export type Speaker = z.infer<typeof SpeakerSchema>;

// ============================================
// Layer 1: LLM出力（スクリプト） — script-generator と同期
// ============================================

export const LineSchema = z.object({
  speaker: SpeakerSchema,
  text: z.string(),
});
export type Line = z.infer<typeof LineSchema>;

export const NewsItemSchema = z.object({
  id: z.string().describe("news-1, news-2, news-3"),
  title: z.string().describe("ニュースの見出し"),
  sourceUrl: z.string().url().optional(),
});
export type NewsItem = z.infer<typeof NewsItemSchema>;

export const IntroSectionSchema = z.object({
  type: z.literal("intro"),
  greeting: z.array(LineSchema),
  newsOverview: z.array(LineSchema).describe("今日の3つのニュースを軽く紹介"),
});

export const DiscussionPhaseSchema = z.enum([
  "summary",
  "background",
  "deepDive",
]);

export const DiscussionBlockSchema = z.object({
  phase: DiscussionPhaseSchema,
  lines: z.array(LineSchema),
});

export const DiscussionSectionSchema = z.object({
  type: z.literal("discussion"),
  newsId: z.string().describe("対象ニュースのID"),
  blocks: z.tuple([
    DiscussionBlockSchema,
    DiscussionBlockSchema,
    DiscussionBlockSchema,
  ]),
});

export const OutroSectionSchema = z.object({
  type: z.literal("outro"),
  recap: z.array(LineSchema),
  closing: z.array(LineSchema),
});

export const SectionSchema = z.discriminatedUnion("type", [
  IntroSectionSchema,
  DiscussionSectionSchema,
  OutroSectionSchema,
]);
export type Section = z.infer<typeof SectionSchema>;
export type DiscussionSection = z.infer<typeof DiscussionSectionSchema>;

export const ScriptSchema = z.object({
  title: z.string(),
  newsItems: z.array(NewsItemSchema).length(3),
  sections: z.tuple([
    IntroSectionSchema,
    DiscussionSectionSchema,
    DiscussionSectionSchema,
    DiscussionSectionSchema,
    OutroSectionSchema,
  ]),
});
export type Script = z.infer<typeof ScriptSchema>;

// ============================================
// Layer 2: 音声タイミング情報を付与したエンリッチ済みスクリプト
// ============================================

export const EnrichedLineSchema = LineSchema.extend({
  voicevoxSpeakerId: z.number().describe("VOICEVOXスピーカーID"),
  offsetSec: z.number().describe("エピソード先頭からの開始オフセット（秒）"),
  durationSec: z.number().describe("この行の音声長（秒）"),
});
export type EnrichedLine = z.infer<typeof EnrichedLineSchema>;

export const EnrichedIntroSectionSchema = z.object({
  type: z.literal("intro"),
  greeting: z.array(EnrichedLineSchema),
  newsOverview: z.array(EnrichedLineSchema),
});

export const EnrichedDiscussionBlockSchema = z.object({
  phase: DiscussionPhaseSchema,
  lines: z.array(EnrichedLineSchema),
});

export const EnrichedDiscussionSectionSchema = z.object({
  type: z.literal("discussion"),
  newsId: z.string(),
  blocks: z.tuple([
    EnrichedDiscussionBlockSchema,
    EnrichedDiscussionBlockSchema,
    EnrichedDiscussionBlockSchema,
  ]),
});

export const EnrichedOutroSectionSchema = z.object({
  type: z.literal("outro"),
  recap: z.array(EnrichedLineSchema),
  closing: z.array(EnrichedLineSchema),
});

export const EnrichedScriptSchema = z.object({
  title: z.string(),
  totalDurationSec: z.number().describe("全音声の合計秒数"),
  outputWavS3Key: z.string().describe("アップロード先S3キー"),
  newsItems: z.array(NewsItemSchema).length(3),
  sections: z.tuple([
    EnrichedIntroSectionSchema,
    EnrichedDiscussionSectionSchema,
    EnrichedDiscussionSectionSchema,
    EnrichedDiscussionSectionSchema,
    EnrichedOutroSectionSchema,
  ]),
});
export type EnrichedScript = z.infer<typeof EnrichedScriptSchema>;
