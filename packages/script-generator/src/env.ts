import { err, ok, type Result } from "neverthrow";
import { z } from "zod";

const DockerEnvSchema = z.object({
  S3_BUCKET: z.string().min(1),
  S3_ENDPOINT_URL: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
});

export type DockerEnv = z.infer<typeof DockerEnvSchema>;

export type EnvError = {
  readonly type: "ENV_VALIDATION_ERROR";
  readonly message: string;
};

export const parseDockerEnv = (
  env: Record<string, string | undefined>,
): Result<DockerEnv, EnvError> => {
  const parsed = DockerEnvSchema.safeParse(env);
  if (!parsed.success) {
    return err({ type: "ENV_VALIDATION_ERROR", message: parsed.error.message });
  }
  return ok(parsed.data);
};
