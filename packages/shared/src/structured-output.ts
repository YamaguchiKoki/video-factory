import { Result } from "effect";
import type { z } from "zod";

// Mastra の structuredOutput は、スキーマに合う JSON を作れていても
// それを JSON 文字列にして単一キーのオブジェクトに包んで返すことがある
// （2026-08-09 に {"$schema": "<json>"} 形式を観測）。
// 素で通らなかった場合に限り、その包みを剥がして再検証する。
const MAX_UNWRAP_DEPTH = 2;

export const parseStructuredOutput = <T>(
  schema: z.ZodType<T>,
  raw: unknown,
): Result.Result<T, string> => {
  const direct = schema.safeParse(raw);
  if (direct.success) return Result.succeed(direct.data);

  const recovered = recover(schema, raw, 0);
  return (
    recovered ??
    Result.fail(`Structured output validation failed: ${direct.error.message}`)
  );
};

const recover = <T>(
  schema: z.ZodType<T>,
  raw: unknown,
  depth: number,
): Result.Result<T, string> | undefined => {
  if (depth >= MAX_UNWRAP_DEPTH) return undefined;

  const inner = unwrap(raw);
  if (inner === undefined) return undefined;

  const parsed = schema.safeParse(inner);
  if (parsed.success) return Result.succeed(parsed.data);

  return recover(schema, inner, depth + 1);
};

const unwrap = (raw: unknown): unknown => {
  if (typeof raw === "string") return parseJson(raw);
  if (!isPlainObject(raw)) return undefined;

  const values = Object.values(raw);
  if (values.length !== 1) return undefined;

  const only = values[0];
  return typeof only === "string" ? parseJson(only) : undefined;
};

const parseJson = (value: string): unknown => {
  const parsed = Result.try({
    try: () => JSON.parse(value) as unknown,
    catch: () => undefined,
  });
  return Result.isSuccess(parsed) ? parsed.success : undefined;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
