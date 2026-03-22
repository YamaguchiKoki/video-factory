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

describe("createTavilyMcpClient", () => {
  beforeEach(() => {
    // clearAllMocks resets call history without removing the mock constructor
    // implementation. resetAllMocks would clear the constructor body too, which
    // would break instanceof checks and method availability on new instances.
    vi.clearAllMocks();
  });

  it("should return an MCPClient instance", () => {
    const client = createTavilyMcpClient();

    expect(client).toBeInstanceOf(MCPClient);
  });

  it("should expose a listTools method on the returned client", () => {
    const client = createTavilyMcpClient();

    // MCPClient exposes listTools() for agent integration
    expect(typeof client.listTools).toBe("function");
  });

  it("should expose a disconnect method for cleanup", () => {
    const client = createTavilyMcpClient();

    // MCPClient provides disconnect() for lifecycle management
    expect(typeof client.disconnect).toBe("function");
  });

  it("should configure tavily server with correct URL and auth header", () => {
    createTavilyMcpClient();

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

  it("should configure the Authorization header with the API key", () => {
    createTavilyMcpClient();

    expect(MCPClient).toHaveBeenCalledWith(
      expect.objectContaining({
        servers: expect.objectContaining({
          tavily: expect.objectContaining({
            requestInit: expect.objectContaining({
              headers: expect.objectContaining({
                Authorization: "Bearer test-tavily-key",
              }),
            }),
          }),
        }),
      }),
    );
  });

  it("should throw when TAVILY_API_KEY is missing", async () => {
    vi.resetModules();
    vi.stubEnv("TAVILY_API_KEY", "");
    await expect(() => import("./tavily")).rejects.toThrow();
    vi.unstubAllEnvs();
  });
});
