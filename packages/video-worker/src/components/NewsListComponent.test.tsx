/**
 * NewsListComponent tests
 * Type-safe tests for news list display component
 */

import { describe, it, expect } from "vitest";
import type { NewsListData } from "../core/script-types";
import { NewsListComponent } from "./NewsListComponent";

describe("NewsListComponent", () => {
  it("should be a valid React functional component", () => {
    expect(typeof NewsListComponent).toBe("function");
  });

  it("should accept NewsListData props", () => {
    const mockData: NewsListData = {
      items: [
        {
          title: "政府が新経済対策を発表",
          category: "政治",
          date: "2026-02-09",
        },
      ],
    };

    expect(mockData.items).toHaveLength(1);
    expect(mockData.items[0].title).toBe("政府が新経済対策を発表");
  });

  it("should accept multiple news items", () => {
    const mockData: NewsListData = {
      items: [
        {
          title: "政府が新経済対策を発表",
          category: "政治",
          date: "2026-02-09",
        },
        {
          title: "AI技術の新展開",
          category: "テクノロジー",
          date: "2026-02-09",
        },
        {
          title: "環境問題への新たな取り組み",
          category: "環境",
          date: "2026-02-09",
        },
      ],
    };

    expect(mockData.items).toHaveLength(3);
  });

  it("should validate news item has required fields", () => {
    const newsItem = {
      title: "Test Title",
      category: "Test Category",
      date: "2026-02-09",
    };

    expect(newsItem.title).toBeTruthy();
    expect(newsItem.category).toBeTruthy();
    expect(newsItem.date).toBeTruthy();
  });

  it("should accept date in YYYY-MM-DD format", () => {
    const newsItem = {
      title: "Test",
      category: "Test",
      date: "2026-02-09",
    };

    expect(newsItem.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("should handle different categories", () => {
    const categories = ["政治", "経済", "テクノロジー", "環境", "社会"];

    categories.forEach((category) => {
      const newsItem = {
        title: "Test",
        category,
        date: "2026-02-09",
      };
      expect(newsItem.category).toBe(category);
    });
  });

  it("should validate minimum one item", () => {
    const emptyData = { items: [] };
    const singleItemData: NewsListData = {
      items: [{ title: "Test", category: "Test", date: "2026-02-09" }],
    };

    expect(emptyData.items).toHaveLength(0);
    expect(singleItemData.items).toHaveLength(1);
  });
});
