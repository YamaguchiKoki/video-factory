/**
 * Script data structure types and Zod validation schemas
 * Defines the structure of parsed script data for video rendering
 */

import { z } from "zod";

/**
 * Speaker role enumeration
 */
export const speakerRoleSchema = z.enum(["agent", "questioner"]);

/**
 * Speaker schema
 * Represents a speaker in the video (AI Agent or human questioner)
 */
export const speakerSchema = z.object({
  id: z.string().min(1, "Speaker ID must not be empty"),
  name: z.string().min(1, "Speaker name must not be empty"),
  role: speakerRoleSchema,
  avatarPath: z.string().min(1, "Avatar path must not be empty"),
  voiceId: z.string().optional(),
});

/**
 * NewsListData schema
 * Data for displaying a list of news items
 */
export const newsListDataSchema = z.object({
  items: z
    .array(
      z.object({
        title: z.string().min(1, "News title must not be empty"),
        category: z.string().min(1, "News category must not be empty"),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
      }),
    )
    .min(1, "News list must contain at least one item"),
});

/**
 * ConceptExplanationData schema
 * Data for explaining concepts with different visualization templates
 */
export const conceptExplanationDataSchema = z.object({
  title: z.string().min(1, "Concept title must not be empty"),
  template: z.enum(["bullet-points", "flowchart", "timeline"]),
  // Optional fields for different templates
  bulletPoints: z
    .array(
      z.object({
        text: z.string().min(1, "Bullet point text must not be empty"),
        emphasis: z.enum(["high", "medium", "low"]).optional(),
      }),
    )
    .optional(),
  flowchartNodes: z
    .array(
      z.object({
        id: z.string().min(1, "Node ID must not be empty"),
        label: z.string().min(1, "Node label must not be empty"),
        connections: z.array(z.string()),
      }),
    )
    .optional(),
  timelineEvents: z
    .array(
      z.object({
        date: z.string().min(1, "Event date must not be empty"),
        label: z.string().min(1, "Event label must not be empty"),
        description: z.string().optional(),
      }),
    )
    .optional(),
});

/**
 * ConversationSummaryData schema
 * Data for summarizing conversation with key points
 */
export const conversationSummaryDataSchema = z.object({
  summaryText: z.string().min(1, "Summary text must not be empty"),
  keyPoints: z.array(
    z.object({
      text: z.string().min(1, "Key point text must not be empty"),
      importance: z.enum(["high", "medium", "low"]),
    }),
  ),
});

/**
 * VisualComponent schema
 * Represents different types of visual components that can be displayed
 */
export const visualComponentSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("news-list"),
    data: newsListDataSchema,
  }),
  z.object({
    type: z.literal("concept-explanation"),
    data: conceptExplanationDataSchema,
  }),
  z.object({
    type: z.literal("conversation-summary"),
    data: conversationSummaryDataSchema,
  }),
]);

/**
 * Segment schema
 * Represents a single segment of dialogue with timing information
 */
export const segmentSchema = z
  .object({
    id: z.string().min(1, "Segment ID must not be empty"),
    speakerId: z.string().min(1, "Speaker ID must not be empty"),
    text: z.string().min(1, "Segment text must not be empty"),
    startTime: z.number().nonnegative("Start time must be non-negative"),
    endTime: z.number().nonnegative("End time must be non-negative"),
    visualComponent: visualComponentSchema.optional(),
  })
  .refine((data) => data.startTime < data.endTime, {
    message: "Start time must be less than end time",
    path: ["endTime"],
  });

/**
 * ScriptMetadata schema
 * Metadata about the script
 */
export const scriptMetadataSchema = z.object({
  title: z.string().min(1, "Title must not be empty"),
  createdAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/, {
      message:
        "CreatedAt must be in ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)",
    }),
  durationSeconds: z.number().positive("Duration must be positive"),
});

/**
 * ParsedScript schema
 * Complete script structure with metadata, speakers, and segments
 */
export const parsedScriptSchema = z.object({
  metadata: scriptMetadataSchema,
  speakers: z
    .array(speakerSchema)
    .min(1, "Script must contain at least one speaker"),
  segments: z
    .array(segmentSchema)
    .min(1, "Script must contain at least one segment"),
});

/**
 * Type exports inferred from Zod schemas
 * These provide TypeScript type safety while maintaining runtime validation
 */
export type Speaker = z.infer<typeof speakerSchema>;
export type NewsListData = z.infer<typeof newsListDataSchema>;
export type ConceptExplanationData = z.infer<
  typeof conceptExplanationDataSchema
>;
export type ConversationSummaryData = z.infer<
  typeof conversationSummaryDataSchema
>;
export type VisualComponent = z.infer<typeof visualComponentSchema>;
export type Segment = z.infer<typeof segmentSchema>;
export type ScriptMetadata = z.infer<typeof scriptMetadataSchema>;
export type ParsedScript = z.infer<typeof parsedScriptSchema>;

/**
 * Helper type for visual component data (union of all data types)
 */
export type VisualComponentData =
  | NewsListData
  | ConceptExplanationData
  | ConversationSummaryData;
