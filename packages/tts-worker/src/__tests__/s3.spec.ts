// Tests for the S3 client (s3.ts).
// This module does not exist yet; tests are written TDD-first.
//
// Design contract:
//   getScriptFromS3(bucket, key): ResultAsync<Script, S3Error>
//   uploadWavToS3(bucket, key, data): ResultAsync<void, S3Error>
//   S3Error = { type: "GET_OBJECT_ERROR" | "PUT_OBJECT_ERROR" | "VALIDATION_ERROR"; message: string }

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDockerStorage,
  extractDateFromKey,
  getScriptFromS3,
  uploadWavToS3,
} from "../s3";
import type { EnrichedScript } from "../schema";
import type { StorageDeps } from "../storage";

// ============================================
// Mock @aws-sdk/client-s3
// S3Client is a module-level singleton in s3.ts; mock the SDK at module level.
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

// ============================================
// Test data
// ============================================

const buildValidScript = () => ({
  title: "今日のラジオ 2026年3月21日号",
  newsItems: [
    { id: "news-1", title: "ニュース1" },
    { id: "news-2", title: "ニュース2" },
    { id: "news-3", title: "ニュース3" },
  ],
  sections: [
    {
      type: "intro" as const,
      greeting: [{ speaker: "A", text: "こんにちは" }],
      newsOverview: [{ speaker: "A", text: "今日のニュース" }],
    },
    {
      type: "discussion" as const,
      newsId: "news-1",
      blocks: [
        { phase: "summary" as const, lines: [{ speaker: "A", text: "概要" }] },
        {
          phase: "background" as const,
          lines: [{ speaker: "B", text: "背景" }],
        },
        {
          phase: "deepDive" as const,
          lines: [{ speaker: "A", text: "深掘り" }],
        },
      ],
    },
    {
      type: "discussion" as const,
      newsId: "news-2",
      blocks: [
        { phase: "summary" as const, lines: [{ speaker: "A", text: "概要" }] },
        {
          phase: "background" as const,
          lines: [{ speaker: "B", text: "背景" }],
        },
        {
          phase: "deepDive" as const,
          lines: [{ speaker: "A", text: "深掘り" }],
        },
      ],
    },
    {
      type: "discussion" as const,
      newsId: "news-3",
      blocks: [
        { phase: "summary" as const, lines: [{ speaker: "A", text: "概要" }] },
        {
          phase: "background" as const,
          lines: [{ speaker: "B", text: "背景" }],
        },
        {
          phase: "deepDive" as const,
          lines: [{ speaker: "A", text: "深掘り" }],
        },
      ],
    },
    {
      type: "outro" as const,
      recap: [{ speaker: "A", text: "まとめ" }],
      closing: [{ speaker: "B", text: "さようなら" }],
    },
  ],
});

// ============================================
// getScriptFromS3
// ============================================

describe("getScriptFromS3", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns Ok with a parsed Script on success", async () => {
    // Arrange
    const validScript = buildValidScript();
    mockS3Send.mockResolvedValueOnce({
      Body: {
        transformToString: vi
          .fn()
          .mockResolvedValue(JSON.stringify(validScript)),
      },
    });

    // Act
    const result = await getScriptFromS3(
      "my-bucket",
      "scripts/2026-03-21.json",
    );

    // Assert
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.title).toBe(validScript.title);
    }
  });

  it("returns Err GET_OBJECT_ERROR when S3 send rejects", async () => {
    // Arrange
    mockS3Send.mockRejectedValueOnce(new Error("AccessDenied"));

    // Act
    const result = await getScriptFromS3(
      "my-bucket",
      "scripts/2026-03-21.json",
    );

    // Assert
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("GET_OBJECT_ERROR");
      expect(result.error.message).toContain("AccessDenied");
    }
  });

  it("returns Err GET_OBJECT_ERROR when Body is undefined", async () => {
    // Arrange
    mockS3Send.mockResolvedValueOnce({ Body: undefined });

    // Act
    const result = await getScriptFromS3(
      "my-bucket",
      "scripts/2026-03-21.json",
    );

    // Assert
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("GET_OBJECT_ERROR");
    }
  });

  it("returns Err VALIDATION_ERROR when JSON is invalid", async () => {
    // Arrange
    mockS3Send.mockResolvedValueOnce({
      Body: {
        transformToString: vi.fn().mockResolvedValue("not-json-{{{"),
      },
    });

    // Act
    const result = await getScriptFromS3(
      "my-bucket",
      "scripts/2026-03-21.json",
    );

    // Assert
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("VALIDATION_ERROR");
    }
  });

  it("returns Err VALIDATION_ERROR when JSON structure does not match ScriptSchema", async () => {
    // Arrange — missing required fields
    const invalidScript = { title: "ラジオ" }; // missing newsItems, sections
    mockS3Send.mockResolvedValueOnce({
      Body: {
        transformToString: vi
          .fn()
          .mockResolvedValue(JSON.stringify(invalidScript)),
      },
    });

    // Act
    const result = await getScriptFromS3(
      "my-bucket",
      "scripts/2026-03-21.json",
    );

    // Assert
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("VALIDATION_ERROR");
    }
  });
});

