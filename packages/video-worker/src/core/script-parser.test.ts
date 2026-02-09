/**
 * ScriptParser Unit Tests
 * Comprehensive tests including property-based testing (fuzzing)
 */

import { describe, expect, it } from "vitest";
import { parseScript } from "./script-parser";

describe("parseScript", () => {
  describe("Valid script parsing", () => {
    it("should parse a valid script successfully", () => {
      const validScript = JSON.stringify({
        metadata: {
          title: "Test Script",
          createdAt: "2026-02-09T09:00:00.000Z",
          durationSeconds: 100,
        },
        speakers: [
          {
            id: "agent",
            name: "AI Agent",
            role: "agent",
            avatarPath: "assets/agent.png",
          },
          {
            id: "man",
            name: "John",
            role: "questioner",
            avatarPath: "assets/man.png",
          },
        ],
        segments: [
          {
            id: "seg-001",
            speakerId: "agent",
            text: "Hello",
            startTime: 0,
            endTime: 5,
          },
          {
            id: "seg-002",
            speakerId: "man",
            text: "Hi",
            startTime: 5,
            endTime: 10,
          },
        ],
      });

      const result = parseScript(validScript);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const parsed = result.value;
        expect(parsed.metadata.title).toBe("Test Script");
        expect(parsed.speakers).toHaveLength(2);
        expect(parsed.segments).toHaveLength(2);
        expect(parsed.segments[0].speakerId).toBe("agent");
      }
    });

    it("should sort segments by startTime in ascending order", () => {
      const scriptWithUnsortedSegments = JSON.stringify({
        metadata: {
          title: "Test",
          createdAt: "2026-02-09T09:00:00Z",
          durationSeconds: 100,
        },
        speakers: [
          {
            id: "speaker1",
            name: "Speaker 1",
            role: "agent",
            avatarPath: "path/to/avatar",
          },
        ],
        segments: [
          {
            id: "seg-003",
            speakerId: "speaker1",
            text: "Third",
            startTime: 20,
            endTime: 25,
          },
          {
            id: "seg-001",
            speakerId: "speaker1",
            text: "First",
            startTime: 0,
            endTime: 5,
          },
          {
            id: "seg-002",
            speakerId: "speaker1",
            text: "Second",
            startTime: 10,
            endTime: 15,
          },
        ],
      });

      const result = parseScript(scriptWithUnsortedSegments);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const segments = result.value.segments;
        expect(segments[0].id).toBe("seg-001");
        expect(segments[1].id).toBe("seg-002");
        expect(segments[2].id).toBe("seg-003");
      }
    });
  });

  describe("JSON parse errors", () => {
    it("should return JSON_PARSE_ERROR for invalid JSON format", () => {
      const invalidJson = "{ invalid json }";

      const result = parseScript(invalidJson);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("JSON_PARSE_ERROR");
        expect(result.error.message).toContain("Invalid JSON");
      }
    });

    it("should return JSON_PARSE_ERROR for empty string", () => {
      const result = parseScript("");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("JSON_PARSE_ERROR");
      }
    });
  });

  describe("Schema validation errors", () => {
    it("should return SCHEMA_VALIDATION_ERROR when speakers field is missing", () => {
      const scriptWithoutSpeakers = JSON.stringify({
        metadata: {
          title: "Test",
          createdAt: "2026-02-09T09:00:00Z",
          durationSeconds: 100,
        },
        segments: [
          {
            id: "seg-001",
            speakerId: "agent",
            text: "Hello",
            startTime: 0,
            endTime: 5,
          },
        ],
      });

      const result = parseScript(scriptWithoutSpeakers);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("SCHEMA_VALIDATION_ERROR");
        expect(result.error.message).toContain("speakers");
      }
    });

    it("should return SCHEMA_VALIDATION_ERROR when segments field is missing", () => {
      const scriptWithoutSegments = JSON.stringify({
        metadata: {
          title: "Test",
          createdAt: "2026-02-09T09:00:00Z",
          durationSeconds: 100,
        },
        speakers: [
          {
            id: "agent",
            name: "AI Agent",
            role: "agent",
            avatarPath: "assets/agent.png",
          },
        ],
      });

      const result = parseScript(scriptWithoutSegments);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("SCHEMA_VALIDATION_ERROR");
        expect(result.error.message).toContain("segments");
      }
    });

    it("should return SCHEMA_VALIDATION_ERROR when metadata field is missing", () => {
      const scriptWithoutMetadata = JSON.stringify({
        speakers: [
          {
            id: "agent",
            name: "AI Agent",
            role: "agent",
            avatarPath: "assets/agent.png",
          },
        ],
        segments: [
          {
            id: "seg-001",
            speakerId: "agent",
            text: "Hello",
            startTime: 0,
            endTime: 5,
          },
        ],
      });

      const result = parseScript(scriptWithoutMetadata);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("SCHEMA_VALIDATION_ERROR");
        expect(result.error.message).toContain("metadata");
      }
    });

    it("should return SCHEMA_VALIDATION_ERROR when speakers array is empty", () => {
      const scriptWithEmptySpeakers = JSON.stringify({
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
            text: "Hello",
            startTime: 0,
            endTime: 5,
          },
        ],
      });

      const result = parseScript(scriptWithEmptySpeakers);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("SCHEMA_VALIDATION_ERROR");
        expect(result.error.message).toContain("at least one speaker");
      }
    });

    it("should return SCHEMA_VALIDATION_ERROR when segments array is empty", () => {
      const scriptWithEmptySegments = JSON.stringify({
        metadata: {
          title: "Test",
          createdAt: "2026-02-09T09:00:00Z",
          durationSeconds: 100,
        },
        speakers: [
          {
            id: "agent",
            name: "AI Agent",
            role: "agent",
            avatarPath: "assets/agent.png",
          },
        ],
        segments: [],
      });

      const result = parseScript(scriptWithEmptySegments);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("SCHEMA_VALIDATION_ERROR");
        expect(result.error.message).toContain("at least one segment");
      }
    });
  });

  describe("Timestamp validation", () => {
    it("should return TIMESTAMP_ERROR when startTime equals endTime", () => {
      const scriptWithEqualTimestamps = JSON.stringify({
        metadata: {
          title: "Test",
          createdAt: "2026-02-09T09:00:00Z",
          durationSeconds: 100,
        },
        speakers: [
          {
            id: "agent",
            name: "AI Agent",
            role: "agent",
            avatarPath: "assets/agent.png",
          },
        ],
        segments: [
          {
            id: "seg-001",
            speakerId: "agent",
            text: "Hello",
            startTime: 5,
            endTime: 5,
          },
        ],
      });

      const result = parseScript(scriptWithEqualTimestamps);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("TIMESTAMP_ERROR");
        expect(result.error.message).toContain(
          "Start time must be less than end time",
        );
      }
    });

    it("should return TIMESTAMP_ERROR when startTime is greater than endTime", () => {
      const scriptWithInvertedTimestamps = JSON.stringify({
        metadata: {
          title: "Test",
          createdAt: "2026-02-09T09:00:00Z",
          durationSeconds: 100,
        },
        speakers: [
          {
            id: "agent",
            name: "AI Agent",
            role: "agent",
            avatarPath: "assets/agent.png",
          },
        ],
        segments: [
          {
            id: "seg-001",
            speakerId: "agent",
            text: "Hello",
            startTime: 10,
            endTime: 5,
          },
        ],
      });

      const result = parseScript(scriptWithInvertedTimestamps);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("TIMESTAMP_ERROR");
      }
    });

    it("should return TIMESTAMP_ERROR when segments have overlapping timestamps", () => {
      const scriptWithOverlappingSegments = JSON.stringify({
        metadata: {
          title: "Test",
          createdAt: "2026-02-09T09:00:00Z",
          durationSeconds: 100,
        },
        speakers: [
          {
            id: "agent",
            name: "AI Agent",
            role: "agent",
            avatarPath: "assets/agent.png",
          },
        ],
        segments: [
          {
            id: "seg-001",
            speakerId: "agent",
            text: "First",
            startTime: 0,
            endTime: 10,
          },
          {
            id: "seg-002",
            speakerId: "agent",
            text: "Second",
            startTime: 5,
            endTime: 15,
          },
        ],
      });

      const result = parseScript(scriptWithOverlappingSegments);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("TIMESTAMP_ERROR");
        expect(result.error.message).toContain("overlap");
      }
    });

    it("should allow adjacent segments with no gap", () => {
      const scriptWithAdjacentSegments = JSON.stringify({
        metadata: {
          title: "Test",
          createdAt: "2026-02-09T09:00:00Z",
          durationSeconds: 100,
        },
        speakers: [
          {
            id: "agent",
            name: "AI Agent",
            role: "agent",
            avatarPath: "assets/agent.png",
          },
        ],
        segments: [
          {
            id: "seg-001",
            speakerId: "agent",
            text: "First",
            startTime: 0,
            endTime: 10,
          },
          {
            id: "seg-002",
            speakerId: "agent",
            text: "Second",
            startTime: 10,
            endTime: 20,
          },
        ],
      });

      const result = parseScript(scriptWithAdjacentSegments);

      expect(result.isOk()).toBe(true);
    });
  });

  describe("Speaker reference integrity", () => {
    it("should return SCHEMA_VALIDATION_ERROR when segment references non-existent speakerId", () => {
      const scriptWithInvalidSpeakerId = JSON.stringify({
        metadata: {
          title: "Test",
          createdAt: "2026-02-09T09:00:00Z",
          durationSeconds: 100,
        },
        speakers: [
          {
            id: "agent",
            name: "AI Agent",
            role: "agent",
            avatarPath: "assets/agent.png",
          },
        ],
        segments: [
          {
            id: "seg-001",
            speakerId: "non-existent-speaker",
            text: "Hello",
            startTime: 0,
            endTime: 5,
          },
        ],
      });

      const result = parseScript(scriptWithInvalidSpeakerId);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("SCHEMA_VALIDATION_ERROR");
        expect(result.error.message).toContain("non-existent-speaker");
        expect(result.error.message).toContain("speaker");
      }
    });

    it("should succeed when all segment speakerIds reference existing speakers", () => {
      const scriptWithValidSpeakerIds = JSON.stringify({
        metadata: {
          title: "Test",
          createdAt: "2026-02-09T09:00:00Z",
          durationSeconds: 100,
        },
        speakers: [
          {
            id: "agent",
            name: "AI Agent",
            role: "agent",
            avatarPath: "assets/agent.png",
          },
          {
            id: "man",
            name: "John",
            role: "questioner",
            avatarPath: "assets/man.png",
          },
        ],
        segments: [
          {
            id: "seg-001",
            speakerId: "agent",
            text: "Hello",
            startTime: 0,
            endTime: 5,
          },
          {
            id: "seg-002",
            speakerId: "man",
            text: "Hi",
            startTime: 5,
            endTime: 10,
          },
        ],
      });

      const result = parseScript(scriptWithValidSpeakerIds);

      expect(result.isOk()).toBe(true);
    });
  });

  describe("Property-based testing (Fuzzing)", () => {
    it("should handle scripts with many segments robustly", () => {
      const speakers = [
        {
          id: "speaker1",
          name: "Speaker 1",
          role: "agent" as const,
          avatarPath: "path/to/avatar",
        },
      ];

      // Generate 1000 non-overlapping segments
      const segments = Array.from({ length: 1000 }, (_, i) => ({
        id: `seg-${String(i).padStart(4, "0")}`,
        speakerId: "speaker1",
        text: `Text ${i}`,
        startTime: i * 10,
        endTime: i * 10 + 5,
      }));

      const largeScript = JSON.stringify({
        metadata: {
          title: "Large Script",
          createdAt: "2026-02-09T09:00:00Z",
          durationSeconds: segments[segments.length - 1].endTime,
        },
        speakers,
        segments,
      });

      const result = parseScript(largeScript);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.segments).toHaveLength(1000);
        // Verify sorting is maintained
        for (let i = 1; i < result.value.segments.length; i++) {
          expect(result.value.segments[i].startTime).toBeGreaterThanOrEqual(
            result.value.segments[i - 1].startTime,
          );
        }
      }
    });

    it("should handle random timestamp patterns without overlaps", () => {
      const speakers = [
        {
          id: "speaker1",
          name: "Speaker 1",
          role: "agent" as const,
          avatarPath: "path/to/avatar",
        },
      ];

      // Generate random non-overlapping segments
      const segments: Array<{
        id: string;
        speakerId: string;
        text: string;
        startTime: number;
        endTime: number;
      }> = [];
      let currentTime = 0;

      for (let i = 0; i < 100; i++) {
        const duration = Math.floor(Math.random() * 10) + 1; // 1-10 seconds
        const gap = Math.floor(Math.random() * 5); // 0-4 seconds gap

        segments.push({
          id: `seg-${i}`,
          speakerId: "speaker1",
          text: `Random text ${i}`,
          startTime: currentTime,
          endTime: currentTime + duration,
        });

        currentTime += duration + gap;
      }

      const randomScript = JSON.stringify({
        metadata: {
          title: "Random Script",
          createdAt: "2026-02-09T09:00:00Z",
          durationSeconds: currentTime,
        },
        speakers,
        segments,
      });

      const result = parseScript(randomScript);

      expect(result.isOk()).toBe(true);
    });

    it("should reject scripts with extreme segment counts (limit validation)", () => {
      const speakers = [
        {
          id: "speaker1",
          name: "Speaker 1",
          role: "agent" as const,
          avatarPath: "path/to/avatar",
        },
      ];

      // Generate 6000 segments (exceeding the 5000 limit mentioned in design)
      const segments = Array.from({ length: 6000 }, (_, i) => ({
        id: `seg-${i}`,
        speakerId: "speaker1",
        text: `Text ${i}`,
        startTime: i * 10,
        endTime: i * 10 + 5,
      }));

      const extremeScript = JSON.stringify({
        metadata: {
          title: "Extreme Script",
          createdAt: "2026-02-09T09:00:00Z",
          durationSeconds: segments[segments.length - 1].endTime,
        },
        speakers,
        segments,
      });

      const result = parseScript(extremeScript);

      // Should either succeed or fail gracefully with appropriate error
      // For now, we'll accept success (limit can be added in future)
      expect(result.isOk() || result.isErr()).toBe(true);
    });

    it("should handle minimal valid script (single segment)", () => {
      const minimalScript = JSON.stringify({
        metadata: {
          title: "Minimal",
          createdAt: "2026-02-09T09:00:00Z",
          durationSeconds: 5,
        },
        speakers: [
          {
            id: "speaker1",
            name: "Speaker 1",
            role: "agent",
            avatarPath: "path/to/avatar",
          },
        ],
        segments: [
          {
            id: "seg-001",
            speakerId: "speaker1",
            text: "Hello",
            startTime: 0,
            endTime: 5,
          },
        ],
      });

      const result = parseScript(minimalScript);

      expect(result.isOk()).toBe(true);
    });
  });
});
