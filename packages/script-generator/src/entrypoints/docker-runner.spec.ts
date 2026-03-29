// Tests for docker-runner.ts — TDD-first; module does not exist yet.
//
// Design contract:
//   OUTPUT_SCRIPT_KEY = "script-generator/script.json"  (exported const)
//
//   run(): Promise<void>
//     — exits 1 when S3_BUCKET env var is missing
//     — exits 1 when TAVILY_API_KEY env var is missing
//     — calls runWorkflow({ genre: "technology" }) and uploads the result
//     — uploads via uploadScriptToS3 to OUTPUT_SCRIPT_KEY in the configured bucket
//     — exits 1 when runWorkflow() throws
//     — exits 1 when uploadScriptToS3 fails

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Script } from "../schema";

// ============================================
// Mock ./workflow-runner (renamed from handler.ts)
// ============================================

const { mockRunWorkflow } = vi.hoisted(() => ({
  mockRunWorkflow: vi.fn(),
}));

vi.mock("../workflow-runner", () => ({
  runWorkflow: mockRunWorkflow,
}));

// ============================================
// Mock ../mcp/tavily
// ============================================

const { mockCreateTavilyMcpClient, mockTavilyClient } = vi.hoisted(() => {
  const mockTavilyClient = { listTools: vi.fn(), disconnect: vi.fn() };
  const mockCreateTavilyMcpClient = vi.fn().mockReturnValue(mockTavilyClient);
  return { mockCreateTavilyMcpClient, mockTavilyClient };
});

vi.mock("../mcp/tavily", () => ({
  createTavilyMcpClient: mockCreateTavilyMcpClient,
}));

// ============================================
// Mock ./infrastructure/s3
// ============================================

const { mockUploadScriptToS3 } = vi.hoisted(() => ({
  mockUploadScriptToS3: vi.fn(),
}));

vi.mock("../infrastructure/s3", () => ({
  uploadScriptToS3: mockUploadScriptToS3,
  createS3ClientConfig: vi.fn(() => ({})),
}));

import { errAsync, okAsync } from "neverthrow";
import { OUTPUT_SCRIPT_KEY, run } from "./docker-runner";

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
// OUTPUT_SCRIPT_KEY constant
// ============================================

describe("OUTPUT_SCRIPT_KEY", () => {
  it("is script-generator/script.json", () => {
    expect(OUTPUT_SCRIPT_KEY).toBe("script-generator/script.json");
  });
});

// ============================================
// run() — Docker runner behavior
// ============================================

describe("run", () => {
  const ctx = { exitSpy: null as unknown as ReturnType<typeof vi.spyOn> };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.S3_BUCKET = "video-factory";
    ctx.exitSpy = vi.spyOn(process, "exit").mockReturnValue(undefined as never);
    mockRunWorkflow.mockReturnValue(okAsync(buildValidScript()));
    mockUploadScriptToS3.mockReturnValue(okAsync(undefined));
    mockCreateTavilyMcpClient.mockReturnValue(mockTavilyClient);
  });

  afterEach(() => {
    delete process.env.S3_BUCKET;
    vi.restoreAllMocks();
  });

  it("exits with code 1 when S3_BUCKET is not set", async () => {
    // Given
    delete process.env.S3_BUCKET;

    // When
    await run();

    // Then
    expect(ctx.exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits with code 1 when TAVILY_API_KEY is not set", async () => {
    // Given — test-setup.ts stubs TAVILY_API_KEY globally; delete it here and
    // restore inline so other tests are not affected
    const saved = process.env.TAVILY_API_KEY;
    delete process.env.TAVILY_API_KEY;

    // When
    await run();

    // Then
    expect(ctx.exitSpy).toHaveBeenCalledWith(1);

    // Restore the stub value so subsequent tests see it
    if (saved !== undefined) process.env.TAVILY_API_KEY = saved;
  });

  it("calls runWorkflow with genre: technology and tavilyClient", async () => {
    // Given / When
    await run();

    // Then — runWorkflow receives both the workflow input and the DI tavilyClient
    expect(mockRunWorkflow).toHaveBeenCalledWith(
      { genre: "technology" },
      mockTavilyClient,
    );
  });

  it("uploads script result to OUTPUT_SCRIPT_KEY", async () => {
    // Given
    const script = buildValidScript();
    mockRunWorkflow.mockReturnValue(okAsync(script));

    // When
    await run();

    // Then
    expect(mockUploadScriptToS3).toHaveBeenCalledWith(
      expect.any(String),
      OUTPUT_SCRIPT_KEY,
      script,
    );
  });

  it("uploads to the bucket configured in S3_BUCKET", async () => {
    // Given
    process.env.S3_BUCKET = "my-custom-bucket";
    mockRunWorkflow.mockReturnValue(okAsync(buildValidScript()));

    // When
    await run();

    // Then
    expect(mockUploadScriptToS3).toHaveBeenCalledWith(
      "my-custom-bucket",
      expect.any(String),
      expect.any(Object),
    );
  });

  it("does not call uploadScriptToS3 when S3_BUCKET is not set", async () => {
    // Given
    delete process.env.S3_BUCKET;

    // When
    await run();

    // Then
    expect(mockUploadScriptToS3).not.toHaveBeenCalled();
  });

  it("exits with code 1 when runWorkflow returns an error", async () => {
    // Given
    mockRunWorkflow.mockReturnValue(
      errAsync({
        type: "WORKFLOW_ERROR" as const,
        message: "LLM workflow failed",
      }),
    );

    // When
    await run();

    // Then
    expect(ctx.exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits with code 1 when uploadScriptToS3 returns an error", async () => {
    // Given
    mockRunWorkflow.mockReturnValue(okAsync(buildValidScript()));
    mockUploadScriptToS3.mockReturnValue(
      errAsync({ type: "PUT_OBJECT_ERROR" as const, message: "NoSuchBucket" }),
    );

    // When
    await run();

    // Then
    expect(ctx.exitSpy).toHaveBeenCalledWith(1);
  });

  it("does not exit when workflow succeeds and upload succeeds", async () => {
    // Given
    mockRunWorkflow.mockReturnValue(okAsync(buildValidScript()));
    mockUploadScriptToS3.mockReturnValue(okAsync(undefined));

    // When
    await run();

    // Then
    expect(ctx.exitSpy).not.toHaveBeenCalled();
  });
});
