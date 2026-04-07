// Tests for lambda.ts
//
// Design contract:
//   handler(event: unknown): Promise<Script>
//     — throws when TAVILY_SECRET_ARN env var is missing
//     — throws when S3_BUCKET env var is missing
//     — throws when Secrets Manager API call fails
//     — throws when SecretString is undefined in the response
//     — throws when runWorkflow returns an error
//     — throws when uploadScriptToS3 returns an error
//     — uploads script to S3 and returns it on success

import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ============================================
// Mock @aws-sdk/client-secrets-manager
// ============================================

const { MockSecretsManagerClient, mockSend } = vi.hoisted(() => {
  const mockSend = vi.fn();
  function MockSecretsManagerClient() {
    return { send: mockSend };
  }
  return { MockSecretsManagerClient, mockSend };
});

vi.mock("@aws-sdk/client-secrets-manager", () => ({
  SecretsManagerClient: MockSecretsManagerClient,
  GetSecretValueCommand: vi.fn(),
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
// Mock ../workflow-runner
// ============================================

const { mockRunWorkflow } = vi.hoisted(() => ({
  mockRunWorkflow: vi.fn(),
}));

vi.mock("../workflow-runner", () => ({
  runWorkflow: mockRunWorkflow,
}));

// ============================================
// Mock ../infrastructure/s3 (uploadScriptToS3 returns Effect)
// ============================================

const { mockUploadScriptToS3 } = vi.hoisted(() => ({
  mockUploadScriptToS3: vi.fn(),
}));

vi.mock("../infrastructure/s3", () => ({
  uploadScriptToS3: mockUploadScriptToS3,
}));

// ============================================

import { handler } from "./lambda";

// ============================================

const FAKE_SCRIPT = {
  title: "test-result",
  newsItems: [],
  sections: [],
};

describe("handler", () => {
  const VALID_SECRET_ARN =
    "arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:tavily";

  beforeEach(() => {
    vi.resetAllMocks();
    mockCreateTavilyMcpClient.mockReturnValue(mockTavilyClient);
    process.env.TAVILY_SECRET_ARN = VALID_SECRET_ARN;
    process.env.S3_BUCKET = "test-bucket";
  });

  afterEach(() => {
    delete process.env.TAVILY_SECRET_ARN;
    delete process.env.S3_BUCKET;
  });

  it("throws when TAVILY_SECRET_ARN is not set", async () => {
    delete process.env.TAVILY_SECRET_ARN;

    await expect(handler({})).rejects.toThrow(
      "TAVILY_SECRET_ARN environment variable is required",
    );
  });

  it("throws when S3_BUCKET is not set", async () => {
    delete process.env.S3_BUCKET;

    await expect(handler({})).rejects.toThrow(
      "S3_BUCKET environment variable is required",
    );
  });

  it("throws when Secrets Manager API call fails", async () => {
    mockSend.mockRejectedValue(new Error("AccessDeniedException"));

    await expect(handler({ genre: "technology" })).rejects.toThrow(
      "AccessDeniedException",
    );
  });

  it("throws when SecretString is undefined in the response", async () => {
    mockSend.mockResolvedValue({ SecretString: undefined });

    await expect(handler({ genre: "technology" })).rejects.toThrow(
      `Secret ${VALID_SECRET_ARN} has no string value`,
    );
  });

  it("throws when runWorkflow returns an error", async () => {
    mockSend.mockResolvedValue({ SecretString: "resolved-api-key" });
    mockRunWorkflow.mockReturnValue(
      Effect.fail({ type: "WORKFLOW_ERROR", message: "workflow failed" }),
    );

    await expect(handler({ genre: "technology" })).rejects.toThrow(
      "workflow failed",
    );
  });

  it("throws when uploadScriptToS3 returns an error", async () => {
    mockSend.mockResolvedValue({ SecretString: "resolved-api-key" });
    mockRunWorkflow.mockReturnValue(Effect.succeed(FAKE_SCRIPT));
    mockUploadScriptToS3.mockReturnValue(
      Effect.fail({ _tag: "S3PutObjectError", message: "upload failed" }),
    );

    await expect(handler({ genre: "technology" })).rejects.toThrow(
      "upload failed",
    );
  });

  it("uploads script to S3 and returns it on success", async () => {
    mockSend.mockResolvedValue({ SecretString: "resolved-api-key" });
    mockRunWorkflow.mockReturnValue(Effect.succeed(FAKE_SCRIPT));
    mockUploadScriptToS3.mockReturnValue(Effect.succeed(undefined));

    const result = await handler({ genre: "technology" });

    expect(mockCreateTavilyMcpClient).toHaveBeenCalledWith("resolved-api-key");
    expect(mockRunWorkflow).toHaveBeenCalledWith(
      { genre: "technology" },
      mockTavilyClient,
    );
    expect(mockUploadScriptToS3).toHaveBeenCalledWith(
      "test-bucket",
      "script-generator/script.json",
      FAKE_SCRIPT,
    );
    expect(result).toEqual(FAKE_SCRIPT);
  });
});
