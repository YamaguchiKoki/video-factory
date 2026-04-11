// Tests for docker-runner.ts
//
// Design contract:
//   DEFAULT_INPUT_SCRIPT_KEY = "script-generator/script.json"
//   THUMBNAIL_S3_KEY / DESCRIPTION_S3_KEY / COMMENT_S3_KEY  (exported S3 key constants)
//
//   run(): Promise<void>
//     — exits 1 when S3_BUCKET env var is missing
//     — calls downloadScriptFromS3 with INPUT_SCRIPT_KEY (default or override) and configured bucket
//     — runs generateMetadata against the downloaded script
//     — uploads thumbnail/description/comment to the configured bucket on the standard S3 keys
//     — exits 1 when downloadScriptFromS3 fails
//     — exits 1 when generateMetadata fails
//     — exits 1 when any upload fails

import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MetadataOutput, Script } from "../schema";

// ============================================
// Mock ../infrastructure/s3
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

import {
  COMMENT_S3_KEY,
  DEFAULT_INPUT_SCRIPT_KEY,
  DESCRIPTION_S3_KEY,
  run,
  THUMBNAIL_S3_KEY,
} from "./docker-runner";

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
// Constants
// ============================================

describe("constants", () => {
  it("DEFAULT_INPUT_SCRIPT_KEY is script-generator/script.json", () => {
    expect(DEFAULT_INPUT_SCRIPT_KEY).toBe("script-generator/script.json");
  });

  it("S3 output keys match the lambda handler", () => {
    expect(THUMBNAIL_S3_KEY).toBe("metadata-generator/thumbnail.png");
    expect(DESCRIPTION_S3_KEY).toBe("metadata-generator/description.json");
    expect(COMMENT_S3_KEY).toBe("metadata-generator/comment.json");
  });
});

// ============================================
// run()
// ============================================

describe("run", () => {
  const ctx = { exitSpy: null as unknown as ReturnType<typeof vi.spyOn> };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.S3_BUCKET = "video-factory";
    delete process.env.INPUT_SCRIPT_KEY;
    ctx.exitSpy = vi.spyOn(process, "exit").mockReturnValue(undefined as never);
    mockDownloadScriptFromS3.mockReturnValue(Effect.succeed(FAKE_SCRIPT));
    mockGenerateMetadata.mockReturnValue(Effect.succeed(FAKE_METADATA));
    mockUploadThumbnailToS3.mockReturnValue(Effect.succeed(undefined));
    mockUploadTextToS3.mockReturnValue(Effect.succeed(undefined));
  });

  afterEach(() => {
    delete process.env.S3_BUCKET;
    delete process.env.INPUT_SCRIPT_KEY;
    vi.restoreAllMocks();
  });

  it("exits with code 1 when S3_BUCKET is not set", async () => {
    delete process.env.S3_BUCKET;
    await run();
    expect(ctx.exitSpy).toHaveBeenCalledWith(1);
  });

  it("downloads script with default INPUT_SCRIPT_KEY when not overridden", async () => {
    await run();
    expect(mockDownloadScriptFromS3).toHaveBeenCalledWith(
      "video-factory",
      DEFAULT_INPUT_SCRIPT_KEY,
    );
  });

  it("respects INPUT_SCRIPT_KEY env var override", async () => {
    process.env.INPUT_SCRIPT_KEY = "custom/path/script.json";
    await run();
    expect(mockDownloadScriptFromS3).toHaveBeenCalledWith(
      "video-factory",
      "custom/path/script.json",
    );
  });

  it("calls generateMetadata with the downloaded script", async () => {
    await run();
    expect(mockGenerateMetadata).toHaveBeenCalled();
    const [scriptArg] = mockGenerateMetadata.mock.calls[0] as [Script];
    expect(scriptArg).toEqual(FAKE_SCRIPT);
  });

  it("uploads thumbnail / description / comment to the configured bucket", async () => {
    await run();
    expect(mockUploadThumbnailToS3).toHaveBeenCalledWith(
      "video-factory",
      THUMBNAIL_S3_KEY,
      expect.any(Buffer),
    );
    expect(mockUploadTextToS3).toHaveBeenCalledWith(
      "video-factory",
      DESCRIPTION_S3_KEY,
      expect.any(String),
    );
    expect(mockUploadTextToS3).toHaveBeenCalledWith(
      "video-factory",
      COMMENT_S3_KEY,
      expect.any(String),
    );
  });

  it("exits with code 1 when downloadScriptFromS3 fails", async () => {
    mockDownloadScriptFromS3.mockReturnValue(
      Effect.fail({ _tag: "S3GetObjectError", message: "NoSuchKey" }),
    );
    await run();
    expect(ctx.exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits with code 1 when generateMetadata fails", async () => {
    mockGenerateMetadata.mockReturnValue(
      Effect.fail({
        _tag: "ThumbnailGenerationError",
        message: "Image model error",
      }),
    );
    await run();
    expect(ctx.exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits with code 1 when thumbnail upload fails", async () => {
    mockUploadThumbnailToS3.mockReturnValue(
      Effect.fail({ _tag: "S3PutObjectError", message: "Upload failed" }),
    );
    await run();
    expect(ctx.exitSpy).toHaveBeenCalledWith(1);
  });

  it("does not exit when all steps succeed", async () => {
    await run();
    expect(ctx.exitSpy).not.toHaveBeenCalled();
  });
});
