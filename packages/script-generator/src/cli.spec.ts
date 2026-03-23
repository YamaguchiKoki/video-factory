// Tests for the Docker CLI entry point (cli.ts).
//
// Design contract:
//   OUTPUT_SCRIPT_KEY = "script-generator/script.json"  (exported const)
//
//   run(): Promise<void>
//     — exits 1 when S3_BUCKET env var is missing
//     — calls handler() and uploads the result to OUTPUT_SCRIPT_KEY
//     — uploads to the bucket specified in S3_BUCKET
//     — exits 1 when handler() throws
//     — uploads with ContentType: application/json

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Script } from "./schema";

// ============================================
// Mock handler
// ============================================

const { mockHandler } = vi.hoisted(() => ({
  mockHandler: vi.fn(),
}));

vi.mock("./handler", () => ({
  handler: mockHandler,
}));

// ============================================
// Mock @aws-sdk/client-s3
// ============================================

const { mockS3Send } = vi.hoisted(() => ({
  mockS3Send: vi.fn(),
}));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(function () {
    return { send: mockS3Send };
  }),
  PutObjectCommand: vi.fn(function (args: unknown) {
    return args;
  }),
}));

import { OUTPUT_SCRIPT_KEY, createS3ClientConfig, run } from "./cli";

// ============================================
// Test data
// ============================================

const buildValidScript = (): Script => ({
  title: "テストラジオ 2026年3月22日号",
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
// OUTPUT_SCRIPT_KEY constant
// ============================================

describe("OUTPUT_SCRIPT_KEY", () => {
  it("is script-generator/script.json", () => {
    expect(OUTPUT_SCRIPT_KEY).toBe("script-generator/script.json");
  });
});

// ============================================
// createS3ClientConfig
// ============================================

describe("createS3ClientConfig", () => {
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
// run() — Docker entrypoint behavior
// ============================================

describe("run", () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env["S3_BUCKET"] = "video-factory";
    exitSpy = vi
      .spyOn(process, "exit")
      .mockReturnValue(undefined as never);
    mockHandler.mockResolvedValue(buildValidScript());
    mockS3Send.mockResolvedValue({});
  });

  afterEach(() => {
    delete process.env["S3_BUCKET"];
    vi.restoreAllMocks();
  });

  it("exits with code 1 when S3_BUCKET is not set", async () => {
    // Given
    delete process.env["S3_BUCKET"];

    // When
    await run();

    // Then
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("uploads script result to OUTPUT_SCRIPT_KEY", async () => {
    // Given
    const script = buildValidScript();
    mockHandler.mockResolvedValue(script);
    mockS3Send.mockResolvedValueOnce({});

    // When
    await run();

    // Then
    expect(mockS3Send).toHaveBeenCalledWith(
      expect.objectContaining({ Key: OUTPUT_SCRIPT_KEY }),
    );
  });

  it("uploads to the bucket configured in S3_BUCKET", async () => {
    // Given
    const script = buildValidScript();
    mockHandler.mockResolvedValue(script);
    mockS3Send.mockResolvedValueOnce({});

    // When
    await run();

    // Then
    expect(mockS3Send).toHaveBeenCalledWith(
      expect.objectContaining({ Bucket: "video-factory" }),
    );
  });

  it("uploads with ContentType: application/json", async () => {
    // Given
    const script = buildValidScript();
    mockHandler.mockResolvedValue(script);
    mockS3Send.mockResolvedValueOnce({});

    // When
    await run();

    // Then
    expect(mockS3Send).toHaveBeenCalledWith(
      expect.objectContaining({ ContentType: "application/json" }),
    );
  });

  it("JSON-serializes the script as the request Body", async () => {
    // Given
    const script = buildValidScript();
    mockHandler.mockResolvedValue(script);
    mockS3Send.mockResolvedValueOnce({});

    // When
    await run();

    // Then
    const callArgs = mockS3Send.mock.calls[0]?.[0] as {
      Body: Buffer;
      [key: string]: unknown;
    };
    expect(callArgs).toBeDefined();
    const parsed = JSON.parse(callArgs.Body.toString());
    expect(parsed.title).toBe(script.title);
  });

  it("exits with code 1 when handler throws", async () => {
    // Given
    mockHandler.mockRejectedValue(new Error("LLM workflow failed"));

    // When
    await run();

    // Then
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits with code 1 when S3 upload fails", async () => {
    // Given
    const script = buildValidScript();
    mockHandler.mockResolvedValue(script);
    mockS3Send.mockRejectedValueOnce(new Error("NoSuchBucket"));

    // When
    await run();

    // Then
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
