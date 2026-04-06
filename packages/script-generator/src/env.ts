import { Effect, Schema } from "effect";
import { DockerEnvSchema, EnvValidationError } from "@video-factory/shared";
export type { DockerEnv } from "@video-factory/shared";
export { EnvValidationError, parseDockerEnv } from "@video-factory/shared";

export const ScriptGeneratorEnvSchema = Schema.Struct({
  ...DockerEnvSchema.fields,
  TAVILY_API_KEY: Schema.String.check(Schema.isNonEmpty()),
});

export type ScriptGeneratorEnv = typeof ScriptGeneratorEnvSchema.Type;

export const parseScriptGeneratorEnv = (
  env: Record<string, string | undefined>,
): Effect.Effect<ScriptGeneratorEnv, EnvValidationError> =>
  Schema.decodeUnknownEffect(ScriptGeneratorEnvSchema)(env).pipe(
    Effect.mapError((e) => new EnvValidationError({ message: String(e) })),
  );
