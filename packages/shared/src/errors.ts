import { Schema } from "effect";

export class EnvValidationError extends Schema.TaggedErrorClass<EnvValidationError>()(
  "EnvValidationError",
  {
    message: Schema.String,
  },
) {}

export const toError = (e: unknown): Error =>
  e instanceof Error ? e : new Error(String(e));

export const toMessage = (e: unknown): string =>
  e instanceof Error ? e.message : String(e);

export const isNodeError = (e: unknown): e is NodeJS.ErrnoException =>
  e instanceof Error && "code" in e;
