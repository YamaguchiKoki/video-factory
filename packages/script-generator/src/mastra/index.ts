import { Mastra } from "@mastra/core/mastra";

import { registerApiRoute } from "@mastra/core/server";
import { PinoLogger } from "@mastra/loggers";
import {
  CloudExporter,
  DefaultExporter,
  Observability,
  SensitiveDataFilter,
} from "@mastra/observability";
import { fetchInformationAgent } from "../agents/proto";

export const mastra = new Mastra({
  agents: {
    fetchInformationAgent,
  },
  workflows: {},
  server: {
    host: "0.0.0.0",
    port: 8080,
    apiRoutes: [
      // Health check endpoint (REQUIRED by AgentCore)
      registerApiRoute("/ping", {
        method: "GET",
        handler: async (c) => {
          return c.json({
            status: "Healthy",
            time_of_last_update: Math.floor(Date.now() / 1000),
          });
        },
      }),
      // Agent invocation endpoint (REQUIRED by AgentCore)
      registerApiRoute("/invocations", {
        method: "POST",
        handler: async (c) => {
          const mastra = c.get("mastra");

          const prompt = await c.req.text();

          const agent = mastra.getAgent("topicDecisionAgent");
          const response = await agent.generate(prompt);

          return c.text(response.text);
        },
      }),
    ],
  },
  logger: new PinoLogger({
    name: "Mastra",
    level: "info",
  }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: "mastra",
        exporters: [
          new DefaultExporter(), // Persists traces to storage for Mastra Studio
          new CloudExporter(), // Sends traces to Mastra Cloud (if MASTRA_CLOUD_ACCESS_TOKEN is set)
        ],
        spanOutputProcessors: [
          new SensitiveDataFilter(), // Redacts sensitive data like passwords, tokens, keys
        ],
      },
    },
  }),
});
