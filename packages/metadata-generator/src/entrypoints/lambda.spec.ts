// Tests for entrypoints/lambda.ts
//
// Design contract:
//   handler(event: unknown): Promise<MetadataOutput>
//     — throws when S3_BUCKET env var is missing
//     — throws when event input validation fails (missing scriptKey)
//     — throws when S3 script download fails
//     — throws when metadata generation fails
//     — throws when S3 metadata upload fails
//     — downloads script from S3, generates metadata, uploads to S3, returns result on success

import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MetadataOutput, Script } from "../schema";

// ============================================
// Mock ../infrastructure/s3 (downloadScriptFromS3 + upload functions)
// ============================================

const {
  mockDownloadScriptFromS3,
  mockUploadThumbnailToS3,
  mockUploadTextToS3,
} = vi.hoisted(() => ({
  mockDownloadScriptFromS3: vi.fn(),
  mockUploadThumbnailToS3: vi.fn(),
  mockUploadTextToS3: vi.fn(),
}));

vi.mock("../infrastructure/s3", () => ({
  downloadScriptFromS3: mockDownloadScriptFromS3,
  uploadThumbnailToS3: mockUploadThumbnailToS3,
  uploadTextToS3: mockUploadTextToS3,
}));

// ============================================
// Mock ../pipeline/generate-metadata
// ============================================

const { mockGenerateMetadata } = vi.hoisted(() => ({
  mockGenerateMetadata: vi.fn(),
}));

vi.mock("../pipeline/generate-metadata", () => ({
  generateMetadata: mockGenerateMetadata,
}));

// ============================================
// Mock ../mastra/instance-factory
// ============================================

const { mockCreateMastraInstance } = vi.hoisted(() => ({
  mockCreateMastraInstance: vi.fn().mockReturnValue({}),
}));

vi.mock("../mastra/instance-factory", () => ({
  createMastraInstance: mockCreateMastraInstance,
}));

import { handler } from "./lambda";

// ============================================
// Test data
// ============================================

const FAKE_SCRIPT: Script = {
  title: "テストラジオ",
  newsItems: [
    { id: "news-1", title: "ニュース1" },
    { id: "news-2", title: "ニュース2" },
    { id: "news-3", title: "ニュース3" },
  ],
  sections: [],
} as unknown as Script;

const FAKE_METADATA: MetadataOutput = {
  thumbnail: {
    imageBase64: "iVBORw0KGgoAAAANSUhEUg",
    contentType: "image/png",
  },
  description: { text: "概要テキスト" },
  comment: { text: "コメントテキスト" },
};

// ============================================
// Tests
// ============================================

describe("handler", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.S3_BUCKET = "test-bucket";
  });

  afterEach(() => {
    delete process.env.S3_BUCKET;
  });

  it("should throw when S3_BUCKET env var is missing", async () => {
    // Given
    delete process.env.S3_BUCKET;

    // When + Then
    await expect(
      handler({ scriptKey: "script-generator/script.json" }),
    ).rejects.toThrow("S3_BUCKET");
  });

  it("should throw when event input validation fails (missing scriptKey)", async () => {
    // When + Then
    await expect(handler({})).rejects.toThrow(/scriptKey|Invalid/i);
  });

  it("should throw when event input validation fails (empty scriptKey)", async () => {
    // When + Then
    await expect(handler({ scriptKey: "" })).rejects.toThrow();
  });

  it("should throw when S3 script download fails", async () => {
    // Given
    mockDownloadScriptFromS3.mockReturnValue(
      Effect.fail({ _tag: "S3GetObjectError", message: "NoSuchKey" }),
    );

    // When + Then
    await expect(
      handler({ scriptKey: "script-generator/script.json" }),
    ).rejects.toThrow("NoSuchKey");
  });

  it("should throw when metadata generation fails", async () => {
    // Given
    mockDownloadScriptFromS3.mockReturnValue(Effect.succeed(FAKE_SCRIPT));
    mockGenerateMetadata.mockReturnValue(
      Effect.fail({
        _tag: "ThumbnailGenerationError",
        message: "Image model error",
      }),
    );

    // When + Then
    await expect(
      handler({ scriptKey: "script-generator/script.json" }),
    ).rejects.toThrow("Image model error");
  });

  it("should throw when S3 thumbnail upload fails", async () => {
    // Given
    mockDownloadScriptFromS3.mockReturnValue(Effect.succeed(FAKE_SCRIPT));
    mockGenerateMetadata.mockReturnValue(Effect.succeed(FAKE_METADATA));
    mockUploadThumbnailToS3.mockReturnValue(
      Effect.fail({ _tag: "S3PutObjectError", message: "Upload failed" }),
    );

    // When + Then
    await expect(
      handler({ scriptKey: "script-generator/script.json" }),
    ).rejects.toThrow("Upload failed");
  });

  it("should download script, generate metadata, upload to S3, and return result on success", async () => {
    // Given
    mockDownloadScriptFromS3.mockReturnValue(Effect.succeed(FAKE_SCRIPT));
    mockGenerateMetadata.mockReturnValue(Effect.succeed(FAKE_METADATA));
    mockUploadThumbnailToS3.mockReturnValue(Effect.succeed(undefined));
    mockUploadTextToS3.mockReturnValue(Effect.succeed(undefined));

    // When
    const result = await handler({
      scriptKey: "script-generator/script.json",
    });

    // Then
    expect(mockDownloadScriptFromS3).toHaveBeenCalledWith(
      "test-bucket",
      "script-generator/script.json",
    );
    expect(mockGenerateMetadata).toHaveBeenCalled();
    expect(mockUploadThumbnailToS3).toHaveBeenCalledWith(
      "test-bucket",
      expect.stringContaining("thumbnail"),
      expect.any(Buffer),
    );
    expect(mockUploadTextToS3).toHaveBeenCalledTimes(2);
    expect(result).toEqual(FAKE_METADATA);
  });

  it("should pass the correct script to generateMetadata", async () => {
    // Given
    mockDownloadScriptFromS3.mockReturnValue(Effect.succeed(FAKE_SCRIPT));
    mockGenerateMetadata.mockReturnValue(Effect.succeed(FAKE_METADATA));
    mockUploadThumbnailToS3.mockReturnValue(Effect.succeed(undefined));
    mockUploadTextToS3.mockReturnValue(Effect.succeed(undefined));

    // When
    await handler({ scriptKey: "script-generator/script.json" });

    // Then
    const [scriptArg] = mockGenerateMetadata.mock.calls[0] as [Script];
    expect(scriptArg).toEqual(FAKE_SCRIPT);
  });
});
