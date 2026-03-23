// Tests for new exports added to s3.ts as part of the RustFS local E2E setup:
//   createS3ClientConfig(): S3ClientConfig
//   uploadEnrichedScriptToS3(bucket, key, data): ResultAsync<void, S3Error>
//
// Design contract:
//   createS3ClientConfig — reads S3_ENDPOINT_URL env var
//     if set   → { endpoint: url, forcePathStyle: true }
//     if unset → {}
//   uploadEnrichedScriptToS3 — PutObjectCommand with ContentType: application/json
//     success → Ok(void)
//     failure → Err({ type: "PUT_OBJECT_ERROR", message: string })

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EnrichedScript } from "../schema";

// ============================================
// Mock @aws-sdk/client-s3 (module-level singleton in s3.ts)
// ============================================

const { mockS3Send } = vi.hoisted(() => ({
  mockS3Send: vi.fn(),
}));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(function () {
    return { send: mockS3Send };
  }),
  GetObjectCommand: vi.fn(function (args: unknown) {
    return args;
  }),
  PutObjectCommand: vi.fn(function (args: unknown) {
    return args;
  }),
}));

import { createS3ClientConfig, uploadEnrichedScriptToS3 } from "../s3";

// ============================================
// Test data
// ============================================

const buildValidEnrichedScript = (): EnrichedScript => ({
  title: "テストラジオ",
  totalDurationSec: 3.0,
  outputWavS3Key: "tts-worker/audio.wav",
  newsItems: [
    { id: "news-1", title: "ニュース1" },
    { id: "news-2", title: "ニュース2" },
    { id: "news-3", title: "ニュース3" },
  ],
  sections: [
    {
      type: "intro",
      greeting: [
        {
          speaker: "A",
          text: "こんにちは",
          voicevoxSpeakerId: 0,
          offsetSec: 0,
          durationSec: 1.0,
        },
      ],
      newsOverview: [
        {
          speaker: "B",
          text: "今日のニュース",
          voicevoxSpeakerId: 1,
          offsetSec: 1.0,
          durationSec: 1.0,
        },
      ],
    },
    {
      type: "discussion",
      newsId: "news-1",
      blocks: [
        {
          phase: "summary",
          lines: [
            {
              speaker: "A",
              text: "概要1",
              voicevoxSpeakerId: 0,
              offsetSec: 2.0,
              durationSec: 0.5,
            },
          ],
        },
        {
          phase: "background",
          lines: [
            {
              speaker: "B",
              text: "背景1",
              voicevoxSpeakerId: 1,
              offsetSec: 2.5,
              durationSec: 0.5,
            },
          ],
        },
        {
          phase: "deepDive",
          lines: [
            {
              speaker: "A",
              text: "深掘り1",
              voicevoxSpeakerId: 0,
              offsetSec: 3.0,
              durationSec: 0.5,
            },
          ],
        },
      ],
    },
    {
      type: "discussion",
      newsId: "news-2",
      blocks: [
        {
          phase: "summary",
          lines: [
            {
              speaker: "A",
              text: "概要2",
              voicevoxSpeakerId: 0,
              offsetSec: 3.5,
              durationSec: 0.5,
            },
          ],
        },
        {
          phase: "background",
          lines: [
            {
              speaker: "B",
              text: "背景2",
              voicevoxSpeakerId: 1,
              offsetSec: 4.0,
              durationSec: 0.5,
            },
          ],
        },
        {
          phase: "deepDive",
          lines: [
            {
              speaker: "A",
              text: "深掘り2",
              voicevoxSpeakerId: 0,
              offsetSec: 4.5,
              durationSec: 0.5,
            },
          ],
        },
      ],
    },
    {
      type: "discussion",
      newsId: "news-3",
      blocks: [
        {
          phase: "summary",
          lines: [
            {
              speaker: "A",
              text: "概要3",
              voicevoxSpeakerId: 0,
              offsetSec: 5.0,
              durationSec: 0.5,
            },
          ],
        },
        {
          phase: "background",
          lines: [
            {
              speaker: "B",
              text: "背景3",
              voicevoxSpeakerId: 1,
              offsetSec: 5.5,
              durationSec: 0.5,
            },
          ],
        },
        {
          phase: "deepDive",
          lines: [
            {
              speaker: "A",
              text: "深掘り3",
              voicevoxSpeakerId: 0,
              offsetSec: 6.0,
              durationSec: 0.5,
            },
          ],
        },
      ],
    },
    {
      type: "outro",
      recap: [
        {
          speaker: "A",
          text: "まとめ",
          voicevoxSpeakerId: 0,
          offsetSec: 6.5,
          durationSec: 1.0,
        },
      ],
      closing: [
        {
          speaker: "B",
          text: "さようなら",
          voicevoxSpeakerId: 1,
          offsetSec: 7.5,
          durationSec: 1.0,
        },
      ],
    },
  ],
});

