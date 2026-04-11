// Tests for generators/description.ts
//
// Design contract:
//   DESCRIPTION_AGENT_ID: "description-agent"
//
//   generateDescription(script: Script, mastra: Mastra): Effect<DescriptionResult, DescriptionGenerationError>
//     — calls getAgent with DESCRIPTION_AGENT_ID
//     — passes script title, news titles, and source URLs (when present) to agent prompt
//     — uses structuredOutput with DescriptionResultSchema
//
// Orchestration tests (success, agent-not-found, generate-failure, safeParse-failure)
// are covered in create-text-generator.spec.ts.

import type { Mastra } from "@mastra/core/mastra";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import type { Script } from "../schema";
import { DESCRIPTION_AGENT_ID, generateDescription } from "./description";

// ============================================
// Test data
// ============================================

const buildValidScript = (): Script =>
  ({
    title: "テストラジオ 2026年4月11日号",
    newsItems: [
      { id: "news-1", title: "AI技術の進化" },
      { id: "news-2", title: "経済政策の転換" },
      { id: "news-3", title: "宇宙開発の新展開" },
    ],
    sections: [],
  }) as unknown as Script;

const buildScriptWithSourceUrls = (): Script =>
  ({
    title: "テストラジオ 2026年4月11日号",
    newsItems: [
      {
        id: "news-1",
        title: "AI技術の進化",
        sourceUrl: "https://example.com/ai",
      },
      {
        id: "news-2",
        title: "経済政策の転換",
        sourceUrl: "https://example.com/econ",
      },
      { id: "news-3", title: "宇宙開発の新展開" },
    ],
    sections: [],
  }) as unknown as Script;

const VALID_DESCRIPTION = {
  text: "今日のニュースラジオでは、AI技術の進化、経済政策の転換、宇宙開発の新展開について取り上げます。",
};

// ============================================
// Tests
// ============================================

describe("DESCRIPTION_AGENT_ID", () => {
  it("should be 'description-agent'", () => {
    expect(DESCRIPTION_AGENT_ID).toBe("description-agent");
  });
});

describe("generateDescription", () => {
  it("should call getAgent with DESCRIPTION_AGENT_ID", async () => {
    // Given
    const mockAgent = {
      generate: vi.fn().mockResolvedValue({ object: VALID_DESCRIPTION }),
    };
    const mockMastra = {
      getAgent: vi.fn().mockReturnValue(mockAgent),
    } as unknown as Mastra;
    const script = buildValidScript();

    // When
    await Effect.runPromise(generateDescription(script, mockMastra));

    // Then
    expect(mockMastra.getAgent).toHaveBeenCalledWith(DESCRIPTION_AGENT_ID);
  });

  it("should pass script title and news titles to agent prompt", async () => {
    // Given
    const mockAgent = {
      generate: vi.fn().mockResolvedValue({ object: VALID_DESCRIPTION }),
    };
    const mockMastra = {
      getAgent: vi.fn().mockReturnValue(mockAgent),
    } as unknown as Mastra;
    const script = buildValidScript();

    // When
    await Effect.runPromise(generateDescription(script, mockMastra));

    // Then
    const [[promptArg]] = (mockAgent.generate as ReturnType<typeof vi.fn>).mock
      .calls as [[string, unknown]];
    expect(promptArg).toContain(script.title);
    for (const newsItem of script.newsItems) {
      expect(promptArg).toContain(newsItem.title);
    }
  });

  it("should include sourceUrl in prompt when present", async () => {
    // Given
    const mockAgent = {
      generate: vi.fn().mockResolvedValue({ object: VALID_DESCRIPTION }),
    };
    const mockMastra = {
      getAgent: vi.fn().mockReturnValue(mockAgent),
    } as unknown as Mastra;
    const script = buildScriptWithSourceUrls();

    // When
    await Effect.runPromise(generateDescription(script, mockMastra));

    // Then
    const [[promptArg]] = (mockAgent.generate as ReturnType<typeof vi.fn>).mock
      .calls as [[string, unknown]];
    expect(promptArg).toContain("https://example.com/ai");
    expect(promptArg).toContain("https://example.com/econ");
  });

  it("should gracefully omit sourceUrl when absent", async () => {
    // Given
    const mockAgent = {
      generate: vi.fn().mockResolvedValue({ object: VALID_DESCRIPTION }),
    };
    const mockMastra = {
      getAgent: vi.fn().mockReturnValue(mockAgent),
    } as unknown as Mastra;
    const script = buildValidScript();

    // When
    await Effect.runPromise(generateDescription(script, mockMastra));

    // Then
    const [[promptArg]] = (mockAgent.generate as ReturnType<typeof vi.fn>).mock
      .calls as [[string, unknown]];
    expect(promptArg).not.toContain("出典:");
  });

  it("should use structuredOutput with DescriptionResultSchema", async () => {
    // Given
    const mockAgent = {
      generate: vi.fn().mockResolvedValue({ object: VALID_DESCRIPTION }),
    };
    const mockMastra = {
      getAgent: vi.fn().mockReturnValue(mockAgent),
    } as unknown as Mastra;
    const script = buildValidScript();

    // When
    await Effect.runPromise(generateDescription(script, mockMastra));

    // Then
    const [[, options]] = (mockAgent.generate as ReturnType<typeof vi.fn>).mock
      .calls as [[string, { structuredOutput: { schema: unknown } }]];
    expect(options.structuredOutput).toBeDefined();
    expect(options.structuredOutput.schema).toBeDefined();
  });
});
