import type { Agent } from "@mastra/core/agent";
import { parseStructuredOutput } from "@video-factory/shared";
import { Result } from "effect";
import type { z } from "zod";

// script-generator の4ステップ（topic-selection 1 + topic-deep-dive
// ×3 foreach + fact-check 1 + dialogue-script-generator 1 = 6実行）は
// すべて同一の Lambda 内で直列に走り、Lambda のハードタイムアウトは
// 15分（900秒、AWS上限で引き上げ不可）。Bedrock 呼び出しは観測上
// 1回あたり30〜60秒かかるため、リトライ上限は
// 「900秒 ÷ (6実行 × 60秒/回)」で頭打ちになる制約であり、任意に選んだ
// 値ではない。maxAttempts=3 だと最悪18回 ≒ 1080秒でタイムアウトを超える。
// maxAttempts=2 なら最悪12回 ≒ 720秒で収まる。3に戻す場合は先に
// タイムアウト算出をやり直すこと。
const DEFAULT_MAX_ATTEMPTS = 2;

// Mastra の structuredOutput は間欠的に undefined を返したり、正しい JSON を
// 単一キーのオブジェクトに包んで返したりする。包みは parseStructuredOutput が
// 剥がすので、リトライが必要なのは「何も返ってこなかった」場合だけになる。
// object が undefined になるのは finishReason !== "stop"（length /
// content-filter / tool-calls 等）のときで、Mastra 側は例外を投げない
// （@mastra/core: `if (finishReason === "stop") result.object = ...`）。
// そのため warn には finishReason を必ず含め、CloudWatch だけで原因が
// 追えるようにする。失敗は決定論的に即判明するため待ち時間は入れない
// （スロットリング由来の再試行は AI SDK 側が既に行っている）。
// label は呼び出し元のステップ（agent id）を識別する。4ステップとも
// 同一 Lambda・同一ログストリームに出るため、label がないと
// CloudWatch 上でどのステップの失敗か区別できない。
export const generateStructured = async <T>(
  label: string,
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
      `[structured-output:${label}] attempt ${n}/${maxAttempts} failed (finishReason: ${response.finishReason}): ${parsed.failure}`,
    );

    if (n >= maxAttempts) {
      throw new Error(
        `generateStructured[${label}] failed after ${maxAttempts} attempts: ${parsed.failure}`,
      );
    }
    return attempt(n + 1);
  };

  return attempt(1);
};