// ============================================
// createS3ClientConfig
// ============================================

describe("createS3ClientConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env["S3_ENDPOINT_URL"];
  });

  it("returns empty object when S3_ENDPOINT_URL is not set", () => {
    // Given
    delete process.env["S3_ENDPOINT_URL"];

    // When
    const config = createS3ClientConfig();

    // Then
    expect(config).toEqual({});
  });

  it("returns endpoint config with forcePathStyle:true when S3_ENDPOINT_URL is set", () => {
    // Given
    process.env["S3_ENDPOINT_URL"] = "http://rustfs:9000";

    // When
    const config = createS3ClientConfig();

    // Then
    expect(config).toEqual({
      endpoint: "http://rustfs:9000",
      region: "ap-northeast-1",
      forcePathStyle: true,
    });
  });

  it("uses the exact URL value from S3_ENDPOINT_URL without modification", () => {
    // Given
    const url = "http://localhost:9000";
    process.env["S3_ENDPOINT_URL"] = url;

    // When
    const config = createS3ClientConfig();

    // Then
    expect(config).toMatchObject({ endpoint: url });
  });
});

// ============================================
// uploadEnrichedScriptToS3
// ============================================

describe("uploadEnrichedScriptToS3", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns Ok void on successful upload", async () => {
    // Given
    mockS3Send.mockResolvedValueOnce({});
    const enrichedScript = buildValidEnrichedScript();

    // When
    const result = await uploadEnrichedScriptToS3(
      "video-factory",
      "tts-worker/script.json",
      enrichedScript,
    );

    // Then
    expect(result.isOk()).toBe(true);
  });

  it("returns Err PUT_OBJECT_ERROR when S3 send rejects", async () => {
    // Given
    mockS3Send.mockRejectedValueOnce(new Error("NoSuchBucket"));
    const enrichedScript = buildValidEnrichedScript();

    // When
    const result = await uploadEnrichedScriptToS3(
      "video-factory",
      "tts-worker/script.json",
      enrichedScript,
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
    const enrichedScript = buildValidEnrichedScript();

    // When
    await uploadEnrichedScriptToS3(
      "video-factory",
      "tts-worker/script.json",
      enrichedScript,
    );

    // Then — PutObjectCommand was called with correct ContentType
    expect(mockS3Send).toHaveBeenCalledWith(
      expect.objectContaining({ ContentType: "application/json" }),
    );
  });

  it("JSON-serializes the EnrichedScript as the request body", async () => {
    // Given
    mockS3Send.mockResolvedValueOnce({});
    const enrichedScript = buildValidEnrichedScript();

    // When
    await uploadEnrichedScriptToS3(
      "video-factory",
      "tts-worker/script.json",
      enrichedScript,
    );

    // Then — Body contains the JSON-serialized EnrichedScript
    const callArgs = mockS3Send.mock.calls[0]?.[0] as {
      Body: Buffer;
      [key: string]: unknown;
    };
    expect(callArgs).toBeDefined();
    const parsed = JSON.parse(callArgs.Body.toString());
    expect(parsed.title).toBe(enrichedScript.title);
    expect(parsed.totalDurationSec).toBe(enrichedScript.totalDurationSec);
  });

  it("calls PutObjectCommand with the correct Bucket and Key", async () => {
    // Given
    mockS3Send.mockResolvedValueOnce({});
    const enrichedScript = buildValidEnrichedScript();

    // When
    await uploadEnrichedScriptToS3(
      "video-factory",
      "tts-worker/script.json",
      enrichedScript,
    );

    // Then
    expect(mockS3Send).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: "video-factory",
        Key: "tts-worker/script.json",
      }),
    );
  });
});
