import { GetObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import { Effect, Schema } from "effect";

export class S3DownloadError extends Schema.TaggedErrorClass<S3DownloadError>()(
  "S3DownloadError",
  { message: Schema.String },
) {}

/** S3 のオブジェクトをバイト列として取り出す。 */
export const downloadObject =
  (client: S3Client) =>
  (bucket: string, key: string): Effect.Effect<Uint8Array, S3DownloadError> =>
    Effect.tryPromise({
      try: async () => {
        const response = await client.send(
          new GetObjectCommand({ Bucket: bucket, Key: key }),
        );
        if (!response.Body) {
          throw new Error("empty body");
        }
        return await response.Body.transformToByteArray();
      },
      catch: (e) =>
        new S3DownloadError({
          message: `Failed to download s3://${bucket}/${key}: ${
            e instanceof Error ? e.message : String(e)
          }`,
        }),
    });

/** S3 のオブジェクトを UTF-8 文字列として取り出す。 */
export const downloadText =
  (client: S3Client) =>
  (bucket: string, key: string): Effect.Effect<string, S3DownloadError> =>
    downloadObject(client)(bucket, key).pipe(
      Effect.map((bytes) => new TextDecoder().decode(bytes)),
    );
