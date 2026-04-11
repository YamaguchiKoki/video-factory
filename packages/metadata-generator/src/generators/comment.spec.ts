// Tests for generators/comment.ts
//
// Design contract:
//   COMMENT_AGENT_ID: "comment-agent"
//
//   generateComment(script: Script, mastra: Mastra): Effect<CommentResult, CommentGenerationError>
//     — calls getAgent with COMMENT_AGENT_ID
//     — passes script title and news titles to agent prompt
//
// Orchestration tests (success, agent-not-found, generate-failure, safeParse-failure)
// are covered in create-text-generator.spec.ts.

import type { Mastra } from "@mastra/core/mastra";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import type { Script } from "../schema";
import { COMMENT_AGENT_ID, generateComment } from "./comment";

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

const VALID_COMMENT = {
  text: "ご視聴ありがとうございます！今日のニュースで気になったものがあればコメントで教えてください。",
};

// ============================================
// Tests
// ============================================

describe("COMMENT_AGENT_ID", () => {
  it("should be 'comment-agent'", () => {
    expect(COMMENT_AGENT_ID).toBe("comment-agent");
  });
});

describe("generateComment", () => {
  it("should call getAgent with COMMENT_AGENT_ID", async () => {
    // Given
    const mockAgent = {
      generate: vi.fn().mockResolvedValue({ object: VALID_COMMENT }),
    };
    const mockMastra = {
      getAgent: vi.fn().mockReturnValue(mockAgent),
    } as unknown as Mastra;
    const script = buildValidScript();

    // When
    await Effect.runPromise(generateComment(script, mockMastra));

    // Then
    expect(mockMastra.getAgent).toHaveBeenCalledWith(COMMENT_AGENT_ID);
  });

  it("should pass script title and news titles to agent prompt", async () => {
    // Given
    const mockAgent = {
      generate: vi.fn().mockResolvedValue({ object: VALID_COMMENT }),
    };
    const mockMastra = {
      getAgent: vi.fn().mockReturnValue(mockAgent),
    } as unknown as Mastra;
    const script = buildValidScript();

    // When
    await Effect.runPromise(generateComment(script, mockMastra));

    // Then
    const [[promptArg]] = (mockAgent.generate as ReturnType<typeof vi.fn>).mock
      .calls as [[string, unknown]];
    expect(promptArg).toContain(script.title);
    for (const newsItem of script.newsItems) {
      expect(promptArg).toContain(newsItem.title);
    }
  });
});
