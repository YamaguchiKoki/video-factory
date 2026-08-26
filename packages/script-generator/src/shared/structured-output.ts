import type { Agent } from "@mastra/core/agent";
import { parseStructuredOutput } from "@video-factory/shared";
import { Result } from "effect";
import type { z } from "zod";

const DEFAULT_MAX_ATTEMPTS = 3;

// Mastra の structuredOutput は間欠的に undefined を返したり、正しい JSON を
// 単一キーのオブジェクトに包んで返したりする。包みは parseStructuredOutput が
// 剥がすので、リトライが必要なのは「何も返ってこなかった」場合だけになる。
// object が undefined になるのは finishReason !== "stop"（length /
// content-filter / tool-calls 等）のときで、Mastra 側は例外を投げない
// （@mastra/core: `if (finishReason === "stop") result.object = ...`）。
// そのため warn には finishReason を必ず含め、CloudWatch だけで原因が
// 追えるようにする。失敗は決定論的に即判明するため待ち時間は入れない
// （スロットリング由来の再試行は AI SDK 側が既に行っている）。
export const generateStructured = async <T>(
  agent: Agent,
  prompt: string,
  schema: z.ZodType<T>,
  maxAttempts: number = DEFAULT_MAX_ATTEMPTS,
): Promise<T> => {
  const attempt = async (n: number): Promise<T> => {
    const response = await agent.generate(prompt, {
      structuredOutput: { schema },
    });

    const parsed = parseStructuredOutput(schema, response.object);
    if (Result.isSuccess(parsed)) return parsed.success;

    console.warn(
      `[structured-output] attempt ${n}/${maxAttempts} failed (finishReason: ${response.finishReason}): ${parsed.failure}`,
    );

    if (n >= maxAttempts) {
      throw new Error(
        `generateStructured failed after ${maxAttempts} attempts: ${parsed.failure}`,
      );
    }
    return attempt(n + 1);
  };

  return attempt(1);
};
