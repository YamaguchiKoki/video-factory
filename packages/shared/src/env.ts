import { Effect, Schema } from "effect";
import { EnvValidationError } from "./errors.js";

export const DockerEnvSchema = Schema.Struct({
  S3_BUCKET: Schema.String.check(Schema.isNonEmpty()),
  S3_ENDPOINT_URL: Schema.optional(Schema.String),
  S3_ACCESS_KEY_ID: Schema.optional(Schema.String),
  S3_SECRET_ACCESS_KEY: Schema.optional(Schema.String),
});

export type DockerEnv = typeof DockerEnvSchema.Type;

export const parseDockerEnv = (
  env: Record<string, string | undefined>,
): Effect.Effect<DockerEnv, EnvValidationError> =>
  Schema.decodeUnknownEffect(DockerEnvSchema)(env).pipe(
    Effect.mapError((e) => new EnvValidationError({ message: String(e) })),
  );
