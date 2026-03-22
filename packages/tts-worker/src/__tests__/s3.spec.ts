// Tests for the S3 client (s3.ts).
// This module does not exist yet; tests are written TDD-first.
//
// Design contract:
//   getScriptFromS3(bucket, key): ResultAsync<Script, S3Error>
//   uploadWavToS3(bucket, key, data): ResultAsync<void, S3Error>
//   buildOutputWavKey(date, title): string
//   S3Error = { type: "GET_OBJECT_ERROR" | "PUT_OBJECT_ERROR" | "VALIDATION_ERROR"; message: string }

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildOutputWavKey, getScriptFromS3, uploadWavToS3 } from "../s3";

// ============================================
// Mock @aws-sdk/client-s3
// S3Client is a module-level singleton in s3.ts; mock the SDK at module level.
// ============================================

const { mockS3Send } = vi.hoisted(() => ({
  mockS3Send: vi.fn(),
}));

vi.mock("@aws-sdk/client-s3", () => ({
  // Regular functions required: arrow functions cannot be used as constructors with `new`
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
        transformToString: vi.fn().mockResolvedValue(JSON.stringify(validScript)),
      },
    });

    // Act
    const result = await getScriptFromS3("my-bucket", "scripts/2026-03-21.json");

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
    const result = await getScriptFromS3("my-bucket", "scripts/2026-03-21.json");

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
    const result = await getScriptFromS3("my-bucket", "scripts/2026-03-21.json");

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
    const result = await getScriptFromS3("my-bucket", "scripts/2026-03-21.json");

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
    const result = await getScriptFromS3("my-bucket", "scripts/2026-03-21.json");

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
// buildOutputWavKey — pure function, no S3 interaction
// ============================================

describe("buildOutputWavKey", () => {
  it("builds the correct S3 key from date and title", () => {
    // Arrange / Act
    const key = buildOutputWavKey("2026-03-21", "今日のラジオ");

    // Assert — matches script-generator naming convention: audio/{date}/{title}.wav
    expect(key).toBe("audio/2026-03-21/今日のラジオ.wav");
  });

  it("preserves the date and title verbatim", () => {
    // Arrange / Act
    const key = buildOutputWavKey("2025-12-31", "年末特番ラジオ");

    // Assert
    expect(key).toBe("audio/2025-12-31/年末特番ラジオ.wav");
  });

  it("uses audio/ prefix matching script-generator scripts/ convention", () => {
    // Arrange / Act
    const key = buildOutputWavKey("2026-01-01", "テスト");

    // Assert — scripts use scripts/{date}.json, audio uses audio/{date}/{title}.wav
    expect(key).toMatch(/^audio\//);
  });

  it("appends .wav extension", () => {
    // Arrange / Act
    const key = buildOutputWavKey("2026-03-21", "タイトル");

    // Assert
    expect(key).toMatch(/\.wav$/);
  });
});
