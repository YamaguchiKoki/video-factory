import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  createS3ClientConfig,
  parseWithZodEffect,
} from "@video-factory/shared";
import { Effect, Schema } from "effect";
import type { Script } from "../schema";
import { ScriptSchema } from "../schema";

// ============================================
// Error types
// ============================================

class S3GetObjectError extends Schema.TaggedErrorClass<S3GetObjectError>()(
  "S3GetObjectError",
  { message: Schema.String },
) {}

class S3PutObjectError extends Schema.TaggedErrorClass<S3PutObjectError>()(
  "S3PutObjectError",
  { message: Schema.String },
) {}

// ============================================
// S3 client
// ============================================

const s3 = new S3Client(
  createS3ClientConfig({
    S3_ENDPOINT_URL: process.env.S3_ENDPOINT_URL,
    S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
  }),
);

// ============================================
// Public functions
// ============================================

export const downloadScriptFromS3 = (
  bucket: string,
  key: string,
): Effect.Effect<Script, S3GetObjectError> =>
  Effect.tryPromise({
    try: async () => {
      const response = await s3.send(
        new GetObjectCommand({ Bucket: bucket, Key: key }),
      );
      if (!response.Body) {
        throw new Error(`S3 object has no body: s3://${bucket}/${key}`);
      }
      return response.Body.transformToString();
    },
    catch: (e) =>
      new S3GetObjectError({
        message: e instanceof Error ? e.message : String(e),
      }),
  }).pipe(Effect.flatMap((body) => parseScriptJson(body)));

export const uploadThumbnailToS3 = (
  bucket: string,
  key: string,
  imageData: Buffer,
): Effect.Effect<void, S3PutObjectError> =>
  Effect.tryPromise({
    try: () =>
      s3
        .send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: imageData,
            ContentType: "image/png",
          }),
        )
        .then(() => undefined),
    catch: (e) =>
      new S3PutObjectError({
        message: e instanceof Error ? e.message : String(e),
      }),
  });

export const uploadTextToS3 = (
  bucket: string,
  key: string,
  content: string,
): Effect.Effect<void, S3PutObjectError> =>
  Effect.tryPromise({
    try: () =>
      s3
        .send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: Buffer.from(content),
            ContentType: "application/json",
          }),
        )
        .then(() => undefined),
    catch: (e) =>
      new S3PutObjectError({
        message: e instanceof Error ? e.message : String(e),
      }),
  });

// ============================================
// Helpers
// ============================================

const parseScriptJson = (
  body: string,
): Effect.Effect<Script, S3GetObjectError> =>
  Effect.try({
    try: () => JSON.parse(body) as unknown,
    catch: (e) =>
      new S3GetObjectError({
        message: e instanceof Error ? e.message : String(e),
      }),
  }).pipe(
    Effect.flatMap((parsed) =>
      parseWithZodEffect(ScriptSchema, parsed).pipe(
        Effect.mapError(
          (err) =>
            new S3GetObjectError({
              message: `Schema validation failed: ${err.message}`,
            }),
        ),
      ),
    ),
  );
