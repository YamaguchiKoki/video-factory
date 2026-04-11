// Tests for generators/thumbnail.ts
//
// Design contract:
//   generateThumbnail(script: Script): Effect<ThumbnailResult, ThumbnailGenerationError>
//     — returns ThumbnailResult with imageBase64 and contentType on success
//     — fails with ThumbnailGenerationError when image generation fails
//     — passes script title to the image generation prompt
//     — uses bedrock image model (amazon.nova-canvas-v1:0)

import { Effect, Result } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Script } from "../schema";

// ============================================
// Mock ai module (generateImage)
// ============================================

const { mockGenerateImage } = vi.hoisted(() => ({
  mockGenerateImage: vi.fn(),
}));

vi.mock("ai", () => ({
  generateImage: mockGenerateImage,
}));

// ============================================
// Mock shared/bedrock (image model)
// ============================================

const { mockImageModel } = vi.hoisted(() => ({
  mockImageModel: vi.fn().mockReturnValue("mock-image-model"),
}));

vi.mock("../shared/bedrock", () => ({
  bedrock: {
    imageModel: mockImageModel,
  },
}));

import { generateThumbnail } from "./thumbnail";

// ============================================
// Test data
// ============================================

const FAKE_IMAGE_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk";

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

// ============================================
// Tests
// ============================================

describe("generateThumbnail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return ThumbnailResult on successful image generation", async () => {
    // Given
    mockGenerateImage.mockResolvedValueOnce({
      images: [{ base64: FAKE_IMAGE_BASE64 }],
    });
    const script = buildValidScript();

    // When
    const result = await Effect.runPromise(
      Effect.result(generateThumbnail(script)),
    );

    // Then
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(result.success.imageBase64).toBe(FAKE_IMAGE_BASE64);
      expect(result.success.contentType).toBe("image/png");
    }
  });

  it("should fail with ThumbnailGenerationError when image generation fails", async () => {
    // Given
    mockGenerateImage.mockRejectedValueOnce(new Error("Bedrock timeout"));
    const script = buildValidScript();

    // When
    const result = await Effect.runPromise(
      Effect.result(generateThumbnail(script)),
    );

    // Then
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("ThumbnailGenerationError");
      expect(result.failure.message).toContain("Bedrock timeout");
    }
  });

  it("should pass script title to image generation prompt", async () => {
    // Given
    mockGenerateImage.mockResolvedValueOnce({
      images: [{ base64: FAKE_IMAGE_BASE64 }],
    });
    const script = buildValidScript();

    // When
    await Effect.runPromise(generateThumbnail(script));

    // Then
    const callArgs = mockGenerateImage.mock.calls[0]?.[0] as {
      prompt: string;
      [key: string]: unknown;
    };
    expect(callArgs.prompt).toContain(script.title);
  });

  it("should use bedrock image model", async () => {
    // Given
    mockGenerateImage.mockResolvedValueOnce({
      images: [{ base64: FAKE_IMAGE_BASE64 }],
    });
    const script = buildValidScript();

    // When
    await Effect.runPromise(generateThumbnail(script));

    // Then
    expect(mockImageModel).toHaveBeenCalledWith("amazon.nova-canvas-v1:0");
    const callArgs = mockGenerateImage.mock.calls[0]?.[0] as {
      model: unknown;
      [key: string]: unknown;
    };
    expect(callArgs.model).toBe("mock-image-model");
  });

  it("should fail with ThumbnailGenerationError when images array is empty", async () => {
    // Given
    mockGenerateImage.mockResolvedValueOnce({ images: [] });
    const script = buildValidScript();

    // When
    const result = await Effect.runPromise(
      Effect.result(generateThumbnail(script)),
    );

    // Then
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("ThumbnailGenerationError");
    }
  });
});
