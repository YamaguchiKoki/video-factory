// Tests for infrastructure/s3.ts — TDD-first; module does not exist yet.
//
// Design contract:
//   createS3ClientConfig(): S3ClientConfig (same logic as former cli.ts)
//     if S3_ENDPOINT_URL is set   → { endpoint, region, forcePathStyle: true }
//     if S3_ENDPOINT_URL is unset → {}
//     if credentials env vars set → includes { credentials: { accessKeyId, secretAccessKey } }
//
//   uploadScriptToS3(bucket, key, script): ResultAsync<void, S3Error>
//     success → Ok(void)
//     S3 failure → Err({ type: "PUT_OBJECT_ERROR", message: string })
//     uploads with ContentType: application/json
//     body is JSON-serialized Script

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Script } from "../schema";

// ============================================
// Mock @aws-sdk/client-s3 (module-level singleton in infrastructure/s3.ts)
// ============================================

const { mockS3Send } = vi.hoisted(() => ({
  mockS3Send: vi.fn(),
}));

// biome-ignore lint/complexity/useArrowFunction: vi.fn mocks used as constructors require `function` for `new` compatibility
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(function () {
    return { send: mockS3Send };
  }),
  PutObjectCommand: vi.fn(function (args: unknown) {
    return args;
  }),
}));

import { createS3ClientConfig, uploadScriptToS3 } from "./s3";

// ============================================
// Test data
// ============================================

const buildValidScript = (): Script => ({
  title: "テストラジオ 2026年3月24日号",
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

// ============================================
// createS3ClientConfig
// ============================================

describe("createS3ClientConfig", () => {
  it("returns empty object when no env config provided", () => {
    const config = createS3ClientConfig();
    expect(config).toEqual({});
  });

  it("returns empty object when S3_ENDPOINT_URL is not set", () => {
    const config = createS3ClientConfig({});
    expect(config).toEqual({});
  });

  it("returns endpoint config with forcePathStyle:true when S3_ENDPOINT_URL is set", () => {
    const config = createS3ClientConfig({
      S3_ENDPOINT_URL: "http://rustfs:9000",
    });
    expect(config).toMatchObject({
      endpoint: "http://rustfs:9000",
      region: "ap-northeast-1",
      forcePathStyle: true,
    });
  });

  it("uses the exact URL value from S3_ENDPOINT_URL without modification", () => {
    const url = "http://localhost:9000";
    const config = createS3ClientConfig({ S3_ENDPOINT_URL: url });
    expect(config).toMatchObject({ endpoint: url });
  });

  it("includes credentials when both S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY are set", () => {
    const config = createS3ClientConfig({
      S3_ENDPOINT_URL: "http://rustfs:9000",
      S3_ACCESS_KEY_ID: "minioadmin",
      S3_SECRET_ACCESS_KEY: "minioadmin",
    });
    expect(config).toMatchObject({
      credentials: {
        accessKeyId: "minioadmin",
        secretAccessKey: "minioadmin",
      },
    });
  });

  it("does not include credentials when only S3_ACCESS_KEY_ID is set (both required)", () => {
    const config = createS3ClientConfig({
      S3_ENDPOINT_URL: "http://rustfs:9000",
      S3_ACCESS_KEY_ID: "minioadmin",
    });
    expect(config).not.toHaveProperty("credentials");
  });
});

// ============================================
// uploadScriptToS3
// ============================================

describe("uploadScriptToS3", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns Ok void on successful upload", async () => {
    // Given
    mockS3Send.mockResolvedValueOnce({});
    const script = buildValidScript();

    // When
    const result = await uploadScriptToS3(
      "video-factory",
      "script-generator/script.json",
      script,
    );

    // Then
    expect(result.isOk()).toBe(true);
  });

  it("returns Err PUT_OBJECT_ERROR when S3 send rejects", async () => {
    // Given
    mockS3Send.mockRejectedValueOnce(new Error("NoSuchBucket"));
    const script = buildValidScript();

    // When
    const result = await uploadScriptToS3(
      "video-factory",
      "script-generator/script.json",
      script,
    );

    // Then
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("PUT_OBJECT_ERROR");
      expect(result.error.message).toContain("NoSuchBucket");
    }
  });

  it("uploads with ContentType: application/json", async () => {
    // Given
    mockS3Send.mockResolvedValueOnce({});
    const script = buildValidScript();

    // When
    await uploadScriptToS3(
      "video-factory",
      "script-generator/script.json",
      script,
    );

    // Then
    expect(mockS3Send).toHaveBeenCalledWith(
      expect.objectContaining({ ContentType: "application/json" }),
    );
  });

  it("calls PutObjectCommand with the correct Bucket and Key", async () => {
    // Given
    mockS3Send.mockResolvedValueOnce({});
    const script = buildValidScript();

    // When
    await uploadScriptToS3(
      "video-factory",
      "script-generator/script.json",
      script,
    );

    // Then
    expect(mockS3Send).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: "video-factory",
        Key: "script-generator/script.json",
      }),
    );
  });

  it("JSON-serializes the Script as the request body", async () => {
    // Given
    mockS3Send.mockResolvedValueOnce({});
    const script = buildValidScript();

    // When
    await uploadScriptToS3(
      "video-factory",
      "script-generator/script.json",
      script,
    );

    // Then
    const callArgs = mockS3Send.mock.calls[0]?.[0] as {
      Body: Buffer;
      [key: string]: unknown;
    };
    expect(callArgs).toBeDefined();
    const parsed = JSON.parse(callArgs.Body.toString());
    expect(parsed.title).toBe(script.title);
    expect(parsed.newsItems).toHaveLength(3);
  });
});
