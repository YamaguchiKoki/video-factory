import type { Mastra } from "@mastra/core/mastra";
import { Effect } from "effect";
import type { z } from "zod";
import type { Script } from "../schema";

// ============================================
// Config type
// ============================================

type TextGeneratorConfig<T, E> = {
  readonly agentId: string;
  readonly schema: z.ZodType<T>;
  readonly createError: (message: string) => E;
  readonly buildPrompt: (script: Script) => string;
};

// ============================================
// Factory
// ============================================

export const createTextGenerator =
  <T, E>(
    config: TextGeneratorConfig<T, E>,
  ): ((script: Script, mastra: Mastra) => Effect.Effect<T, E>) =>
  (script, mastra) =>
    Effect.gen(function* () {
      const agent = mastra.getAgent(config.agentId);
      if (!agent) {
        return yield* Effect.fail(
          config.createError(`Agent ${config.agentId} not found`),
        );
      }

      const response = yield* Effect.tryPromise({
        try: () =>
          agent.generate(config.buildPrompt(script), {
            structuredOutput: { schema: config.schema },
          }),
        catch: (e) =>
          config.createError(e instanceof Error ? e.message : String(e)),
      });

      const parsed = config.schema.safeParse(response.object);
      if (!parsed.success) {
        return yield* Effect.fail(
          config.createError(
            `Structured output validation failed: ${parsed.error.message}`,
          ),
        );
      }
      return parsed.data;
    });
