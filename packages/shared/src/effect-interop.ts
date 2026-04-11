import { Effect } from "effect";
import type { z } from "zod";

export const parseWithZodEffect = <T>(
  schema: z.ZodType<T>,
  value: unknown,
): Effect.Effect<T, z.ZodError> => {
  const result = schema.safeParse(value);
  return result.success
    ? Effect.succeed(result.data)
    : Effect.fail(result.error);
};
