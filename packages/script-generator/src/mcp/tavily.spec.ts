import { describe, expect, it, vi, beforeEach } from "vitest";
import { MCPClient } from "@mastra/mcp";
import { createTavilyMcpClient } from "./tavily";

// Local mock: only this file needs to intercept real MCPClient network calls.
vi.mock("@mastra/mcp", () => {
  const MockMCPClient = vi.fn(function (this: Record<string, unknown>) {
    this.listTools = vi.fn().mockResolvedValue({
      tavily_search: {
        description: "Tavily search tool (mock)",
        execute: vi.fn(),
        parameters: {},
      },
    });
    this.disconnect = vi.fn().mockResolvedValue(undefined);
  });

  return { MCPClient: MockMCPClient };
});

const TEST_API_KEY = "test-api-key-abc123";

describe("createTavilyMcpClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return an MCPClient instance", () => {
    // Given / When
    const client = createTavilyMcpClient(TEST_API_KEY);

    // Then
    expect(client).toBeInstanceOf(MCPClient);
  });

  it("should expose a listTools method on the returned client", () => {
    // Given / When
    const client = createTavilyMcpClient(TEST_API_KEY);

    // Then — MCPClient exposes listTools() for agent integration
    expect(typeof client.listTools).toBe("function");
  });

  it("should expose a disconnect method for cleanup", () => {
    // Given / When
    const client = createTavilyMcpClient(TEST_API_KEY);

    // Then — MCPClient provides disconnect() for lifecycle management
    expect(typeof client.disconnect).toBe("function");
  });

  it("should configure tavily server with correct URL and auth header", () => {
    // Given / When
    createTavilyMcpClient(TEST_API_KEY);

    // Then
    expect(MCPClient).toHaveBeenCalledWith(
      expect.objectContaining({
        servers: expect.objectContaining({
          tavily: expect.objectContaining({
            url: new URL("https://mcp.tavily.com/mcp/"),
          }),
        }),
      }),
    );
  });

  it("should configure the Authorization header with the provided API key", () => {
    // Given / When
    createTavilyMcpClient(TEST_API_KEY);

    // Then
    expect(MCPClient).toHaveBeenCalledWith(
      expect.objectContaining({
        servers: expect.objectContaining({
          tavily: expect.objectContaining({
            requestInit: expect.objectContaining({
              headers: expect.objectContaining({
                Authorization: `Bearer ${TEST_API_KEY}`,
              }),
            }),
          }),
        }),
      }),
    );
  });
});
