import { z } from "zod";

const SpeakerSchema = z.enum(["A", "B"]);

const NewsItemSchema = z.object({
  id: z.string(),
  title: z.string(),
});

/** 音声生成済みの1発話（Remotionが扱う最小単位） */
export const TimedLineSchema = z.object({
  speaker: SpeakerSchema,
  text: z.string(),
  audioPath: z.string().describe("S3パス"),
  startSec: z
    .number()
    .describe("音声全体でみた時の開始位置(秒) wav生成時のオフセット"),
  durationSec: z.number().describe("継続時間 wav実測値"),
});
export type TimedLine = z.infer<typeof TimedLineSchema>;

/** セクション境界（演出切替用） */
const IntroSectionMarkerSchema = z
  .object({
    type: z.literal("intro"),
    startSec: z.number(),
    endSec: z.number(),
    agenda: z
      .array(
        z.object({
          id: z.string(),
          title: z.string(),
        }),
      )
      .optional()
      .describe("Overview agenda items for intro section"),
  })
  .describe("導入。overview用のUI表示などを想定");

const DiscussionSectionMarkerSchema = z
  .object({
    type: z.literal("discussion"),
    newsId: z.enum(["news-1", "news-2", "news-3"]),
    phase: z
      .enum(["summary", "background", "deepDive"])
      .describe("要約、背景情報の確認、深掘り"),
    startSec: z.number(),
    endSec: z.number(),
  })
  .describe("各ニュースにおいてこれらのphaseを踏む");

const OutroSectionMarkerSchema = z.object({
  type: z.literal("outro"),
  startSec: z.number(),
  endSec: z.number(),
});

export const SectionMarkerSchema = z.discriminatedUnion("type", [
  IntroSectionMarkerSchema,
  DiscussionSectionMarkerSchema,
  OutroSectionMarkerSchema,
]);
export type SectionMarker = z.infer<typeof SectionMarkerSchema>;
export type IntroSectionMarker = z.infer<typeof IntroSectionMarkerSchema>;
export type DiscussionSectionMarker = z.infer<
  typeof DiscussionSectionMarkerSchema
>;
export type OutroSectionMarker = z.infer<typeof OutroSectionMarkerSchema>;

/** Remotionコンポジションに渡すprops */
export const VideoPropsSchema = z.object({
  title: z.string(),
  newsItems: z.array(NewsItemSchema),
  totalDurationSec: z.number(),
  lines: z.array(TimedLineSchema),
  sectionMarkers: z.array(SectionMarkerSchema),
});
export type VideoProps = z.infer<typeof VideoPropsSchema>;
