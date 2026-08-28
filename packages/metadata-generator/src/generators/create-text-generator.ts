import type { Mastra } from "@mastra/core/mastra";
import { parseStructuredOutput } from "@video-factory/shared";
import { Effect, Result } from "effect";
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

// generate-metadata.ts runs description/comment/thumbnail concurrently
// (Effect.all(..., { concurrency: 3 })), so wall clock is the max of the
// three branches, not the sum. A text generator at 3 attempts is ~180s
// worst case, well inside this Lambda's 900s timeout.
//
// This deliberately differs from script-generator's DEFAULT_MAX_ATTEMPTS
// of 2: that package runs 6 agent executions sequentially in one 15-minute
// Lambda, so its worst case is 6 x maxAttempts x 60s — 3 attempts there
// would be ~1080s and blow the timeout, so it is capped at 2 (~720s).
// Concurrency here, not a mistake, is why the numbers differ.
const MAX_ATTEMPTS = 3;

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

      // Mastra's structuredOutput intermittently returns `object: undefined`
      // (only populated when finishReason === "stop"), and sometimes wraps
      // valid JSON as {"$schema": "<json>"}. parseStructuredOutput recovers
      // the wrapped case for free; only the undefined case needs a retry.
      // CLAUDE.md bans `let`, so this is recursion rather than a loop.
      const attempt = (n: number): Effect.Effect<T, E> =>
        Effect.gen(function* () {
          const response = yield* Effect.tryPromise({
            try: (signal) =>
              agent.generate(config.buildPrompt(script), {
                structuredOutput: { schema: config.schema },
                // Effect.all's concurrency mode interrupts sibling fibers
                // when one fails, but that only abandons the in-flight
                // Promise's await — it does not cancel the underlying
                // Bedrock call unless the call itself observes an
                // AbortSignal. Wiring this in caps in-flight billed calls
                // when a sibling generator (thumbnail/description/comment)
                // fails first.
                abortSignal: signal,
              }),
            catch: (e) =>
              config.createError(e instanceof Error ? e.message : String(e)),
          });

          const parsed = parseStructuredOutput(config.schema, response.object);
          if (Result.isSuccess(parsed)) return parsed.success;

          // Always log finishReason: Mastra only populates `object` when
          // finishReason is "stop", so without this, CloudWatch has no
          // record of why the attempt came back empty.
          yield* Effect.sync(() =>
            console.warn(
              `[${config.agentId}] attempt ${n}/${MAX_ATTEMPTS} failed (finishReason: ${response.finishReason}): ${parsed.failure}`,
            ),
          );

          if (n >= MAX_ATTEMPTS) {
            return yield* Effect.fail(
              config.createError(
                `[${config.agentId}] structured output generation failed after ${MAX_ATTEMPTS} attempts: ${parsed.failure}`,
              ),
            );
          }
          return yield* attempt(n + 1);
        });

      return yield* attempt(1);
    });
