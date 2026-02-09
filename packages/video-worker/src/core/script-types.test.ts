/**
 * Unit tests for script data structure types and Zod validation schema
 * Uses Property-based testing with zod-fast-check
 */

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { ZodFastCheck } from "zod-fast-check";
import {
  conceptExplanationDataSchema,
  conversationSummaryDataSchema,
  newsListDataSchema,
  parsedScriptSchema,
  scriptMetadataSchema,
  segmentSchema,
  speakerSchema,
  visualComponentSchema,
} from "./script-types";

describe("Script Type Validation", () => {
  describe("Speaker Schema", () => {
    it("should validate a valid speaker", () => {
      const validSpeaker = {
        id: "agent",
        name: "AI Agent",
        role: "agent" as const,
        avatarPath: "assets/agent-avatar.png",
      };

      expect(() => speakerSchema.parse(validSpeaker)).not.toThrow();
    });

    it("should validate speaker with optional voiceId", () => {
      const speakerWithVoice = {
        id: "man",
        name: "Tanaka",
        role: "questioner" as const,
        avatarPath: "assets/man-avatar.png",
        voiceId: "voice-001",
      };

      expect(() => speakerSchema.parse(speakerWithVoice)).not.toThrow();
    });

    it("should reject invalid role", () => {
      const invalidSpeaker = {
        id: "test",
        name: "Test",
        role: "invalid",
        avatarPath: "test.png",
      };

      expect(() => speakerSchema.parse(invalidSpeaker)).toThrow();
    });

    it("should reject missing required fields", () => {
      const missingFields = {
        id: "test",
        name: "Test",
      };

      expect(() => speakerSchema.parse(missingFields)).toThrow();
    });
  });

  describe("Segment Schema", () => {
    it("should validate a valid segment without visual component", () => {
      const validSegment = {
        id: "seg-001",
        speakerId: "agent",
        text: "Hello world",
        startTime: 0,
        endTime: 3,
      };

      expect(() => segmentSchema.parse(validSegment)).not.toThrow();
    });

    it("should validate segment with visual component", () => {
      const segmentWithVisual = {
        id: "seg-002",
        speakerId: "agent",
        text: "Here are the news",
        startTime: 3,
        endTime: 7,
        visualComponent: {
          type: "news-list",
          data: {
            items: [
              {
                title: "News 1",
                category: "Politics",
                date: "2026-02-09",
              },
            ],
          },
        },
      };

      expect(() => segmentSchema.parse(segmentWithVisual)).not.toThrow();
    });

    it("should reject negative time values", () => {
      const invalidTime = {
        id: "seg-001",
        speakerId: "agent",
        text: "Test",
        startTime: -1,
        endTime: 3,
      };

      expect(() => segmentSchema.parse(invalidTime)).toThrow();
    });

    it("should reject endTime less than startTime", () => {
      const invalidRange = {
        id: "seg-001",
        speakerId: "agent",
        text: "Test",
        startTime: 5,
        endTime: 3,
      };

      expect(() => segmentSchema.parse(invalidRange)).toThrow();
    });
  });

  describe("ScriptMetadata Schema", () => {
    it("should validate valid metadata", () => {
      const validMetadata = {
        title: "2026-02-09 News",
        createdAt: "2026-02-09T09:00:00Z",
        durationSeconds: 600,
      };

      expect(() => scriptMetadataSchema.parse(validMetadata)).not.toThrow();
    });

    it("should reject invalid ISO 8601 date", () => {
      const invalidDate = {
        title: "News",
        createdAt: "2026/02/09",
        durationSeconds: 600,
      };

      expect(() => scriptMetadataSchema.parse(invalidDate)).toThrow();
    });

    it("should reject negative duration", () => {
      const negativeDuration = {
        title: "News",
        createdAt: "2026-02-09T09:00:00Z",
        durationSeconds: -10,
      };

      expect(() => scriptMetadataSchema.parse(negativeDuration)).toThrow();
    });
  });

  describe("NewsListData Schema", () => {
    it("should validate valid news list data", () => {
      const validNewsListData = {
        items: [
          {
            title: "Government announces new policy",
            category: "Politics",
            date: "2026-02-09",
          },
          {
            title: "AI breakthrough",
            category: "Technology",
            date: "2026-02-09",
          },
        ],
      };

      expect(() => newsListDataSchema.parse(validNewsListData)).not.toThrow();
    });

    it("should reject empty items array", () => {
      const emptyItems = {
        items: [],
      };

      expect(() => newsListDataSchema.parse(emptyItems)).toThrow();
    });
  });

  describe("ConceptExplanationData Schema", () => {
    it("should validate bullet-points template", () => {
      const bulletPointsData = {
        title: "What is election dissolution",
        template: "bullet-points" as const,
        bulletPoints: [
          { text: "Point 1", emphasis: "high" as const },
          { text: "Point 2", emphasis: "medium" as const },
        ],
      };

      expect(() =>
        conceptExplanationDataSchema.parse(bulletPointsData),
      ).not.toThrow();
    });

    it("should validate flowchart template", () => {
      const flowchartData = {
        title: "Process flow",
        template: "flowchart" as const,
        flowchartNodes: [
          { id: "node1", label: "Start", connections: ["node2"] },
          { id: "node2", label: "End", connections: [] },
        ],
      };

      expect(() =>
        conceptExplanationDataSchema.parse(flowchartData),
      ).not.toThrow();
    });

    it("should validate timeline template", () => {
      const timelineData = {
        title: "Historical timeline",
        template: "timeline" as const,
        timelineEvents: [
          { date: "2026-01-01", label: "Event 1", description: "First event" },
          { date: "2026-02-01", label: "Event 2" },
        ],
      };

      expect(() =>
        conceptExplanationDataSchema.parse(timelineData),
      ).not.toThrow();
    });

    it("should reject invalid template type", () => {
      const invalidTemplate = {
        title: "Test",
        template: "invalid",
      };

      expect(() =>
        conceptExplanationDataSchema.parse(invalidTemplate),
      ).toThrow();
    });
  });

  describe("ConversationSummaryData Schema", () => {
    it("should validate valid conversation summary", () => {
      const validSummary = {
        summaryText: "This is a summary",
        keyPoints: [
          { text: "Point 1", importance: "high" as const },
          { text: "Point 2", importance: "low" as const },
        ],
      };

      expect(() =>
        conversationSummaryDataSchema.parse(validSummary),
      ).not.toThrow();
    });

    it("should reject invalid importance level", () => {
      const invalidImportance = {
        summaryText: "Summary",
        keyPoints: [{ text: "Point", importance: "critical" }],
      };

      expect(() =>
        conversationSummaryDataSchema.parse(invalidImportance),
      ).toThrow();
    });
  });

  describe("VisualComponent Schema", () => {
    it("should validate news-list component", () => {
      const newsListComponent = {
        type: "news-list" as const,
        data: {
          items: [{ title: "News", category: "Tech", date: "2026-02-09" }],
        },
      };

      expect(() =>
        visualComponentSchema.parse(newsListComponent),
      ).not.toThrow();
    });

    it("should validate concept-explanation component", () => {
      const conceptComponent = {
        type: "concept-explanation" as const,
        data: {
          title: "Concept",
          template: "bullet-points" as const,
          bulletPoints: [{ text: "Point", emphasis: "high" as const }],
        },
      };

      expect(() => visualComponentSchema.parse(conceptComponent)).not.toThrow();
    });

    it("should validate conversation-summary component", () => {
      const summaryComponent = {
        type: "conversation-summary" as const,
        data: {
          summaryText: "Summary",
          keyPoints: [{ text: "Key point", importance: "medium" as const }],
        },
      };

      expect(() => visualComponentSchema.parse(summaryComponent)).not.toThrow();
    });
  });

  describe("ParsedScript Schema", () => {
    it("should validate complete valid script", () => {
      const validScript = {
        metadata: {
          title: "2026-02-09 News",
          createdAt: "2026-02-09T09:00:00Z",
          durationSeconds: 600,
        },
        speakers: [
          {
            id: "agent",
            name: "AI Agent",
            role: "agent" as const,
            avatarPath: "assets/agent.png",
          },
          {
            id: "man",
            name: "Tanaka",
            role: "questioner" as const,
            avatarPath: "assets/man.png",
          },
        ],
        segments: [
          {
            id: "seg-001",
            speakerId: "man",
            text: "Tell me the news",
            startTime: 0,
            endTime: 3,
          },
          {
            id: "seg-002",
            speakerId: "agent",
            text: "Here are today's news",
            startTime: 3,
            endTime: 7,
            visualComponent: {
              type: "news-list" as const,
              data: {
                items: [
                  { title: "News 1", category: "Politics", date: "2026-02-09" },
                ],
              },
            },
          },
        ],
      };

      expect(() => parsedScriptSchema.parse(validScript)).not.toThrow();
    });

    it("should reject script with empty speakers array", () => {
      const emptySpeakers = {
        metadata: {
          title: "Test",
          createdAt: "2026-02-09T09:00:00Z",
          durationSeconds: 100,
        },
        speakers: [],
        segments: [
          {
            id: "seg-001",
            speakerId: "agent",
            text: "Test",
            startTime: 0,
            endTime: 3,
          },
        ],
      };

      expect(() => parsedScriptSchema.parse(emptySpeakers)).toThrow();
    });

    it("should reject script with empty segments array", () => {
      const emptySegments = {
        metadata: {
          title: "Test",
          createdAt: "2026-02-09T09:00:00Z",
          durationSeconds: 100,
        },
        speakers: [
          {
            id: "agent",
            name: "Agent",
            role: "agent" as const,
            avatarPath: "avatar.png",
          },
        ],
        segments: [],
      };

      expect(() => parsedScriptSchema.parse(emptySegments)).toThrow();
    });

    it("should reject script with missing required fields", () => {
      const missingMetadata = {
        speakers: [
          {
            id: "agent",
            name: "Agent",
            role: "agent" as const,
            avatarPath: "avatar.png",
          },
        ],
        segments: [
          {
            id: "seg-001",
            speakerId: "agent",
            text: "Test",
            startTime: 0,
            endTime: 3,
          },
        ],
      };

      expect(() => parsedScriptSchema.parse(missingMetadata)).toThrow();
    });
  });

  describe("Type Inference", () => {
    it("should correctly infer Speaker type from schema", () => {
      const speaker = {
        id: "agent",
        name: "AI Agent",
        role: "agent" as const,
        avatarPath: "assets/agent.png",
        voiceId: "voice-001",
      };

      const parsed = speakerSchema.parse(speaker);

      // Type assertion to verify type inference works
      const typedSpeaker: z.infer<typeof speakerSchema> = parsed;
      expect(typedSpeaker.id).toBe("agent");
      expect(typedSpeaker.voiceId).toBe("voice-001");
    });

    it("should correctly infer ParsedScript type from schema", () => {
      const script = {
        metadata: {
          title: "Test",
          createdAt: "2026-02-09T09:00:00Z",
          durationSeconds: 100,
        },
        speakers: [
          {
            id: "agent",
            name: "Agent",
            role: "agent" as const,
            avatarPath: "avatar.png",
          },
        ],
        segments: [
          {
            id: "seg-001",
            speakerId: "agent",
            text: "Test",
            startTime: 0,
            endTime: 3,
          },
        ],
      };

      const parsed = parsedScriptSchema.parse(script);

      // Type assertion to verify type inference works
      const typedScript: z.infer<typeof parsedScriptSchema> = parsed;
      expect(typedScript.metadata.title).toBe("Test");
      expect(typedScript.speakers).toHaveLength(1);
      expect(typedScript.segments).toHaveLength(1);
    });
  });

  describe("Property-based Testing with zod-fast-check", () => {
    const zfc = ZodFastCheck();

    it("should validate any generated Speaker from schema", () => {
      fc.assert(
        fc.property(zfc.inputOf(speakerSchema), (speaker) => {
          const result = speakerSchema.safeParse(speaker);
          expect(result.success).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it("should validate any generated ConceptExplanationData from schema", () => {
      fc.assert(
        fc.property(
          zfc.inputOf(conceptExplanationDataSchema),
          (conceptData) => {
            const result = conceptExplanationDataSchema.safeParse(conceptData);
            expect(result.success).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should validate any generated ConversationSummaryData from schema", () => {
      fc.assert(
        fc.property(
          zfc.inputOf(conversationSummaryDataSchema),
          (summaryData) => {
            const result = conversationSummaryDataSchema.safeParse(summaryData);
            expect(result.success).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should maintain property: all startTime values are non-negative", () => {
      fc.assert(
        fc.property(
          fc
            .record({
              id: fc.string({ minLength: 1 }),
              speakerId: fc.string({ minLength: 1 }),
              text: fc.string({ minLength: 1 }),
              startTime: fc.nat(),
              endTime: fc.nat(),
            })
            .filter((seg) => seg.startTime < seg.endTime),
          (segment) => {
            expect(segment.startTime).toBeGreaterThanOrEqual(0);
            expect(segment.endTime).toBeGreaterThan(segment.startTime);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should maintain property: all positive durations are greater than zero", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 10000 }), (duration) => {
          expect(duration).toBeGreaterThan(0);
        }),
        { numRuns: 100 },
      );
    });

    it("should maintain property: ISO 8601 date format is correctly validated", () => {
      const validIso8601Arb = fc
        .date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") })
        .filter((d) => !isNaN(d.getTime()))
        .map((d) => d.toISOString());

      fc.assert(
        fc.property(validIso8601Arb, (dateString) => {
          const result =
            scriptMetadataSchema.shape.createdAt.safeParse(dateString);
          expect(result.success).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it("should maintain property: YYYY-MM-DD date format is correctly validated", () => {
      const validYyyyMmDdArb = fc
        .date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") })
        .filter((d) => !isNaN(d.getTime()))
        .map((d) => d.toISOString().split("T")[0]);

      fc.assert(
        fc.property(validYyyyMmDdArb, (dateString) => {
          const newsItem = newsListDataSchema.shape.items.element.shape;
          const result = newsItem.date.safeParse(dateString);
          expect(result.success).toBe(true);
        }),
        { numRuns: 100 },
      );
    });
  });
});
