// Tests for lambda.ts
//
// Design contract:
//   handler(event: unknown): Promise<unknown>
//     — throws when TAVILY_SECRET_ARN env var is missing
//     — throws when Secrets Manager API call fails
//     — throws when SecretString is undefined in the response
//     — creates tavilyClient with the resolved API key and delegates to runWorkflow

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ============================================
// Mock @aws-sdk/client-secrets-manager
//
// SecretsManagerClient must be a regular function (not arrow) so it can be
// called with `new`. vi.hoisted ensures mockSend is available before vi.mock
// runs.
// ============================================

const { MockSecretsManagerClient, mockSend } = vi.hoisted(() => {
  const mockSend = vi.fn();
  // Regular function so `new MockSecretsManagerClient()` works
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
// Static import — handler is now a plain async function with no module-level
// side effects, so vi.resetModules() is not needed.
// ============================================

import { handler } from "./lambda";

// ============================================
// handler tests
// ============================================

describe("handler", () => {
  const VALID_SECRET_ARN =
    "arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:tavily";

  beforeEach(() => {
    vi.resetAllMocks();
    // Restore the default mock return value after resetAllMocks clears it
    mockCreateTavilyMcpClient.mockReturnValue(mockTavilyClient);
  });

  afterEach(() => {
    delete process.env.TAVILY_SECRET_ARN;
  });

  it("throws when TAVILY_SECRET_ARN is not set", async () => {
    // Given
    delete process.env.TAVILY_SECRET_ARN;

    // When / Then
    await expect(handler({})).rejects.toThrow(
      "TAVILY_SECRET_ARN environment variable is required",
    );
  });

  it("throws when Secrets Manager API call fails", async () => {
    // Given
    process.env.TAVILY_SECRET_ARN = VALID_SECRET_ARN;
    mockSend.mockRejectedValue(new Error("AccessDeniedException"));

    // When / Then
    await expect(handler({})).rejects.toThrow("AccessDeniedException");
  });

  it("throws when SecretString is undefined in the response", async () => {
    // Given
    process.env.TAVILY_SECRET_ARN = VALID_SECRET_ARN;
    mockSend.mockResolvedValue({ SecretString: undefined });

    // When / Then
    await expect(handler({})).rejects.toThrow(
      `Secret ${VALID_SECRET_ARN} has no string value`,
    );
  });

  it("creates tavilyClient with resolved key and delegates to runWorkflow", async () => {
    // Given
    process.env.TAVILY_SECRET_ARN = VALID_SECRET_ARN;
    mockSend.mockResolvedValue({ SecretString: "resolved-api-key" });
    mockRunWorkflow.mockResolvedValue({ title: "test-result" });

    // When
    const result = await handler({ genre: "technology" });

    // Then — createTavilyMcpClient must receive the resolved secret value
    expect(mockCreateTavilyMcpClient).toHaveBeenCalledWith("resolved-api-key");
    // Then — runWorkflow must receive both the event and the tavilyClient
    expect(mockRunWorkflow).toHaveBeenCalledWith(
      { genre: "technology" },
      mockTavilyClient,
    );
    expect(result).toEqual({ title: "test-result" });
  });
});
