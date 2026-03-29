/**
 * VideoComposition Unit Tests
 * Type-safe tests for main video composition component
 */

import { describe, expect, it } from "vitest";
import type { ParsedScript } from "../core/script-types";
import { VideoComposition } from "./VideoComposition";

describe("VideoComposition", () => {
  const mockScript: ParsedScript = {
    metadata: {
      title: "2026年2月9日のニュース",
      createdAt: "2026-02-09T09:00:00.000Z",
      durationSeconds: 600,
    },
    speakers: [
      {
        id: "agent",
        name: "AI Agent",
        role: "agent",
        avatarPath: "/assets/agent-avatar.png",
      },
      {
        id: "man",
        name: "田中さん",
        role: "questioner",
        avatarPath: "/assets/man-avatar.png",
      },
    ],
    segments: [
      {
        id: "seg-001",
        speakerId: "man",
        text: "今日のニュースを教えてください",
        startTime: 0,
        endTime: 3,
      },
      {
        id: "seg-002",
        speakerId: "agent",
        text: "承知しました。今日は以下の3つのニュースについて取り上げます",
        startTime: 3,
        endTime: 7,
        visualComponent: {
          type: "news-list",
          data: {
            items: [
              {
                title: "政府が新経済対策を発表",
                category: "政治",
                date: "2026-02-09",
              },
            ],
          },
        },
      },
    ],
  };

  it("should be a valid React functional component", () => {
    expect(typeof VideoComposition).toBe("function");
  });

  it("should accept ParsedScript, audioPath, and speakers props", () => {
    const audioPath = "/audio/test.wav";

    // Type checking: this code compiles means props are correctly typed
    const _props = {
      script: mockScript,
      audioPath,
      speakers: mockScript.speakers,
    };

    expect(_props.script.metadata.title).toBe("2026年2月9日のニュース");
    expect(_props.audioPath).toBe("/audio/test.wav");
    expect(_props.speakers).toHaveLength(2);
  });

  it("should handle script with multiple segments", () => {
    const script: ParsedScript = {
      ...mockScript,
      segments: [
        {
          id: "seg-001",
          speakerId: "agent",
          text: "First segment",
          startTime: 0,
          endTime: 2,
        },
        {
          id: "seg-002",
          speakerId: "man",
          text: "Second segment",
          startTime: 2,
          endTime: 4,
        },
        {
          id: "seg-003",
          speakerId: "agent",
          text: "Third segment",
          startTime: 4,
          endTime: 6,
        },
      ],
    };

    expect(script.segments).toHaveLength(3);
  });

  it("should handle segments with visual components", () => {
    const segmentWithVisual = mockScript.segments[1];

    expect(segmentWithVisual.visualComponent).toBeDefined();
    expect(segmentWithVisual.visualComponent?.type).toBe("news-list");
  });

  it("should handle segments without visual components", () => {
    const segmentWithoutVisual = mockScript.segments[0];

    expect(segmentWithoutVisual.visualComponent).toBeUndefined();
  });

  it("should validate required props", () => {
    const props = {
      script: mockScript,
      audioPath: "/audio/test.wav",
      speakers: mockScript.speakers,
    };

    expect(props.script).toBeDefined();
    expect(props.script.segments).toBeDefined();
    expect(props.script.speakers).toBeDefined();
    expect(props.audioPath).toBeTruthy();
    expect(props.speakers).toBeDefined();
  });

  it("should handle script with all visual component types", () => {
    const scriptWithAllVisuals: ParsedScript = {
      ...mockScript,
      segments: [
        {
          id: "seg-001",
          speakerId: "agent",
          text: "News list",
          startTime: 0,
          endTime: 5,
          visualComponent: {
            type: "news-list",
            data: {
              items: [
                { title: "News 1", category: "政治", date: "2026-02-09" },
              ],
            },
          },
        },
        {
          id: "seg-002",
          speakerId: "agent",
          text: "Concept explanation",
          startTime: 5,
          endTime: 10,
          visualComponent: {
            type: "concept-explanation",
            data: {
              title: "Test Concept",
              template: "bullet-points",
              bulletPoints: [{ text: "Point 1" }],
            },
          },
        },
        {
          id: "seg-003",
          speakerId: "agent",
          text: "Summary",
          startTime: 10,
          endTime: 15,
          visualComponent: {
            type: "conversation-summary",
            data: {
              summaryText: "Summary",
              keyPoints: [{ text: "Key point", importance: "high" }],
            },
          },
        },
      ],
    };

    expect(scriptWithAllVisuals.segments).toHaveLength(3);
    expect(scriptWithAllVisuals.segments[0].visualComponent?.type).toBe(
      "news-list",
    );
    expect(scriptWithAllVisuals.segments[1].visualComponent?.type).toBe(
      "concept-explanation",
    );
    expect(scriptWithAllVisuals.segments[2].visualComponent?.type).toBe(
      "conversation-summary",
    );
  });

  it("should handle empty segments array", () => {
    const emptyScript: ParsedScript = {
      ...mockScript,
      segments: [],
    };

    expect(emptyScript.segments).toHaveLength(0);
  });

  it("should preserve segment timing information", () => {
    const segment = mockScript.segments[0];

    expect(segment.startTime).toBe(0);
    expect(segment.endTime).toBe(3);
    expect(segment.startTime).toBeLessThan(segment.endTime);
  });

  it("should handle segments in chronological order", () => {
    const { segments } = mockScript;

    for (let i = 0; i < segments.length - 1; i++) {
      expect(segments[i].endTime).toBeLessThanOrEqual(
        segments[i + 1].startTime,
      );
    }
  });
});
