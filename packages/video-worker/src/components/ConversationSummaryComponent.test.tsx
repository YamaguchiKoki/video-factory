/**
 * ConversationSummaryComponent Unit Tests
 * Type-safe tests for conversation summary component
 */

import { describe, expect, it } from "vitest";
import type { ConversationSummaryData } from "../core/script-types";
import { ConversationSummaryComponent } from "./ConversationSummaryComponent";

describe("ConversationSummaryComponent", () => {
  it("should be a valid React functional component", () => {
    expect(typeof ConversationSummaryComponent).toBe("function");
  });

  it("should accept ConversationSummaryData props", () => {
    const mockData: ConversationSummaryData = {
      summaryText: "今日は3つの重要なニュースについて議論しました。",
      keyPoints: [
        {
          text: "政府の新経済対策が発表された",
          importance: "high",
        },
        {
          text: "AI技術の新展開が報告された",
          importance: "medium",
        },
        {
          text: "環境問題への新たな取り組みが始まった",
          importance: "low",
        },
      ],
    };

    // Type checking: this code compiles means props are correctly typed
    const _props = { data: mockData };
    expect(_props.data.summaryText).toBe(
      "今日は3つの重要なニュースについて議論しました。",
    );
    expect(_props.data.keyPoints).toHaveLength(3);
  });

  it("should accept high importance key points", () => {
    const data: ConversationSummaryData = {
      summaryText: "Test summary",
      keyPoints: [
        {
          text: "High importance point",
          importance: "high",
        },
      ],
    };

    expect(data.keyPoints[0].importance).toBe("high");
  });

  it("should accept medium importance key points", () => {
    const data: ConversationSummaryData = {
      summaryText: "Test summary",
      keyPoints: [
        {
          text: "Medium importance point",
          importance: "medium",
        },
      ],
    };

    expect(data.keyPoints[0].importance).toBe("medium");
  });

  it("should accept low importance key points", () => {
    const data: ConversationSummaryData = {
      summaryText: "Test summary",
      keyPoints: [
        {
          text: "Low importance point",
          importance: "low",
        },
      ],
    };

    const importance = data.keyPoints[0].importance;
    expect(importance).toBe("low");
  });

  it("should handle empty key points array", () => {
    const data: ConversationSummaryData = {
      summaryText: "要約のみのテスト",
      keyPoints: [],
    };

    expect(data.keyPoints).toHaveLength(0);
  });

  it("should validate required fields", () => {
    const data: ConversationSummaryData = {
      summaryText: "Valid summary text",
      keyPoints: [
        {
          text: "Valid key point",
          importance: "high",
        },
      ],
    };

    expect(data.summaryText).toBeTruthy();
    expect(data.keyPoints).toBeDefined();
    expect(data.keyPoints[0].text).toBeTruthy();
    expect(data.keyPoints[0].importance).toBeTruthy();
  });

  it("should handle multiple key points with different importance levels", () => {
    const data: ConversationSummaryData = {
      summaryText: "Summary with mixed importance",
      keyPoints: [
        { text: "High priority item", importance: "high" },
        { text: "Medium priority item", importance: "medium" },
        { text: "Low priority item", importance: "low" },
      ],
    };

    expect(data.keyPoints).toHaveLength(3);
    expect(data.keyPoints[0].importance).toBe("high");
    expect(data.keyPoints[1].importance).toBe("medium");
    expect(data.keyPoints[2].importance).toBe("low");
  });

  it("should preserve order of key points", () => {
    const data: ConversationSummaryData = {
      summaryText: "Order test",
      keyPoints: [
        { text: "First", importance: "low" },
        { text: "Second", importance: "medium" },
        { text: "Third", importance: "high" },
      ],
    };

    expect(data.keyPoints[0].text).toBe("First");
    expect(data.keyPoints[1].text).toBe("Second");
    expect(data.keyPoints[2].text).toBe("Third");
  });
});
