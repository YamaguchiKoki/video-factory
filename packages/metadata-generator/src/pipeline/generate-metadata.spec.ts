// Tests for pipeline/generate-metadata.ts
//
// Design contract:
//   generateMetadata(script, mastra): Effect<MetadataOutput, GenerationError>
//     — generates all 3 metadata artifacts (thumbnail, description, comment)
//     — returns combined MetadataOutput on success
//     — fails if thumbnail generation fails
//     — fails if description generation fails
//     — fails if comment generation fails
//     — executes all 3 generators in parallel (via Effect.all)

import type { Mastra } from "@mastra/core/mastra";
import { Effect, Result } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Script } from "../schema";

// ============================================
// Mock generators
// ============================================

const { mockGenerateThumbnail } = vi.hoisted(() => ({
  mockGenerateThumbnail: vi.fn(),
}));

vi.mock("../generators/thumbnail", () => ({
  generateThumbnail: mockGenerateThumbnail,
}));

const { mockGenerateDescription } = vi.hoisted(() => ({
  mockGenerateDescription: vi.fn(),
}));

vi.mock("../generators/description", () => ({
  generateDescription: mockGenerateDescription,
  DESCRIPTION_AGENT_ID: "description-agent",
}));

const { mockGenerateComment } = vi.hoisted(() => ({
  mockGenerateComment: vi.fn(),
}));

vi.mock("../generators/comment", () => ({
  generateComment: mockGenerateComment,
  COMMENT_AGENT_ID: "comment-agent",
}));

import { generateMetadata } from "./generate-metadata";

// ============================================
// Test data
// ============================================

const FAKE_THUMBNAIL = {
  imageBase64: "iVBORw0KGgoAAAANSUhEUg",
  contentType: "image/png" as const,
};

const FAKE_DESCRIPTION = {
  text: "今日のニュースラジオの概要です。",
};

const FAKE_COMMENT = {
  text: "コメント欄をご覧いただきありがとうございます。",
};

const buildValidScript = (): Script =>
  ({
    title: "テストラジオ 2026年4月11日号",
    newsItems: [
      { id: "news-1", title: "ニュース1" },
      { id: "news-2", title: "ニュース2" },
      { id: "news-3", title: "ニュース3" },
    ],
    sections: [],
  }) as unknown as Script;

const buildMockMastra = (): Mastra =>
  ({
    getAgent: vi.fn().mockReturnValue({
      generate: vi.fn().mockResolvedValue({ object: {} }),
    }),
  }) as unknown as Mastra;

// ============================================
// Tests
// ============================================

describe("generateMetadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return combined MetadataOutput on success", async () => {
    // Given
    mockGenerateThumbnail.mockReturnValue(Effect.succeed(FAKE_THUMBNAIL));
    mockGenerateDescription.mockReturnValue(Effect.succeed(FAKE_DESCRIPTION));
    mockGenerateComment.mockReturnValue(Effect.succeed(FAKE_COMMENT));
    const script = buildValidScript();
    const mastra = buildMockMastra();

    // When
    const result = await Effect.runPromise(
      Effect.result(generateMetadata(script, mastra)),
    );

    // Then
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(result.success.thumbnail).toEqual(FAKE_THUMBNAIL);
      expect(result.success.description).toEqual(FAKE_DESCRIPTION);
      expect(result.success.comment).toEqual(FAKE_COMMENT);
    }
  });

  it("should fail if thumbnail generation fails", async () => {
    // Given
    mockGenerateThumbnail.mockReturnValue(
      Effect.fail({
        _tag: "ThumbnailGenerationError",
        message: "Image model unavailable",
      }),
    );
    mockGenerateDescription.mockReturnValue(Effect.succeed(FAKE_DESCRIPTION));
    mockGenerateComment.mockReturnValue(Effect.succeed(FAKE_COMMENT));
    const script = buildValidScript();
    const mastra = buildMockMastra();

    // When
    const result = await Effect.runPromise(
      Effect.result(generateMetadata(script, mastra)),
    );

    // Then
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("ThumbnailGenerationError");
    }
  });

  it("should fail if description generation fails", async () => {
    // Given
    mockGenerateThumbnail.mockReturnValue(Effect.succeed(FAKE_THUMBNAIL));
    mockGenerateDescription.mockReturnValue(
      Effect.fail({
        _tag: "DescriptionGenerationError",
        message: "Agent error",
      }),
    );
    mockGenerateComment.mockReturnValue(Effect.succeed(FAKE_COMMENT));
    const script = buildValidScript();
    const mastra = buildMockMastra();

    // When
    const result = await Effect.runPromise(
      Effect.result(generateMetadata(script, mastra)),
    );

    // Then
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("DescriptionGenerationError");
    }
  });

  it("should fail if comment generation fails", async () => {
    // Given
    mockGenerateThumbnail.mockReturnValue(Effect.succeed(FAKE_THUMBNAIL));
    mockGenerateDescription.mockReturnValue(Effect.succeed(FAKE_DESCRIPTION));
    mockGenerateComment.mockReturnValue(
      Effect.fail({
        _tag: "CommentGenerationError",
        message: "Agent timeout",
      }),
    );
    const script = buildValidScript();
    const mastra = buildMockMastra();

    // When
    const result = await Effect.runPromise(
      Effect.result(generateMetadata(script, mastra)),
    );

    // Then
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("CommentGenerationError");
    }
  });

  it("should call all 3 generators with the same script", async () => {
    // Given
    mockGenerateThumbnail.mockReturnValue(Effect.succeed(FAKE_THUMBNAIL));
    mockGenerateDescription.mockReturnValue(Effect.succeed(FAKE_DESCRIPTION));
    mockGenerateComment.mockReturnValue(Effect.succeed(FAKE_COMMENT));
    const script = buildValidScript();
    const mastra = buildMockMastra();

    // When
    await Effect.runPromise(generateMetadata(script, mastra));

    // Then
    expect(mockGenerateThumbnail).toHaveBeenCalledWith(script);
    expect(mockGenerateDescription).toHaveBeenCalledWith(script, mastra);
    expect(mockGenerateComment).toHaveBeenCalledWith(script, mastra);
  });
});
