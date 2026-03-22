import { z } from "zod";

// ---------------------------------------------------------------------------
// Line (atomic unit shared across all section types)
// ---------------------------------------------------------------------------

export const EnrichedLineSchema = z.object({
  speaker: z.enum(["A", "B"]),
  text: z.string(),
  voicevoxSpeakerId: z.number(),
  offsetSec: z.number(),
  durationSec: z.number(),
});

export type EnrichedLine = z.infer<typeof EnrichedLineSchema>;

// ---------------------------------------------------------------------------
// NewsItem
// ---------------------------------------------------------------------------

const EnrichedNewsItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  sourceUrl: z.string(),
});

// ---------------------------------------------------------------------------
// Discussion block
// ---------------------------------------------------------------------------

const DiscussionBlockSchema = z.object({
  phase: z.enum(["summary", "background", "deepDive"]),
  lines: z.array(EnrichedLineSchema).min(1),
});

// ---------------------------------------------------------------------------
// Section variants
// ---------------------------------------------------------------------------

const IntroSectionSchema = z.object({
  type: z.literal("intro"),
  greeting: z.array(EnrichedLineSchema),
  newsOverview: z.array(EnrichedLineSchema),
});

const DiscussionSectionSchema = z.object({
  type: z.literal("discussion"),
  newsId: z.string(),
  blocks: z.array(DiscussionBlockSchema).min(1),
});

const OutroSectionSchema = z.object({
  type: z.literal("outro"),
  recap: z.array(EnrichedLineSchema),
  closing: z.array(EnrichedLineSchema),
});

const EnrichedSectionSchema = z.discriminatedUnion("type", [
  IntroSectionSchema,
  DiscussionSectionSchema,
  OutroSectionSchema,
]);

// ---------------------------------------------------------------------------
// Top-level script
// ---------------------------------------------------------------------------

export const EnrichedScriptSchema = z.object({
  title: z.string(),
  totalDurationSec: z.number(),
  outputWavS3Key: z.string(),
  newsItems: z.array(EnrichedNewsItemSchema),
  sections: z.array(EnrichedSectionSchema),
});

export type EnrichedScript = z.infer<typeof EnrichedScriptSchema>;
