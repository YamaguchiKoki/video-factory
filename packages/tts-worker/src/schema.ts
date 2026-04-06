import { Schema } from "effect";

// ============================================
// Speaker
// ============================================

export const Speaker = Schema.Literals(["A", "B"]);
export type Speaker = typeof Speaker.Type;

// ============================================
// Layer 1: LLM出力（スクリプト） — script-generator と同期
// ============================================

export const Line = Schema.Struct({
  speaker: Speaker,
  text: Schema.String,
});
export type Line = typeof Line.Type;

const urlPattern = /^https?:\/\/.+/;

export const NewsItem = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  sourceUrl: Schema.optional(Schema.String.check(Schema.isPattern(urlPattern))),
});
export type NewsItem = typeof NewsItem.Type;

const IntroSection = Schema.Struct({
  type: Schema.Literal("intro"),
  greeting: Schema.Array(Line),
  newsOverview: Schema.Array(Line),
});

const DiscussionPhase = Schema.Literals(["summary", "background", "deepDive"]);

const DiscussionBlock = Schema.Struct({
  phase: DiscussionPhase,
  lines: Schema.Array(Line),
});

export const DiscussionSection = Schema.Struct({
  type: Schema.Literal("discussion"),
  newsId: Schema.Literals(["news-1", "news-2", "news-3"]),
  blocks: Schema.Tuple([DiscussionBlock, DiscussionBlock, DiscussionBlock]),
});

const OutroSection = Schema.Struct({
  type: Schema.Literal("outro"),
  recap: Schema.Array(Line),
  closing: Schema.Array(Line),
});

export type DiscussionSection = typeof DiscussionSection.Type;

export const Script = Schema.Struct({
  title: Schema.String,
  newsItems: Schema.Array(NewsItem).check(
    Schema.isMinLength(3),
    Schema.isMaxLength(3),
  ),
  sections: Schema.Tuple([
    IntroSection,
    DiscussionSection,
    DiscussionSection,
    DiscussionSection,
    OutroSection,
  ]),
});
export type Script = typeof Script.Type;

// ============================================
// Layer 2: 音声タイミング情報を付与したエンリッチ済みスクリプト
// ============================================

export const EnrichedLine = Schema.Struct({
  speaker: Speaker,
  text: Schema.String,
  voicevoxSpeakerId: Schema.Number,
  offsetSec: Schema.Number,
  durationSec: Schema.Number,
});
export type EnrichedLine = typeof EnrichedLine.Type;

const EnrichedIntroSection = Schema.Struct({
  type: Schema.Literal("intro"),
  greeting: Schema.Array(EnrichedLine),
  newsOverview: Schema.Array(EnrichedLine),
});

const EnrichedDiscussionBlock = Schema.Struct({
  phase: DiscussionPhase,
  lines: Schema.Array(EnrichedLine),
});

const EnrichedDiscussionSection = Schema.Struct({
  type: Schema.Literal("discussion"),
  newsId: Schema.Literals(["news-1", "news-2", "news-3"]),
  blocks: Schema.Tuple([
    EnrichedDiscussionBlock,
    EnrichedDiscussionBlock,
    EnrichedDiscussionBlock,
  ]),
});

const EnrichedOutroSection = Schema.Struct({
  type: Schema.Literal("outro"),
  recap: Schema.Array(EnrichedLine),
  closing: Schema.Array(EnrichedLine),
});

export const EnrichedScript = Schema.Struct({
  title: Schema.String,
  totalDurationSec: Schema.Number,
  outputWavS3Key: Schema.String,
  newsItems: Schema.Array(NewsItem).check(
    Schema.isMinLength(3),
    Schema.isMaxLength(3),
  ),
  sections: Schema.Tuple([
    EnrichedIntroSection,
    EnrichedDiscussionSection,
    EnrichedDiscussionSection,
    EnrichedDiscussionSection,
    EnrichedOutroSection,
  ]),
});
export type EnrichedScript = typeof EnrichedScript.Type;
