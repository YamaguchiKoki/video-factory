import {
  GetSecretValueCommand,
  type SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { Effect, Result, Schema } from "effect";
import { type YouTubeCredentials, YouTubeCredentialsSchema } from "../schema";

export class CredentialsError extends Schema.TaggedErrorClass<CredentialsError>()(
  "CredentialsError",
  { message: Schema.String },
) {}

/**
 * Secrets Manager から YouTube の OAuth 認証情報を読む。
 *
 * シークレットには次の JSON を入れておく:
 *   {"clientId": "...", "clientSecret": "...", "refreshToken": "..."}
 *
 * 形式が違う場合は「何が足りないか」が分かるメッセージで落とす。
 * ここが曖昧だと、設定漏れが実行時の謎のエラーとして現れる。
 */
export const loadCredentials =
  (client: SecretsManagerClient) =>
  (secretArn: string): Effect.Effect<YouTubeCredentials, CredentialsError> =>
    Effect.gen(function* () {
      const response = yield* Effect.tryPromise({
        try: () =>
          client.send(new GetSecretValueCommand({ SecretId: secretArn })),
        catch: (e) =>
          new CredentialsError({
            message: `Failed to read secret ${secretArn}: ${
              e instanceof Error ? e.message : String(e)
            }`,
          }),
      });

      const body = response.SecretString;
      if (!body) {
        return yield* Effect.fail(
          new CredentialsError({
            message: `Secret ${secretArn} has no string value. Store a JSON object with clientId, clientSecret and refreshToken.`,
          }),
        );
      }

      const decoded = Result.try({
        try: () => JSON.parse(body) as unknown,
        catch: () =>
          new CredentialsError({
            message: `Secret ${secretArn} is not valid JSON. Expected {"clientId","clientSecret","refreshToken"}.`,
          }),
      });
      if (Result.isFailure(decoded)) return yield* Effect.fail(decoded.failure);

      const parsed = YouTubeCredentialsSchema.safeParse(decoded.success);
      if (!parsed.success) {
        return yield* Effect.fail(
          new CredentialsError({
            message: `Secret ${secretArn} is missing required fields: ${parsed.error.message}`,
          }),
        );
      }

      return parsed.data;
    });
