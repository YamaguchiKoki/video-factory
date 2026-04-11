// Tests for infrastructure/s3.ts
//
// Design contract:
//   downloadScriptFromS3(bucket, key): Effect<Script, S3GetObjectError>
//     — returns parsed Script on success
//     — fails with S3GetObjectError when S3 GetObject rejects
//     — fails with S3GetObjectError when response body is invalid JSON
//     — fails with S3GetObjectError when parsed JSON does not match ScriptSchema
//
//   uploadThumbnailToS3(bucket, key, imageData): Effect<void, S3PutObjectError>
//     — succeeds on successful upload
//     — fails with S3PutObjectError when S3 send rejects
//     — uploads with ContentType: image/png
//     — calls PutObjectCommand with the correct Bucket and Key
//
//   uploadTextToS3(bucket, key, content): Effect<void, S3PutObjectError>
//     — succeeds on successful upload
//     — fails with S3PutObjectError when S3 send rejects
//     — uploads with ContentType: application/json
//     — calls PutObjectCommand with the correct Bucket and Key

import { Effect, Result } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================
// Mock @aws-sdk/client-s3 (module-level singleton in infrastructure/s3.ts)
// ============================================

const { mockS3Send } = vi.hoisted(() => ({
  mockS3Send: vi.fn(),
}));

vi.mock("@aws-sdk/client-s3", () => ({
  // biome-ignore lint/complexity/useArrowFunction: constructor mock requires `function` for `new`
  S3Client: vi.fn(function () {
    return { send: mockS3Send };
  }),
  // biome-ignore lint/complexity/useArrowFunction: constructor mock requires `function` for `new`
  PutObjectCommand: vi.fn(function (args: unknown) {
    return args;
  }),
  // biome-ignore lint/complexity/useArrowFunction: constructor mock requires `function` for `new`
  GetObjectCommand: vi.fn(function (args: unknown) {
    return args;
  }),
}));

import {
  downloadScriptFromS3,
  uploadTextToS3,
  uploadThumbnailToS3,
} from "./s3";

// ============================================
// Test data
// ============================================

const buildValidScriptJson = () =>
  JSON.stringify({
    title: "テストラジオ 2026年4月11日号",
    newsItems: [
      { id: "news-1", title: "ニュース1" },
      { id: "news-2", title: "ニュース2" },
      { id: "news-3", title: "ニュース3" },
    ],
    sections: [
      {
        type: "intro",
        greeting: [{ speaker: "A", text: "こんにちは" }],
        newsOverview: [{ speaker: "B", text: "今日のニュース" }],
      },
      {
        type: "discussion",
        newsId: "news-1",
        blocks: [
          { phase: "summary", lines: [{ speaker: "A", text: "概要1" }] },
          { phase: "background", lines: [{ speaker: "B", text: "背景1" }] },
          { phase: "deepDive", lines: [{ speaker: "A", text: "深掘り1" }] },
        ],
      },
      {
        type: "discussion",
        newsId: "news-2",
        blocks: [
          { phase: "summary", lines: [{ speaker: "A", text: "概要2" }] },
          { phase: "background", lines: [{ speaker: "B", text: "背景2" }] },
          { phase: "deepDive", lines: [{ speaker: "A", text: "深掘り2" }] },
        ],
      },
      {
        type: "discussion",
        newsId: "news-3",
        blocks: [
          { phase: "summary", lines: [{ speaker: "A", text: "概要3" }] },
          { phase: "background", lines: [{ speaker: "B", text: "背景3" }] },
          { phase: "deepDive", lines: [{ speaker: "A", text: "深掘り3" }] },
        ],
      },
      {
        type: "outro",
        recap: [{ speaker: "A", text: "まとめ" }],
        closing: [{ speaker: "B", text: "さようなら" }],
      },
    ],
  });

const buildMockS3Response = (body: string) => ({
  Body: {
    transformToString: vi.fn().mockResolvedValue(body),
  },
});

// ============================================
// downloadScriptFromS3
// ============================================

describe("downloadScriptFromS3", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return parsed Script on success", async () => {
    // Given
    mockS3Send.mockResolvedValueOnce(
      buildMockS3Response(buildValidScriptJson()),
    );

    // When
    const result = await Effect.runPromise(
      Effect.result(
        downloadScriptFromS3("video-factory", "script-generator/script.json"),
      ),
    );

    // Then
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(result.success.title).toBe("テストラジオ 2026年4月11日号");
      expect(result.success.newsItems).toHaveLength(3);
    }
  });

  it("should fail with S3GetObjectError when S3 GetObject rejects", async () => {
    // Given
    mockS3Send.mockRejectedValueOnce(new Error("NoSuchKey"));

    // When
    const result = await Effect.runPromise(
      Effect.result(
        downloadScriptFromS3("video-factory", "script-generator/script.json"),
      ),
    );

    // Then
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("S3GetObjectError");
      expect(result.failure.message).toContain("NoSuchKey");
    }
  });

  it("should fail with S3GetObjectError when response body is invalid JSON", async () => {
    // Given
    mockS3Send.mockResolvedValueOnce(buildMockS3Response("not-valid-json{{{"));

    // When
    const result = await Effect.runPromise(
      Effect.result(
        downloadScriptFromS3("video-factory", "script-generator/script.json"),
      ),
    );

    // Then
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("S3GetObjectError");
    }
  });

  it("should fail with S3GetObjectError when parsed JSON does not match ScriptSchema", async () => {
    // Given
    mockS3Send.mockResolvedValueOnce(
      buildMockS3Response(JSON.stringify({ invalid: true })),
    );

    // When
    const result = await Effect.runPromise(
      Effect.result(
        downloadScriptFromS3("video-factory", "script-generator/script.json"),
      ),
    );

    // Then
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("S3GetObjectError");
    }
  });

  it("should call GetObjectCommand with correct Bucket and Key", async () => {
    // Given
    mockS3Send.mockResolvedValueOnce(
      buildMockS3Response(buildValidScriptJson()),
    );

    // When
    await Effect.runPromise(
      downloadScriptFromS3("my-bucket", "scripts/test.json"),
    );

    // Then
    expect(mockS3Send).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: "my-bucket",
        Key: "scripts/test.json",
      }),
    );
  });
});

