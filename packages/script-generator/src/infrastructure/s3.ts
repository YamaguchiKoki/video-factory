import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createS3ClientConfig } from "@video-factory/shared";
import { Effect, Schema } from "effect";
import type { Script } from "../schema";

export { createS3ClientConfig } from "@video-factory/shared";

class S3PutObjectError extends Schema.TaggedErrorClass<S3PutObjectError>()(
  "S3PutObjectError",
  { message: Schema.String },
) {}

const s3 = new S3Client(
  createS3ClientConfig({
    S3_ENDPOINT_URL: process.env.S3_ENDPOINT_URL,
    S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
  }),
);

export const uploadScriptToS3 = (
  bucket: string,
  key: string,
  script: Script,
): Effect.Effect<void, S3PutObjectError> =>
  Effect.tryPromise({
    try: () =>
      s3
        .send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: Buffer.from(JSON.stringify(script)),
            ContentType: "application/json",
          }),
        )
        .then(() => undefined),
    catch: (e) =>
      new S3PutObjectError({
        message: e instanceof Error ? e.message : String(e),
      }),
  });
