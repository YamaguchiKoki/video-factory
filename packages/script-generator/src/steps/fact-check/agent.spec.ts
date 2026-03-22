import { describe, expect, it, vi, beforeEach } from "vitest";
import { factCheckAgent, FACT_CHECK_AGENT_ID } from "./agent";
import * as tavilyModule from "../../mcp/tavily";

// Local mock: mock the shared tavilyMcp singleton to prevent real network
// connections. The agent's `tools` function calls tavilyMcp.listTools().
vi.mock("../../mcp/tavily", () => ({
  tavilyMcp: {
    listTools: vi.fn(),
    disconnect: vi.fn(),
  },
  createTavilyMcpClient: vi.fn(),
}));

describe("factCheckAgent", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Re-apply resolved values after resetAllMocks clears mock implementations.
    // Cast to unknown to avoid importing Mastra's internal Tool type in tests.
    vi.mocked(tavilyModule.tavilyMcp.listTools).mockResolvedValue(
      { tavily_search: { description: "mock", execute: vi.fn(), parameters: {} } } as unknown as Awaited<ReturnType<typeof tavilyModule.tavilyMcp.listTools>>,
    );
    vi.mocked(tavilyModule.tavilyMcp.disconnect).mockResolvedValue(undefined);
  });

  it("should have the correct agent id", () => {
    // Assert — agent id must remain stable so mastra registry lookup works
    expect(factCheckAgent.id).toBe(FACT_CHECK_AGENT_ID);
    expect(factCheckAgent.id).toBe("fact-check-agent");
  });

  it("should have a model configured", () => {
    // Assert — agent must have a model to be able to generate responses
    expect(factCheckAgent.model).toBeDefined();
  });

  it("should have Tavily MCP tools configured", async () => {
    // Assert — the agent must expose tools from the shared Tavily MCP singleton.
    // listTools() resolves the dynamic tools property of the agent.
    const tools = await factCheckAgent.listTools();
    const toolNames = Object.keys(tools);

    // The agent must have at least one tool (from Tavily MCP)
    expect(toolNames.length).toBeGreaterThan(0);
  });
});
