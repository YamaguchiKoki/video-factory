import { z } from "zod";
import {
  DiscussionPhaseSchema,
  NewsIdSchema,
  NewsItemSchema,
  SpeakerSchema,
} from "./script.js";

export const EnrichedLineSchema = z
  .object({
    speaker: SpeakerSchema,
    text: z.string().describe("元スクリプトと同じ発話テキスト"),
    voicevoxSpeakerId: z
      .number()
      .describe(
        "VOICEVOX エンジンの内部スピーカーID（speaker A/B からマッピング）",
      ),
    offsetSec: z
      .number()
      .describe(
        "結合済みWAVの先頭からの開始秒。Remotionのタイムライン配置に利用",
      ),
    durationSec: z.number().describe("当該発話の長さ（秒）。WAV実測値"),
  })
  .describe(
    "音声タイミング情報を付与した1発話。tts-worker が VOICEVOX 合成後に組み立てる",
  );
export type EnrichedLine = z.infer<typeof EnrichedLineSchema>;

export const EnrichedIntroSectionSchema = z
  .object({
    type: z.literal("intro"),
    greeting: z.array(EnrichedLineSchema),
    newsOverview: z.array(EnrichedLineSchema),
  })
  .describe("音声タイミング付きの導入セクション");
export type EnrichedIntroSection = z.infer<typeof EnrichedIntroSectionSchema>;

export const EnrichedDiscussionBlockSchema = z
  .object({
    phase: DiscussionPhaseSchema,
    lines: z
      .array(EnrichedLineSchema)
      .min(1)
      .describe("当該フェーズの発話列。1件以上必須"),
  })
  .describe("音声タイミング付きの議論ブロック");
export type EnrichedDiscussionBlock = z.infer<
  typeof EnrichedDiscussionBlockSchema
>;

export const EnrichedDiscussionSectionSchema = z
  .object({
    type: z.literal("discussion"),
    newsId: NewsIdSchema,
    blocks: z
      .array(EnrichedDiscussionBlockSchema)
      .min(1)
      .describe("議論フェーズ群。1件以上必須"),
  })
  .describe("音声タイミング付きの議論セクション");
export type EnrichedDiscussionSection = z.infer<
  typeof EnrichedDiscussionSectionSchema
>;

export const EnrichedOutroSectionSchema = z
  .object({
    type: z.literal("outro"),
    recap: z.array(EnrichedLineSchema),
    closing: z.array(EnrichedLineSchema),
  })
  .describe("音声タイミング付きの締めセクション");
export type EnrichedOutroSection = z.infer<typeof EnrichedOutroSectionSchema>;

export const EnrichedSectionSchema = z
  .discriminatedUnion("type", [
    EnrichedIntroSectionSchema,
    EnrichedDiscussionSectionSchema,
    EnrichedOutroSectionSchema,
  ])
  .describe("type フィールドで判別可能な enriched セクション");
export type EnrichedSection = z.infer<typeof EnrichedSectionSchema>;

export const EnrichedScriptSchema = z
  .object({
    title: z.string().describe("元スクリプトのタイトルをそのまま継承"),
    totalDurationSec: z
      .number()
      .describe("結合WAVの総再生時間（秒）。Remotionのフレーム数算出に利用"),
    outputWavS3Key: z
      .string()
      .describe(
        "結合済みWAVの S3 キー。video-worker がダウンロード対象として参照",
      ),
    newsItems: z
      .array(NewsItemSchema)
      .describe("元スクリプトの newsItems を継承"),
    sections: z
      .array(EnrichedSectionSchema)
      .describe(
        "intro / discussion / outro の連続。production では intro→discussion×3→outro の順だが、テスト容易性のためタプル制約は課していない",
      ),
  })
  .describe(
    "tts-worker が音声タイミングを付与して S3 に書き出す中間表現。video-worker が消費する",
  );
export type EnrichedScript = z.infer<typeof EnrichedScriptSchema>;
