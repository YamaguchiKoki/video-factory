import { z } from "zod";

export const SpeakerSchema = z
  .enum(["A", "B"])
  .describe("対話の話者ID。A=解説役、B=質問役");
export type Speaker = z.infer<typeof SpeakerSchema>;

export const NewsIdSchema = z
  .enum(["news-1", "news-2", "news-3"])
  .describe("1番組につき扱う3つのニュースを区別する固定ID");
export type NewsId = z.infer<typeof NewsIdSchema>;

export const LineSchema = z
  .object({
    speaker: SpeakerSchema,
    text: z.string().describe("話者の発話テキスト。TTSで音声化される"),
  })
  .describe("対話スクリプトを構成する1発話");
export type Line = z.infer<typeof LineSchema>;

export const NewsItemSchema = z
  .object({
    id: NewsIdSchema,
    title: z.string().describe("ニュースの見出し"),
    sourceUrl: z
      .string()
      .url()
      .optional()
      .describe(
        "出典URL。ファクトチェック済みのソースが存在する場合のみ付与され、概要欄の参考リンクとして利用される",
      ),
  })
  .describe("番組内で取り上げる単一ニュースのメタデータ");
export type NewsItem = z.infer<typeof NewsItemSchema>;

export const IntroSectionSchema = z
  .object({
    type: z.literal("intro"),
    greeting: z
      .array(LineSchema)
      .describe("番組冒頭の挨拶パート（聴取者への呼びかけ）"),
    newsOverview: z
      .array(LineSchema)
      .describe("今日の3つのニュースを軽く紹介するパート"),
  })
  .describe("導入セクション。挨拶 → ニュース予告の構成");
export type IntroSection = z.infer<typeof IntroSectionSchema>;

export const DiscussionPhaseSchema = z
  .enum(["summary", "background", "deepDive"])
  .describe(
    "議論フェーズ。summary=概要説明 → background=前提確認 → deepDive=掘り下げ の順に1ニュースを展開する",
  );
export type DiscussionPhase = z.infer<typeof DiscussionPhaseSchema>;

export const DiscussionBlockSchema = z
  .object({
    phase: DiscussionPhaseSchema,
    lines: z.array(LineSchema).describe("当該フェーズの対話発話列"),
  })
  .describe("議論セクション内の1フェーズ単位");
export type DiscussionBlock = z.infer<typeof DiscussionBlockSchema>;

export const DiscussionSectionSchema = z
  .object({
    type: z.literal("discussion"),
    newsId: NewsIdSchema.describe("どのニュースについての議論かを示すID"),
    blocks: z
      .tuple([
        DiscussionBlockSchema,
        DiscussionBlockSchema,
        DiscussionBlockSchema,
      ])
      .describe(
        "summary / background / deepDive の3フェーズを順に並べた固定長",
      ),
  })
  .describe("1ニュースの議論セクション。1番組に3つ存在する");
export type DiscussionSection = z.infer<typeof DiscussionSectionSchema>;

export const OutroSectionSchema = z
  .object({
    type: z.literal("outro"),
    recap: z.array(LineSchema).describe("3ニュースの振り返り"),
    closing: z.array(LineSchema).describe("締めの挨拶（次回予告など）"),
  })
  .describe("締めくくりセクション。振り返り → 終了挨拶の構成");
export type OutroSection = z.infer<typeof OutroSectionSchema>;

export const ScriptSchema = z
  .object({
    title: z.string().describe("番組タイトル。YouTube動画タイトルとしても利用"),
    newsItems: z
      .array(NewsItemSchema)
      .length(3)
      .describe("番組で扱う3つのニュース。順序は newsId と一致する"),
    sections: z
      .tuple([
        IntroSectionSchema,
        DiscussionSectionSchema,
        DiscussionSectionSchema,
        DiscussionSectionSchema,
        OutroSectionSchema,
      ])
      .describe("intro → discussion×3 → outro の固定5要素タプル"),
  })
  .describe(
    "script-generator が生成し S3 に書き出す対話型ラジオスクリプト全体。tts-worker / metadata-generator / video-worker の共通入力契約",
  );
export type Script = z.infer<typeof ScriptSchema>;