// ============================================
// uploadThumbnailToS3
// ============================================

describe("uploadThumbnailToS3", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should succeed on successful upload", async () => {
    // Given
    mockS3Send.mockResolvedValueOnce({});
    const imageData = Buffer.from("fake-image-data");

    // When
    const result = await Effect.runPromise(
      Effect.result(
        uploadThumbnailToS3(
          "video-factory",
          "metadata-generator/thumbnail.png",
          imageData,
        ),
      ),
    );

    // Then
    expect(Result.isSuccess(result)).toBe(true);
  });

  it("should fail with S3PutObjectError when S3 send rejects", async () => {
    // Given
    mockS3Send.mockRejectedValueOnce(new Error("AccessDenied"));
    const imageData = Buffer.from("fake-image-data");

    // When
    const result = await Effect.runPromise(
      Effect.result(
        uploadThumbnailToS3(
          "video-factory",
          "metadata-generator/thumbnail.png",
          imageData,
        ),
      ),
    );

    // Then
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("S3PutObjectError");
      expect(result.failure.message).toContain("AccessDenied");
    }
  });

  it("should upload with ContentType: image/png", async () => {
    // Given
    mockS3Send.mockResolvedValueOnce({});
    const imageData = Buffer.from("fake-image-data");

    // When
    await Effect.runPromise(
      uploadThumbnailToS3(
        "video-factory",
        "metadata-generator/thumbnail.png",
        imageData,
      ),
    );

    // Then
    expect(mockS3Send).toHaveBeenCalledWith(
      expect.objectContaining({ ContentType: "image/png" }),
    );
  });

  it("should call PutObjectCommand with the correct Bucket and Key", async () => {
    // Given
    mockS3Send.mockResolvedValueOnce({});
    const imageData = Buffer.from("fake-image-data");

    // When
    await Effect.runPromise(
      uploadThumbnailToS3("my-bucket", "thumbnails/test.png", imageData),
    );

    // Then
    expect(mockS3Send).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: "my-bucket",
        Key: "thumbnails/test.png",
      }),
    );
  });
});

// ============================================
// uploadTextToS3
// ============================================

describe("uploadTextToS3", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should succeed on successful upload", async () => {
    // Given
    mockS3Send.mockResolvedValueOnce({});
    const content = JSON.stringify({ text: "テスト概要" });

    // When
    const result = await Effect.runPromise(
      Effect.result(
        uploadTextToS3(
          "video-factory",
          "metadata-generator/description.json",
          content,
        ),
      ),
    );

    // Then
    expect(Result.isSuccess(result)).toBe(true);
  });

  it("should fail with S3PutObjectError when S3 send rejects", async () => {
    // Given
    mockS3Send.mockRejectedValueOnce(new Error("InternalError"));
    const content = JSON.stringify({ text: "テスト概要" });

    // When
    const result = await Effect.runPromise(
      Effect.result(
        uploadTextToS3(
          "video-factory",
          "metadata-generator/description.json",
          content,
        ),
      ),
    );

    // Then
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("S3PutObjectError");
      expect(result.failure.message).toContain("InternalError");
    }
  });

  it("should upload with ContentType: application/json", async () => {
    // Given
    mockS3Send.mockResolvedValueOnce({});
    const content = JSON.stringify({ text: "テスト概要" });

    // When
    await Effect.runPromise(
      uploadTextToS3(
        "video-factory",
        "metadata-generator/description.json",
        content,
      ),
    );

    // Then
    expect(mockS3Send).toHaveBeenCalledWith(
      expect.objectContaining({ ContentType: "application/json" }),
    );
  });

  it("should call PutObjectCommand with the correct Bucket and Key", async () => {
    // Given
    mockS3Send.mockResolvedValueOnce({});
    const content = JSON.stringify({ text: "テストコメント" });

    // When
    await Effect.runPromise(
      uploadTextToS3("my-bucket", "metadata/comment.json", content),
    );

    // Then
    expect(mockS3Send).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: "my-bucket",
        Key: "metadata/comment.json",
      }),
    );
  });
});
