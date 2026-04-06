// Tests for docker-runner.ts
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

import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Script } from "../schema";

// ============================================
// Mock ./workflow-runner
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
// Mock ./infrastructure/s3 (uploadScriptToS3 now returns Effect)
// ============================================

const { mockUploadScriptToS3 } = vi.hoisted(() => ({
  mockUploadScriptToS3: vi.fn(),
}));

vi.mock("../infrastructure/s3", () => ({
  uploadScriptToS3: mockUploadScriptToS3,
  createS3ClientConfig: vi.fn(() => ({})),
  S3PutObjectError: class S3PutObjectError extends Error {
    readonly _tag = "S3PutObjectError";
    constructor(args: { message: string }) {
      super(args.message);
    }
  },
}));

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

// Helper: make runWorkflow mock return an Effect
const makeOkWorkflowResult = (script: Script) => Effect.succeed(script);

const makeErrWorkflowResult = (message: string) =>
  Effect.fail({ type: "WORKFLOW_ERROR" as const, message });

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
    mockRunWorkflow.mockReturnValue(makeOkWorkflowResult(buildValidScript()));
    mockUploadScriptToS3.mockReturnValue(Effect.succeed(undefined));
    mockCreateTavilyMcpClient.mockReturnValue(mockTavilyClient);
  });

  afterEach(() => {
    delete process.env.S3_BUCKET;
    vi.restoreAllMocks();
  });

  it("exits with code 1 when S3_BUCKET is not set", async () => {
    delete process.env.S3_BUCKET;
    await run();
    expect(ctx.exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits with code 1 when TAVILY_API_KEY is not set", async () => {
    const saved = process.env.TAVILY_API_KEY;
    delete process.env.TAVILY_API_KEY;
    await run();
    expect(ctx.exitSpy).toHaveBeenCalledWith(1);
    if (saved !== undefined) process.env.TAVILY_API_KEY = saved;
  });

  it("calls runWorkflow with genre: technology and tavilyClient", async () => {
    await run();
    expect(mockRunWorkflow).toHaveBeenCalledWith(
      { genre: "technology" },
      mockTavilyClient,
    );
  });

  it("uploads script result to OUTPUT_SCRIPT_KEY", async () => {
    const script = buildValidScript();
    mockRunWorkflow.mockReturnValue(makeOkWorkflowResult(script));
    await run();
    expect(mockUploadScriptToS3).toHaveBeenCalledWith(
      expect.any(String),
      OUTPUT_SCRIPT_KEY,
      script,
    );
  });

  it("uploads to the bucket configured in S3_BUCKET", async () => {
    process.env.S3_BUCKET = "my-custom-bucket";
    mockRunWorkflow.mockReturnValue(makeOkWorkflowResult(buildValidScript()));
    await run();
    expect(mockUploadScriptToS3).toHaveBeenCalledWith(
      "my-custom-bucket",
      expect.any(String),
      expect.any(Object),
    );
  });

  it("does not call uploadScriptToS3 when S3_BUCKET is not set", async () => {
    delete process.env.S3_BUCKET;
    await run();
    expect(mockUploadScriptToS3).not.toHaveBeenCalled();
  });

  it("exits with code 1 when runWorkflow returns an error", async () => {
    mockRunWorkflow.mockReturnValue(
      makeErrWorkflowResult("LLM workflow failed"),
    );
    await run();
    expect(ctx.exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits with code 1 when uploadScriptToS3 fails", async () => {
    mockRunWorkflow.mockReturnValue(makeOkWorkflowResult(buildValidScript()));
    mockUploadScriptToS3.mockReturnValue(
      Effect.fail({ _tag: "S3PutObjectError", message: "NoSuchBucket" }),
    );
    await run();
    expect(ctx.exitSpy).toHaveBeenCalledWith(1);
  });

  it("does not exit when workflow succeeds and upload succeeds", async () => {
    mockRunWorkflow.mockReturnValue(makeOkWorkflowResult(buildValidScript()));
    mockUploadScriptToS3.mockReturnValue(Effect.succeed(undefined));
    await run();
    expect(ctx.exitSpy).not.toHaveBeenCalled();
  });
});