// ============================================
// uploadWavToS3
// ============================================

describe("uploadWavToS3", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns Ok void on successful upload", async () => {
    // Arrange
    mockS3Send.mockResolvedValueOnce({});
    const wavData = new ArrayBuffer(1024);

    // Act
    const result = await uploadWavToS3(
      "my-bucket",
      "audio/2026-03-21/ラジオ.wav",
      wavData,
    );

    // Assert
    expect(result.isOk()).toBe(true);
  });

  it("returns Err PUT_OBJECT_ERROR when S3 send rejects", async () => {
    // Arrange
    mockS3Send.mockRejectedValueOnce(new Error("NoSuchBucket"));
    const wavData = new ArrayBuffer(1024);

    // Act
    const result = await uploadWavToS3(
      "my-bucket",
      "audio/2026-03-21/ラジオ.wav",
      wavData,
    );

    // Assert
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("PUT_OBJECT_ERROR");
      expect(result.error.message).toContain("NoSuchBucket");
    }
  });

  it("uploads with audio/wav Content-Type", async () => {
    // Arrange
    mockS3Send.mockResolvedValueOnce({});
    const wavData = new ArrayBuffer(512);

    // Act
    await uploadWavToS3("my-bucket", "audio/2026-03-21/ラジオ.wav", wavData);

    // Assert — PutObjectCommand was called with correct ContentType
    expect(mockS3Send).toHaveBeenCalledWith(
      expect.objectContaining({ ContentType: "audio/wav" }),
    );
  });
});

// ============================================
// extractDateFromKey — pure function, no I/O
// ============================================

describe("extractDateFromKey", () => {
  it("extracts the date from a standard script key", () => {
    expect(extractDateFromKey("scripts/2026-03-21.json")).toBe("2026-03-21");
  });

  it("extracts filename without extension when there is no path separator", () => {
    expect(extractDateFromKey("script.json")).toBe("script");
  });

  it("extracts only the last segment when there are multiple path components", () => {
    expect(extractDateFromKey("a/b/c/2025-12-31.json")).toBe("2025-12-31");
  });

  it("handles keys without .json extension (returns filename as-is)", () => {
    expect(extractDateFromKey("scripts/2026-03-21")).toBe("2026-03-21");
  });
});

// ============================================
// createDockerStorage — returns a StorageDeps implementation
// ============================================

const buildMinimalEnrichedScript = (): EnrichedScript => ({
  title: "テストラジオ",
  totalDurationSec: 2.0,
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

describe("createDockerStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an object satisfying StorageDeps with all required fields", () => {
    const storage = createDockerStorage(
      "video-factory",
      "tts-worker/audio.wav",
      "tts-worker/script.json",
    );

    expect(typeof storage.getScript).toBe("function");
    expect(typeof storage.uploadWav).toBe("function");
    expect(typeof storage.uploadEnrichedScript).toBe("function");
    expect(typeof storage.buildOutputKey).toBe("function");
  });

  it("buildOutputKey always returns the fixed outputWavKey regardless of date/title", () => {
    const storage = createDockerStorage(
      "video-factory",
      "custom/audio.wav",
      "tts-worker/script.json",
    );

    expect(storage.buildOutputKey("2026-03-24", "タイトル")).toBe(
      "custom/audio.wav",
    );
    expect(storage.buildOutputKey("", "")).toBe("custom/audio.wav");
    expect(storage.buildOutputKey("any-date", "any-title")).toBe(
      "custom/audio.wav",
    );
  });

  it("uploadEnrichedScript uploads to the outputScriptKey specified at construction", async () => {
    mockS3Send.mockResolvedValueOnce({});
    const storage = createDockerStorage(
      "video-factory",
      "tts-worker/audio.wav",
      "tts-worker/enriched.json",
    );

    await storage.uploadEnrichedScript(buildMinimalEnrichedScript());

    expect(mockS3Send).toHaveBeenCalledWith(
      expect.objectContaining({
        Key: "tts-worker/enriched.json",
        Bucket: "video-factory",
      }),
    );
  });

  it("uploadEnrichedScript returns Ok void on success", async () => {
    mockS3Send.mockResolvedValueOnce({});
    const storage = createDockerStorage(
      "video-factory",
      "tts-worker/audio.wav",
      "tts-worker/script.json",
    );

    const result = await storage.uploadEnrichedScript(
      buildMinimalEnrichedScript(),
    );

    expect(result.isOk()).toBe(true);
  });

  it("uploadEnrichedScript returns Err on S3 failure", async () => {
    mockS3Send.mockRejectedValueOnce(new Error("AccessDenied"));
    const storage = createDockerStorage(
      "video-factory",
      "tts-worker/audio.wav",
      "tts-worker/script.json",
    );

    const result = await storage.uploadEnrichedScript(
      buildMinimalEnrichedScript(),
    );

    expect(result.isErr()).toBe(true);
  });

  it("satisfies TypeScript StorageDeps interface", () => {
    const storage: StorageDeps = createDockerStorage(
      "video-factory",
      "tts-worker/audio.wav",
      "tts-worker/script.json",
    );

    expect(storage).toBeDefined();
  });
});
