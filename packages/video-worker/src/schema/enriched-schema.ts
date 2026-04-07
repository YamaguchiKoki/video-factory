import { Schema } from "effect";

// ---------------------------------------------------------------------------
// Line (atomic unit shared across all section types)
// ---------------------------------------------------------------------------

export const EnrichedLineSchema = Schema.Struct({
  speaker: Schema.Literals(["A", "B"]),
  text: Schema.String,
  voicevoxSpeakerId: Schema.Number,
  offsetSec: Schema.Number,
  durationSec: Schema.Number,
});

export type EnrichedLine = typeof EnrichedLineSchema.Type;

// ---------------------------------------------------------------------------
// NewsItem
// ---------------------------------------------------------------------------

const EnrichedNewsItemSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  sourceUrl: Schema.String,
});

// ---------------------------------------------------------------------------
// Discussion block
// ---------------------------------------------------------------------------

const DiscussionBlockSchema = Schema.Struct({
  phase: Schema.Literals(["summary", "background", "deepDive"]),
  lines: Schema.Array(EnrichedLineSchema).check(
    Schema.makeFilter(
      (lines) => lines.length >= 1 || "lines must have at least 1 element",
    ),
  ),
});

// ---------------------------------------------------------------------------
// Section variants
// ---------------------------------------------------------------------------

const IntroSectionSchema = Schema.Struct({
  type: Schema.Literal("intro"),
  greeting: Schema.Array(EnrichedLineSchema),
  newsOverview: Schema.Array(EnrichedLineSchema),
});

const DiscussionSectionSchema = Schema.Struct({
  type: Schema.Literal("discussion"),
  newsId: Schema.Literals(["news-1", "news-2", "news-3"]),
  blocks: Schema.Array(DiscussionBlockSchema).check(
    Schema.makeFilter(
      (blocks) => blocks.length >= 1 || "blocks must have at least 1 element",
    ),
  ),
});

const OutroSectionSchema = Schema.Struct({
  type: Schema.Literal("outro"),
  recap: Schema.Array(EnrichedLineSchema),
  closing: Schema.Array(EnrichedLineSchema),
});

const EnrichedSectionSchema = Schema.Union([
  IntroSectionSchema,
  DiscussionSectionSchema,
  OutroSectionSchema,
]);

// ---------------------------------------------------------------------------
// Top-level script
// ---------------------------------------------------------------------------

export const EnrichedScriptSchema = Schema.Struct({
  title: Schema.String,
  totalDurationSec: Schema.Number,
  outputWavS3Key: Schema.String,
  newsItems: Schema.Array(EnrichedNewsItemSchema),
  sections: Schema.Array(EnrichedSectionSchema),
});

export type EnrichedScript = typeof EnrichedScriptSchema.Type;
