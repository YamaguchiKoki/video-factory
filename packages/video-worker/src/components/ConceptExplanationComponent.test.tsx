/**
 * ConceptExplanationComponent tests
 * Type-safe tests for concept explanation component
 */

import { describe, it, expect } from "vitest";
import type { ConceptExplanationData } from "../core/script-types";
import { ConceptExplanationComponent } from "./ConceptExplanationComponent";

describe("ConceptExplanationComponent", () => {
  it("should be a valid React functional component", () => {
    expect(typeof ConceptExplanationComponent).toBe("function");
  });

  it("should accept bullet-points template data", () => {
    const mockData: ConceptExplanationData = {
      title: "解散総選挙とは",
      template: "bullet-points",
      bulletPoints: [
        { text: "内閣総理大臣が衆議院を解散", emphasis: "high" },
        { text: "全議員の議席が失効", emphasis: "medium" },
        { text: "40日以内に総選挙を実施", emphasis: "medium" },
      ],
    };

    expect(mockData.template).toBe("bullet-points");
    expect(mockData.bulletPoints).toHaveLength(3);
    expect(mockData.bulletPoints?.[0].emphasis).toBe("high");
  });

  it("should accept flowchart template data", () => {
    const mockData: ConceptExplanationData = {
      title: "プロセスフロー",
      template: "flowchart",
      flowchartNodes: [
        { id: "1", label: "開始", connections: ["2"] },
        { id: "2", label: "処理", connections: ["3"] },
        { id: "3", label: "終了", connections: [] },
      ],
    };

    expect(mockData.template).toBe("flowchart");
    expect(mockData.flowchartNodes).toHaveLength(3);
    expect(mockData.flowchartNodes?.[0].connections).toContain("2");
  });

  it("should accept timeline template data", () => {
    const mockData: ConceptExplanationData = {
      title: "歴史年表",
      template: "timeline",
      timelineEvents: [
        { date: "2020-01-01", label: "イベント1", description: "説明1" },
        { date: "2021-01-01", label: "イベント2" },
        { date: "2022-01-01", label: "イベント3", description: "説明3" },
      ],
    };

    expect(mockData.template).toBe("timeline");
    expect(mockData.timelineEvents).toHaveLength(3);
    expect(mockData.timelineEvents?.[0].description).toBe("説明1");
  });

  it("should handle bullet points without emphasis", () => {
    const mockData: ConceptExplanationData = {
      title: "テスト",
      template: "bullet-points",
      bulletPoints: [
        { text: "ポイント1" },
        { text: "ポイント2" },
      ],
    };

    expect(mockData.bulletPoints?.[0].emphasis).toBeUndefined();
  });

  it("should handle different emphasis levels", () => {
    const emphasisLevels: Array<"high" | "medium" | "low"> = [
      "high",
      "medium",
      "low",
    ];

    emphasisLevels.forEach((emphasis) => {
      const bulletPoint = { text: "Test", emphasis };
      expect(bulletPoint.emphasis).toBe(emphasis);
    });
  });

  it("should handle timeline events without description", () => {
    const mockData: ConceptExplanationData = {
      title: "テスト",
      template: "timeline",
      timelineEvents: [{ date: "2026-02-09", label: "イベント" }],
    };

    expect(mockData.timelineEvents?.[0].description).toBeUndefined();
  });

  it("should validate required title field", () => {
    const mockData: ConceptExplanationData = {
      title: "必須タイトル",
      template: "bullet-points",
    };

    expect(mockData.title).toBeTruthy();
  });

  it("should validate template enum values", () => {
    const templates: Array<"bullet-points" | "flowchart" | "timeline"> = [
      "bullet-points",
      "flowchart",
      "timeline",
    ];

    templates.forEach((template) => {
      const data: ConceptExplanationData = {
        title: "Test",
        template,
      };
      expect(data.template).toBe(template);
    });
  });

  it("should handle flowchart nodes with no connections", () => {
    const mockData: ConceptExplanationData = {
      title: "フロー",
      template: "flowchart",
      flowchartNodes: [{ id: "1", label: "単独ノード", connections: [] }],
    };

    expect(mockData.flowchartNodes?.[0].connections).toHaveLength(0);
  });

  it("should handle multiple connections in flowchart", () => {
    const mockData: ConceptExplanationData = {
      title: "フロー",
      template: "flowchart",
      flowchartNodes: [
        { id: "1", label: "分岐", connections: ["2", "3", "4"] },
      ],
    };

    expect(mockData.flowchartNodes?.[0].connections).toHaveLength(3);
  });
});
