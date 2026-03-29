import { describe, expect, it, vi, beforeEach } from "vitest";
import { createTopicSelectionAgent, TOPIC_SELECTION_AGENT_ID } from "./agent";
import type { TavilyMcpClient } from "../../mcp/tavily";

describe("createTopicSelectionAgent", () => {
  const mockTavilyClient: TavilyMcpClient = {
    listTools: vi.fn().mockResolvedValue({
      tavily_search: { description: "mock", execute: vi.fn(), parameters: {} },
    }),
    disconnect: vi.fn().mockResolvedValue(undefined),
  } as unknown as TavilyMcpClient;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should have the correct agent id", () => {
    // Given / When
    const agent = createTopicSelectionAgent(mockTavilyClient);

    // Then — agent id must remain stable so mastra registry lookup works
    expect(agent.id).toBe(TOPIC_SELECTION_AGENT_ID);
    expect(agent.id).toBe("topic-selection-agent");
  });

  it("should have a model configured", () => {
    // Given / When
    const agent = createTopicSelectionAgent(mockTavilyClient);

    // Then — agent must have a model to be able to generate responses
    expect(agent.model).toBeDefined();
  });

  it("should have Tavily MCP tools configured", async () => {
    // Given
    const agent = createTopicSelectionAgent(mockTavilyClient);

    // When — listTools() resolves the dynamic tools property of the agent
    const tools = await agent.listTools();
    const toolNames = Object.keys(tools);

    // Then — the agent must have at least one tool (from Tavily MCP)
    expect(toolNames.length).toBeGreaterThan(0);
  });
});
