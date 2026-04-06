// Tests for S3 client configuration and enriched-script upload (s3.ts).
//
// Design contract:
//   createS3ClientConfig(env?): S3ClientConfig
//     if S3_ENDPOINT_URL is set   → { endpoint, region, forcePathStyle: true }
//     if unset                    → {}
//
//   StorageService.uploadEnrichedScript(data): Effect<void, S3Error>
//     success → succeeds with void
//     failure → S3PutObjectError

import { Effect, Result } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EnrichedScript } from "../schema";
import { StorageService } from "../storage";

// ============================================
// Mock @aws-sdk/client-s3 (module-level mock, s3.ts creates S3Client internally)
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
  GetObjectCommand: vi.fn(function (args: unknown) {
    return args;
  }),
  // biome-ignore lint/complexity/useArrowFunction: constructor mock requires `function` for `new`
  PutObjectCommand: vi.fn(function (args: unknown) {
    return args;
  }),
}));

import { createS3ClientConfig, createStorageServiceLive } from "../s3";

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
    expect(config).toEqual({
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
});

// ============================================
// StorageService.uploadEnrichedScript
// ============================================

describe("StorageService.uploadEnrichedScript", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("succeeds on successful upload", async () => {
    mockS3Send.mockResolvedValueOnce({});
    const enrichedScript = buildValidEnrichedScript();
    const layer = createStorageServiceLive(
      "video-factory",
      "tts-worker/audio.wav",
      "tts-worker/script.json",
    );

    const result = await Effect.runPromise(
      Effect.result(
        Effect.gen(function* () {
          const storage = yield* StorageService;
          return yield* storage.uploadEnrichedScript(enrichedScript);
        }).pipe(Effect.provide(layer)),
      ),
    );

    expect(Result.isSuccess(result)).toBe(true);
  });

  it("fails with S3PutObjectError when S3 send rejects", async () => {
    mockS3Send.mockRejectedValueOnce(new Error("NoSuchBucket"));
    const enrichedScript = buildValidEnrichedScript();
    const layer = createStorageServiceLive(
      "video-factory",
      "tts-worker/audio.wav",
      "tts-worker/script.json",
    );

    const result = await Effect.runPromise(
      Effect.result(
        Effect.gen(function* () {
          const storage = yield* StorageService;
          return yield* storage.uploadEnrichedScript(enrichedScript);
        }).pipe(Effect.provide(layer)),
      ),
    );

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("S3PutObjectError");
      expect(result.failure.message).toContain("NoSuchBucket");
    }
  });

  it("uploads with ContentType: application/json", async () => {
    mockS3Send.mockResolvedValueOnce({});
    const enrichedScript = buildValidEnrichedScript();
    const layer = createStorageServiceLive(
      "video-factory",
      "tts-worker/audio.wav",
      "tts-worker/script.json",
    );

    await Effect.runPromise(
      Effect.gen(function* () {
        const storage = yield* StorageService;
        return yield* storage.uploadEnrichedScript(enrichedScript);
      }).pipe(Effect.provide(layer)),
    );

    expect(mockS3Send).toHaveBeenCalledWith(
      expect.objectContaining({ ContentType: "application/json" }),
    );
  });

  it("JSON-serializes the EnrichedScript as the request body", async () => {
    mockS3Send.mockResolvedValueOnce({});
    const enrichedScript = buildValidEnrichedScript();
    const layer = createStorageServiceLive(
      "video-factory",
      "tts-worker/audio.wav",
      "tts-worker/script.json",
    );

    await Effect.runPromise(
      Effect.gen(function* () {
        const storage = yield* StorageService;
        return yield* storage.uploadEnrichedScript(enrichedScript);
      }).pipe(Effect.provide(layer)),
    );

    const callArgs = mockS3Send.mock.calls[0]?.[0] as {
      Body: Buffer;
      [key: string]: unknown;
    };
    expect(callArgs).toBeDefined();
    const parsed = JSON.parse(callArgs.Body.toString()) as {
      title: string;
      totalDurationSec: number;
    };
    expect(parsed.title).toBe(enrichedScript.title);
    expect(parsed.totalDurationSec).toBe(enrichedScript.totalDurationSec);
  });

  it("calls PutObjectCommand with the correct Bucket and Key (outputScriptKey)", async () => {
    mockS3Send.mockResolvedValueOnce({});
    const enrichedScript = buildValidEnrichedScript();
    const layer = createStorageServiceLive(
      "video-factory",
      "tts-worker/audio.wav",
      "tts-worker/enriched.json",
    );

    await Effect.runPromise(
      Effect.gen(function* () {
        const storage = yield* StorageService;
        return yield* storage.uploadEnrichedScript(enrichedScript);
      }).pipe(Effect.provide(layer)),
    );

    expect(mockS3Send).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: "video-factory",
        Key: "tts-worker/enriched.json",
      }),
    );
  });
});
